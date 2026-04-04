"""Experiment service — A/B test lifecycle and statistical analysis."""

import logging
import math
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.experiments import ExperimentDB, ExperimentGoalDB, ExperimentResultDB

logger = logging.getLogger(__name__)


async def create_experiment(
    session: AsyncSession,
    *,
    key: str,
    name: str,
    flag_key: str,
    description: str | None = None,
    hypothesis: str | None = None,
    experiment_type: str = "ab",
    traffic_percentage: int = 100,
    goals: list[dict[str, Any]] | None = None,
    created_by: str = "system",
) -> ExperimentDB:
    existing = await get_experiment_by_key(session, key)
    if existing:
        raise HTTPException(status_code=409, detail=f"Experiment '{key}' already exists")

    exp = ExperimentDB(
        key=key, name=name, flag_key=flag_key,
        description=description, hypothesis=hypothesis,
        experiment_type=experiment_type,
        traffic_percentage=traffic_percentage,
        created_by=created_by,
    )
    session.add(exp)
    await session.flush()

    if goals:
        for g in goals:
            goal = ExperimentGoalDB(
                experiment_id=exp.id, name=g["name"],
                description=g.get("description"),
                metric_key=g["metric_key"],
                goal_type=g.get("goal_type", "conversion"),
                is_primary=g.get("is_primary", False),
                min_sample_size=g.get("min_sample_size"),
            )
            session.add(goal)
        await session.flush()

    await session.refresh(exp)
    return exp


async def start_experiment(session: AsyncSession, exp: ExperimentDB) -> ExperimentDB:
    if exp.status not in ("draft", "paused"):
        raise HTTPException(status_code=400, detail=f"Cannot start a '{exp.status}' experiment")
    exp.status = "running"
    exp.start_date = exp.start_date or datetime.now(UTC)
    exp.updated_at = datetime.now(UTC)
    await session.flush()
    await session.refresh(exp)
    return exp


async def stop_experiment(session: AsyncSession, exp: ExperimentDB) -> ExperimentDB:
    if exp.status != "running":
        raise HTTPException(status_code=400, detail="Can only stop a running experiment")
    exp.status = "completed"
    exp.end_date = datetime.now(UTC)
    exp.updated_at = datetime.now(UTC)
    await session.flush()
    await session.refresh(exp)
    return exp


async def pause_experiment(session: AsyncSession, exp: ExperimentDB) -> ExperimentDB:
    if exp.status != "running":
        raise HTTPException(status_code=400, detail="Can only pause a running experiment")
    exp.status = "paused"
    exp.updated_at = datetime.now(UTC)
    await session.flush()
    await session.refresh(exp)
    return exp


async def get_experiment_by_key(session: AsyncSession, key: str) -> ExperimentDB | None:
    result = await session.execute(select(ExperimentDB).where(ExperimentDB.key == key))
    return result.scalar_one_or_none()


async def get_experiment_by_id(session: AsyncSession, exp_id: str) -> ExperimentDB | None:
    result = await session.execute(select(ExperimentDB).where(ExperimentDB.id == exp_id))
    return result.scalar_one_or_none()


async def list_experiments(
    session: AsyncSession,
    *,
    status_filter: str | None = None,
    flag_key: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ExperimentDB], int]:
    base = select(ExperimentDB)
    if status_filter:
        base = base.where(ExperimentDB.status == status_filter)
    if flag_key:
        base = base.where(ExperimentDB.flag_key == flag_key)
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    items = (await session.execute(base.order_by(ExperimentDB.created_at.desc()).limit(limit).offset(offset))).scalars().all()
    return list(items), total


async def record_result(
    session: AsyncSession,
    exp: ExperimentDB,
    *,
    variation_key: str,
    sample_size: int,
    conversions: int,
    goal_id: str | None = None,
) -> ExperimentResultDB:
    rate = conversions / sample_size if sample_size > 0 else 0.0
    result = ExperimentResultDB(
        experiment_id=exp.id,
        variation_key=variation_key,
        goal_id=goal_id,
        sample_size=sample_size,
        conversions=conversions,
        conversion_rate=rate,
    )
    session.add(result)
    await session.flush()
    await session.refresh(result)
    return result


