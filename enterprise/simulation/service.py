"""Simulation service — Monte Carlo traffic replay."""

from __future__ import annotations

import math
import random
import statistics
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import SimulationResult, SimulationRun


def _run_monte_carlo(
    num_iterations: int,
    num_users: int,
    rollout_pct: float,
    baseline_cr: float,
    treatment_effect: float,
) -> list[float]:
    """Run Monte Carlo simulation returning per-iteration impact values.

    Each iteration:
    1. Assign users to treatment (rollout_pct%) or control.
    2. Simulate conversions for each group using binomial draws.
    3. Compute the observed lift from treatment.
    """
    impacts: list[float] = []
    rollout_frac = rollout_pct / 100.0
    treatment_cr = baseline_cr * (1.0 + treatment_effect)
    treatment_cr = max(0.0, min(1.0, treatment_cr))

    for _ in range(num_iterations):
        n_treatment = int(num_users * rollout_frac)
        n_control = num_users - n_treatment

        # Binomial draws
        control_conversions = sum(1 for _ in range(n_control) if random.random() < baseline_cr) if n_control > 0 else 0
        treatment_conversions = sum(1 for _ in range(n_treatment) if random.random() < treatment_cr) if n_treatment > 0 else 0

        total_conversions = control_conversions + treatment_conversions

        # Baseline: all users at baseline_cr
        baseline_conversions = sum(1 for _ in range(num_users) if random.random() < baseline_cr)

        impact = total_conversions - baseline_conversions
        impacts.append(impact)

    return impacts


def _percentile(data: list[float], pct: float) -> float:
    """Calculate percentile from sorted data."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * (pct / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_data[int(k)]
    return sorted_data[f] * (c - k) + sorted_data[c] * (k - f)


async def run_simulation(
    session: AsyncSession,
    flag_key: str,
    num_iterations: int = 10000,
    num_users: int = 1000,
    rollout_percentage: float = 100.0,
    baseline_conversion_rate: float = 0.1,
    treatment_effect: float = 0.05,
    environment: str = "production",
    description: Optional[str] = None,
) -> tuple[SimulationRun, SimulationResult]:
    """Execute a full Monte Carlo simulation and persist results."""

    run = SimulationRun(
        id=str(uuid.uuid4()),
        flag_key=flag_key,
        environment=environment,
        description=description,
        num_iterations=num_iterations,
        num_users=num_users,
        rollout_percentage=rollout_percentage,
        baseline_conversion_rate=baseline_conversion_rate,
        treatment_effect=treatment_effect,
        status="running",
        created_at=datetime.utcnow(),
    )
    session.add(run)
    await session.flush()

    impacts = _run_monte_carlo(
        num_iterations, num_users, rollout_percentage,
        baseline_conversion_rate, treatment_effect,
    )

    mean_val = statistics.mean(impacts)
    median_val = statistics.median(impacts)
    std_val = statistics.stdev(impacts) if len(impacts) > 1 else 0.0

    result = SimulationResult(
        id=str(uuid.uuid4()),
        run_id=run.id,
        mean_impact=mean_val,
        median_impact=median_val,
        std_dev=std_val,
        p5_impact=_percentile(impacts, 5),
        p25_impact=_percentile(impacts, 25),
        p75_impact=_percentile(impacts, 75),
        p95_impact=_percentile(impacts, 95),
        prob_positive=sum(1 for i in impacts if i > 0) / len(impacts),
        prob_negative=sum(1 for i in impacts if i < 0) / len(impacts),
        worst_case=min(impacts),
        best_case=max(impacts),
        created_at=datetime.utcnow(),
    )
    session.add(result)

    run.status = "completed"
    run.completed_at = datetime.utcnow()
    await session.flush()

    return run, result


async def get_run(session: AsyncSession, run_id: str) -> Optional[SimulationRun]:
    stmt = select(SimulationRun).where(SimulationRun.id == run_id)
    res = await session.execute(stmt)
    return res.scalar_one_or_none()


async def get_result(session: AsyncSession, run_id: str) -> Optional[SimulationResult]:
    stmt = select(SimulationResult).where(SimulationResult.run_id == run_id)
    res = await session.execute(stmt)
    return res.scalar_one_or_none()
