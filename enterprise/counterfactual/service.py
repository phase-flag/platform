"""Counterfactual service — causal inference 'what if' analysis.

Uses difference-in-means with bootstrap confidence intervals, plus an
inverse-probability weighting (IPW) estimator when propensity scores are
available.
"""

from __future__ import annotations

import json
import math
import random
import statistics
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import CounterfactualQuery, CounterfactualResult


# ---------------------------------------------------------------------------
# Observation format:
# {
#   "user_id": "u1",
#   "variation": "control",       # which variation they actually got
#   "outcome": 1.0,               # metric value
#   "propensity": 0.5             # optional: P(assigned to treatment)
# }
# ---------------------------------------------------------------------------


def _bootstrap_ci(
    data: List[float], n_bootstrap: int = 5000, alpha: float = 0.05
) -> Tuple[float, float]:
    """Bootstrap confidence interval for the mean."""
    if not data:
        return 0.0, 0.0
    means = []
    n = len(data)
    for _ in range(n_bootstrap):
        sample = [random.choice(data) for _ in range(n)]
        means.append(statistics.mean(sample))
    means.sort()
    lo_idx = int(alpha / 2 * len(means))
    hi_idx = int((1 - alpha / 2) * len(means))
    return means[lo_idx], means[min(hi_idx, len(means) - 1)]


def _difference_in_means(
    observations: List[Dict[str, Any]],
    original_variation: str,
    counterfactual_variation: str,
) -> Dict[str, Any]:
    """Estimate the Average Treatment Effect (ATE) via simple difference-in-means."""
    original_outcomes = [o["outcome"] for o in observations if o["variation"] == original_variation]
    cf_outcomes = [o["outcome"] for o in observations if o["variation"] == counterfactual_variation]

    if not original_outcomes or not cf_outcomes:
        return {
            "method": "difference_in_means",
            "estimated_effect": 0.0,
            "original_mean": statistics.mean(original_outcomes) if original_outcomes else 0.0,
            "counterfactual_mean": statistics.mean(cf_outcomes) if cf_outcomes else 0.0,
            "ci_low": 0.0,
            "ci_high": 0.0,
            "sample_size": len(observations),
            "summary": "Insufficient data for one or both variations.",
        }

    orig_mean = statistics.mean(original_outcomes)
    cf_mean = statistics.mean(cf_outcomes)
    ate = cf_mean - orig_mean

    # Bootstrap CI on the difference
    diffs: List[float] = []
    for _ in range(5000):
        s_orig = [random.choice(original_outcomes) for _ in range(len(original_outcomes))]
        s_cf = [random.choice(cf_outcomes) for _ in range(len(cf_outcomes))]
        diffs.append(statistics.mean(s_cf) - statistics.mean(s_orig))
    diffs.sort()
    ci_lo = diffs[int(0.025 * len(diffs))]
    ci_hi = diffs[int(0.975 * len(diffs))]

    sig = "significant" if (ci_lo > 0 or ci_hi < 0) else "not significant"
    direction = "positive" if ate > 0 else "negative" if ate < 0 else "neutral"

    return {
        "method": "difference_in_means",
        "estimated_effect": ate,
        "original_mean": orig_mean,
        "counterfactual_mean": cf_mean,
        "ci_low": ci_lo,
        "ci_high": ci_hi,
        "sample_size": len(observations),
        "summary": (
            f"Estimated effect: {ate:.4f} ({direction}, {sig}). "
            f"95% CI: [{ci_lo:.4f}, {ci_hi:.4f}]. "
            f"Original mean: {orig_mean:.4f}, Counterfactual mean: {cf_mean:.4f}."
        ),
    }