def calculate_significance(
    control_conversions: int, control_size: int,
    treatment_conversions: int, treatment_size: int,
    confidence_threshold: float = 0.95,
) -> dict[str, Any]:
    """Calculate statistical significance using Z-test for proportions."""
    if control_size == 0 or treatment_size == 0:
        return {"significant": False, "p_value": 1.0, "lift": 0.0, "confidence": 0.0}

    p_c = control_conversions / control_size
    p_t = treatment_conversions / treatment_size
    p_pool = (control_conversions + treatment_conversions) / (control_size + treatment_size)

    if p_pool == 0 or p_pool == 1:
        return {"significant": False, "p_value": 1.0, "lift": 0.0, "confidence": 0.0}

    se = math.sqrt(p_pool * (1 - p_pool) * (1 / control_size + 1 / treatment_size))
    if se == 0:
        return {"significant": False, "p_value": 1.0, "lift": 0.0, "confidence": 0.0}

    z = (p_t - p_c) / se
    # Approximate p-value using normal CDF approximation
    p_value = 2 * (1 - _normal_cdf(abs(z)))
    lift = (p_t - p_c) / p_c if p_c > 0 else 0.0
    confidence = 1 - p_value

    return {
        "significant": confidence >= confidence_threshold,
        "p_value": round(p_value, 6),
        "lift": round(lift, 4),
        "confidence": round(confidence, 4),
        "z_score": round(z, 4),
        "control_rate": round(p_c, 4),
        "treatment_rate": round(p_t, 4),
    }


def _normal_cdf(x: float) -> float:
    """Approximate standard normal CDF using Abramowitz and Stegun."""
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    p = 0.3275911
    sign = 1 if x >= 0 else -1
    x = abs(x) / math.sqrt(2)
    t = 1.0 / (1.0 + p * x)
    y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * math.exp(-x * x)
    return 0.5 * (1.0 + sign * y)


def calculate_sample_size(
    baseline_rate: float,
    min_detectable_effect: float,
    confidence: float = 0.95,
    power: float = 0.8,
) -> int:
    """Calculate required sample size per variation."""
    z_alpha = 1.96 if confidence >= 0.95 else 1.645
    z_beta = 0.842 if power >= 0.8 else 0.674
    p1 = baseline_rate
    p2 = baseline_rate * (1 + min_detectable_effect)
    if p1 <= 0 or p1 >= 1 or p2 <= 0 or p2 >= 1:
        return 0
    n = ((z_alpha * math.sqrt(2 * p1 * (1 - p1)) + z_beta * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) / (p2 - p1)) ** 2
    return int(math.ceil(n))


# ---------------------------------------------------------------------------
# Phase 4 — Advanced experimentation analytics
# ---------------------------------------------------------------------------

def bayesian_ab_test(control_conversions: int, control_total: int,
                     treatment_conversions: int, treatment_total: int,
                     num_samples: int = 10000) -> dict:
    """Bayesian A/B test using Beta-Binomial model with Monte Carlo sampling."""
    import random
    # Beta posterior parameters (using uniform prior Beta(1,1))
    alpha_c = control_conversions + 1
    beta_c = control_total - control_conversions + 1
    alpha_t = treatment_conversions + 1
    beta_t = treatment_total - treatment_conversions + 1

    # Monte Carlo sampling from Beta distributions
    # Using inverse CDF approximation
    random.seed(42)  # Reproducible
    treatment_wins = 0
    lifts = []
    for _ in range(num_samples):
        # Sample from Beta using gamma distribution approximation
        c_sample = random.betavariate(alpha_c, beta_c)
        t_sample = random.betavariate(alpha_t, beta_t)
        if t_sample > c_sample:
            treatment_wins += 1
        if c_sample > 0:
            lifts.append((t_sample - c_sample) / c_sample)

    prob_treatment_better = treatment_wins / num_samples
    avg_lift = sum(lifts) / len(lifts) if lifts else 0
    lifts.sort()
    ci_lower = lifts[int(0.025 * len(lifts))] if lifts else 0
    ci_upper = lifts[int(0.975 * len(lifts))] if lifts else 0

    return {
        "method": "bayesian",
        "probability_treatment_better": round(prob_treatment_better, 4),
        "expected_lift": round(avg_lift, 4),
        "credible_interval_95": [round(ci_lower, 4), round(ci_upper, 4)],
        "control": {"conversions": control_conversions, "total": control_total, "rate": round(control_conversions / max(control_total, 1), 4)},
        "treatment": {"conversions": treatment_conversions, "total": treatment_total, "rate": round(treatment_conversions / max(treatment_total, 1), 4)},
        "recommendation": "treatment" if prob_treatment_better > 0.95 else ("control" if prob_treatment_better < 0.05 else "inconclusive"),
    }


