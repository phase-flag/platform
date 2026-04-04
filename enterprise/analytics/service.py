"""Analytics service — frequentist and Bayesian A/B testing."""

from __future__ import annotations

import math
import random
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ABTestResult, MetricSnapshot


# ---------------------------------------------------------------------------
# Statistical helpers (pure stdlib, no scipy)
# ---------------------------------------------------------------------------

def _normal_cdf(x: float) -> float:
    """Approximate cumulative distribution function of the standard normal."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _normal_ppf(p: float) -> float:
    """Rational approximation of the inverse normal CDF (Abramowitz & Stegun)."""
    if p <= 0:
        return -float("inf")
    if p >= 1:
        return float("inf")
    if p < 0.5:
        return -_normal_ppf(1 - p)
    t = math.sqrt(-2.0 * math.log(1 - p))
    c0, c1, c2 = 2.515517, 0.802853, 0.010328
    d1, d2, d3 = 1.432788, 0.189269, 0.001308
    return t - (c0 + c1 * t + c2 * t * t) / (1.0 + d1 * t + d2 * t * t + d3 * t * t * t)


def _z_test(
    n_a: int, s_a: int, n_b: int, s_b: int
) -> tuple[float, float, bool]:
    """Two-proportion Z-test.  Returns (z_score, p_value, is_significant)."""
    if n_a == 0 or n_b == 0:
        return 0.0, 1.0, False
    p_a = s_a / n_a
    p_b = s_b / n_b
    p_pool = (s_a + s_b) / (n_a + n_b)
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n_a + 1 / n_b)) if 0 < p_pool < 1 else 1e-9
    z = (p_b - p_a) / se
    p_value = 2 * (1 - _normal_cdf(abs(z)))  # two-tailed
    return z, p_value, p_value < 0.05


def _beta_sample(alpha: float, beta_param: float, size: int = 20_000) -> list[float]:
    """Draw samples from Beta(alpha, beta_param) using stdlib random."""
    return [random.betavariate(alpha, beta_param) for _ in range(size)]


def _bayesian_test(
    n_a: int, s_a: int, n_b: int, s_b: int, prior_alpha: float = 1.0, prior_beta: float = 1.0
) -> tuple[float, float, float, float]:
    """Monte Carlo Bayesian A/B test with Beta-Bernoulli model.

    Returns (prob_b_beats_a, expected_loss, ci_low, ci_high) where ci is 95%
    credible interval for the *lift* (p_b - p_a).
    """
    alpha_a = prior_alpha + s_a
    beta_a = prior_beta + (n_a - s_a)
    alpha_b = prior_alpha + s_b
    beta_b = prior_beta + (n_b - s_b)

    samples_a = _beta_sample(alpha_a, beta_a)
    samples_b = _beta_sample(alpha_b, beta_b)

    lifts = [b - a for a, b in zip(samples_a, samples_b)]
    prob_b_beats_a = sum(1 for l in lifts if l > 0) / len(lifts)

    # Expected loss of choosing B when A is better
    losses = [max(a - b, 0) for a, b in zip(samples_a, samples_b)]
    expected_loss = sum(losses) / len(losses)

    lifts_sorted = sorted(lifts)
    ci_low = lifts_sorted[int(0.025 * len(lifts_sorted))]
    ci_high = lifts_sorted[int(0.975 * len(lifts_sorted))]

    return prob_b_beats_a, expected_loss, ci_low, ci_high


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

async def run_frequentist_test(
    session: AsyncSession,
    experiment_id: str,
    n_a: int,
    s_a: int,
    n_b: int,
    s_b: int,
    variant_a_name: str = "control",
    variant_b_name: str = "treatment",
    confidence_level: float = 0.95,
) -> ABTestResult:
    """Run a two-proportion Z-test and persist the result."""
    z, p_value, sig = _z_test(n_a, s_a, n_b, s_b)
    rec = "No significant difference detected."
    if sig:
        winner = variant_b_name if z > 0 else variant_a_name
        rec = f"{winner} is the winner with p={p_value:.4f}."

    result = ABTestResult(
        id=str(uuid.uuid4()),
        experiment_id=experiment_id,
        test_type="frequentist",
        variant_a_name=variant_a_name,
        variant_b_name=variant_b_name,
        variant_a_count=n_a,
        variant_a_successes=s_a,
        variant_b_count=n_b,
        variant_b_successes=s_b,
        p_value=p_value,
        z_score=z,
        confidence_level=confidence_level,
        is_significant=1 if sig else 0,
        recommendation=rec,
        created_at=datetime.utcnow(),
    )
    session.add(result)
    await session.flush()
    return result


async def run_bayesian_test(
    session: AsyncSession,
    experiment_id: str,
    n_a: int,
    s_a: int,
    n_b: int,
    s_b: int,
    variant_a_name: str = "control",
    variant_b_name: str = "treatment",
) -> ABTestResult:
    """Run a Bayesian Beta-Bernoulli A/B test and persist."""
    prob, loss, ci_lo, ci_hi = _bayesian_test(n_a, s_a, n_b, s_b)
    sig = prob > 0.95 or prob < 0.05
    if prob > 0.95:
        rec = f"{variant_b_name} is likely better (P(B>A)={prob:.3f})."
    elif prob < 0.05:
        rec = f"{variant_a_name} is likely better (P(B>A)={prob:.3f})."
    else:
        rec = "Insufficient evidence to declare a winner."

    result = ABTestResult(
        id=str(uuid.uuid4()),
        experiment_id=experiment_id,
        test_type="bayesian",
        variant_a_name=variant_a_name,
        variant_b_name=variant_b_name,
        variant_a_count=n_a,
        variant_a_successes=s_a,
        variant_b_count=n_b,
        variant_b_successes=s_b,
        prob_b_beats_a=prob,
        expected_loss=loss,
        credible_interval_low=ci_lo,
        credible_interval_high=ci_hi,
        is_significant=1 if sig else 0,
        recommendation=rec,
        created_at=datetime.utcnow(),
    )
    session.add(result)
    await session.flush()
    return result


async def store_metric(
    session: AsyncSession,
    experiment_id: str,
    variant: str,
    metric_name: str,
    metric_value: float,
    sample_size: int,
) -> MetricSnapshot:
    snap = MetricSnapshot(
        id=str(uuid.uuid4()),
        experiment_id=experiment_id,
        variant=variant,
        metric_name=metric_name,
        metric_value=metric_value,
        sample_size=sample_size,
        captured_at=datetime.utcnow(),
    )
    session.add(snap)
    await session.flush()
    return snap


async def get_results(
    session: AsyncSession, experiment_id: str
) -> list[ABTestResult]:
    stmt = select(ABTestResult).where(ABTestResult.experiment_id == experiment_id).order_by(ABTestResult.created_at.desc())
    rows = await session.execute(stmt)
    return list(rows.scalars().all())