def _ipw_estimate(
    observations: List[Dict[str, Any]],
    original_variation: str,
    counterfactual_variation: str,
) -> Dict[str, Any]:
    """Inverse Probability Weighting estimator for ATE.

    Requires a 'propensity' field on each observation.
    """
    treated = [o for o in observations if o["variation"] == counterfactual_variation and "propensity" in o]
    control = [o for o in observations if o["variation"] == original_variation and "propensity" in o]

    if not treated or not control:
        return _difference_in_means(observations, original_variation, counterfactual_variation)

    # IPW: E[Y(1)] = mean(Y_i / e_i) for treated, E[Y(0)] = mean(Y_i / (1-e_i)) for control
    n = len(observations)
    weighted_treated = sum(o["outcome"] / max(o["propensity"], 0.01) for o in treated) / n
    weighted_control = sum(o["outcome"] / max(1 - o["propensity"], 0.01) for o in control) / n
    ate = weighted_treated - weighted_control

    # Bootstrap CI
    all_obs = treated + control
    diffs: List[float] = []
    for _ in range(5000):
        sample = [random.choice(all_obs) for _ in range(len(all_obs))]
        s_t = [o for o in sample if o["variation"] == counterfactual_variation]
        s_c = [o for o in sample if o["variation"] == original_variation]
        if s_t and s_c:
            wt = sum(o["outcome"] / max(o["propensity"], 0.01) for o in s_t) / len(sample)
            wc = sum(o["outcome"] / max(1 - o["propensity"], 0.01) for o in s_c) / len(sample)
            diffs.append(wt - wc)
    if diffs:
        diffs.sort()
        ci_lo = diffs[int(0.025 * len(diffs))]
        ci_hi = diffs[int(0.975 * len(diffs))]
    else:
        ci_lo, ci_hi = 0.0, 0.0

    return {
        "method": "ipw",
        "estimated_effect": ate,
        "original_mean": weighted_control,
        "counterfactual_mean": weighted_treated,
        "ci_low": ci_lo,
        "ci_high": ci_hi,
        "sample_size": len(observations),
        "summary": f"IPW-estimated ATE: {ate:.4f}. 95% CI: [{ci_lo:.4f}, {ci_hi:.4f}].",
    }


async def run_counterfactual(
    session: AsyncSession,
    flag_key: str,
    original_variation: str,
    counterfactual_variation: str,
    metric_name: str,
    historical_data: List[Dict[str, Any]],
    environment: str = "production",
    description: Optional[str] = None,
    method: str = "auto",
) -> Tuple[CounterfactualQuery, CounterfactualResult]:
    """Run a counterfactual analysis and persist."""
    query = CounterfactualQuery(
        id=str(uuid.uuid4()),
        flag_key=flag_key,
        environment=environment,
        original_variation=original_variation,
        counterfactual_variation=counterfactual_variation,
        metric_name=metric_name,
        description=description,
        historical_data=json.dumps(historical_data),
        created_at=datetime.utcnow(),
    )
    session.add(query)
    await session.flush()

    # Choose method
    has_propensity = any("propensity" in o for o in historical_data)
    if method == "ipw" or (method == "auto" and has_propensity):
        analysis = _ipw_estimate(historical_data, original_variation, counterfactual_variation)
    else:
        analysis = _difference_in_means(historical_data, original_variation, counterfactual_variation)

    result = CounterfactualResult(
        id=str(uuid.uuid4()),
        query_id=query.id,
        estimated_effect=analysis["estimated_effect"],
        confidence_interval_low=analysis["ci_low"],
        confidence_interval_high=analysis["ci_high"],
        original_mean=analysis["original_mean"],
        counterfactual_mean=analysis["counterfactual_mean"],
        sample_size=analysis["sample_size"],
        method=analysis["method"],
        summary=analysis["summary"],
        created_at=datetime.utcnow(),
    )
    session.add(result)
    await session.flush()

    return query, result


async def get_result(session: AsyncSession, query_id: str) -> Optional[CounterfactualResult]:
    stmt = select(CounterfactualResult).where(CounterfactualResult.query_id == query_id)
    res = await session.execute(stmt)
    return res.scalar_one_or_none()