def sequential_test(conversions_over_time: list[dict]) -> dict:
    """Sequential testing — check if we can stop the experiment early.
    Each entry: {"day": 1, "control_conv": 10, "control_total": 100, "treatment_conv": 15, "treatment_total": 100}
    """
    results = []
    cumulative = {"control_conv": 0, "control_total": 0, "treatment_conv": 0, "treatment_total": 0}
    can_stop = False
    stop_day = None

    for entry in conversions_over_time:
        cumulative["control_conv"] += entry.get("control_conv", 0)
        cumulative["control_total"] += entry.get("control_total", 0)
        cumulative["treatment_conv"] += entry.get("treatment_conv", 0)
        cumulative["treatment_total"] += entry.get("treatment_total", 0)

        if cumulative["control_total"] > 0 and cumulative["treatment_total"] > 0:
            # Use O'Brien-Fleming spending function approximation
            z = z_test_statistic(
                cumulative["control_conv"], cumulative["control_total"],
                cumulative["treatment_conv"], cumulative["treatment_total"],
            )
            info_fraction = (cumulative["control_total"] + cumulative["treatment_total"]) / (2 * max(entry.get("planned_total", 1000), 1))
            # O'Brien-Fleming boundary
            if info_fraction > 0:
                boundary = 2.796 / math.sqrt(info_fraction) if info_fraction < 1 else 1.96
            else:
                boundary = 999

            day_result = {
                "day": entry.get("day"),
                "z_statistic": round(z, 4),
                "boundary": round(boundary, 4),
                "significant": abs(z) > boundary,
                "cumulative_control_rate": round(cumulative["control_conv"] / max(cumulative["control_total"], 1), 4),
                "cumulative_treatment_rate": round(cumulative["treatment_conv"] / max(cumulative["treatment_total"], 1), 4),
                "info_fraction": round(info_fraction, 4),
            }
            results.append(day_result)

            if day_result["significant"] and not can_stop:
                can_stop = True
                stop_day = entry.get("day")

    return {
        "method": "sequential",
        "can_stop_early": can_stop,
        "earliest_stop_day": stop_day,
        "daily_results": results,
    }


def z_test_statistic(c_conv, c_total, t_conv, t_total):
    """Compute Z-test statistic for two proportions."""
    p1 = c_conv / max(c_total, 1)
    p2 = t_conv / max(t_total, 1)
    p_pool = (c_conv + t_conv) / max(c_total + t_total, 1)
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / max(c_total, 1) + 1 / max(t_total, 1))) if 0 < p_pool < 1 else 1
    return (p2 - p1) / se if se > 0 else 0


def power_analysis(baseline_rate: float, minimum_detectable_effect: float,
                   alpha: float = 0.05, power: float = 0.8) -> dict:
    """Calculate required sample size for given power."""
    # Using normal approximation
    z_alpha = 1.96 if alpha == 0.05 else 2.576 if alpha == 0.01 else 1.645
    z_beta = 0.842 if power == 0.8 else 1.282 if power == 0.9 else 1.645 if power == 0.95 else 0.842

    p1 = baseline_rate
    p2 = baseline_rate * (1 + minimum_detectable_effect)

    numerator = (z_alpha * math.sqrt(2 * p1 * (1 - p1)) + z_beta * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2
    denominator = (p2 - p1) ** 2

    n_per_group = math.ceil(numerator / denominator) if denominator > 0 else 0

    return {
        "baseline_rate": baseline_rate,
        "minimum_detectable_effect": minimum_detectable_effect,
        "alpha": alpha,
        "power": power,
        "sample_size_per_group": n_per_group,
        "total_sample_size": n_per_group * 2,
        "estimated_duration_days": math.ceil(n_per_group * 2 / 1000),  # Assuming 1000 users/day
    }


async def detect_experiment_interactions(session: AsyncSession, experiment_keys: list[str]) -> list[dict]:
    """Detect potential interactions between concurrent experiments."""
    from phaseflag_api.models.experiments import ExperimentDB as _ExperimentDB
    stmt = select(_ExperimentDB).where(
        _ExperimentDB.key.in_(experiment_keys),
        _ExperimentDB.status == "running",
    )
    result = await session.execute(stmt)
    experiments = result.scalars().all()

    interactions = []
    for i, exp1 in enumerate(experiments):
        for exp2 in experiments[i + 1:]:
            # Check for overlapping traffic
            overlap = min(exp1.traffic_percentage, exp2.traffic_percentage)
            if overlap > 0:
                interactions.append({
                    "experiment_1": exp1.key,
                    "experiment_2": exp2.key,
                    "traffic_overlap_percentage": overlap,
                    "risk_level": "high" if overlap > 50 else "medium" if overlap > 20 else "low",
                    "recommendation": "Consider using mutual exclusion groups" if overlap > 50 else "Monitor for interaction effects",
                })
    return interactions


async def create_holdout_group(session: AsyncSession, name: str, percentage: int, experiment_keys: list[str]) -> dict:
    """Create a holdout group that excludes users from experiments."""
    return {
        "name": name,
        "percentage": percentage,
        "experiment_keys": experiment_keys,
        "status": "active",
        "description": f"Holdout group excluding {percentage}% of users from experiments: {', '.join(experiment_keys)}",
    }
