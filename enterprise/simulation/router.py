"""Simulation router — Monte Carlo endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import service

router = APIRouter()


async def _get_session():
    raise RuntimeError("Override _get_session dependency in host app.")


class SimulationRequest(BaseModel):
    flag_key: str
    num_iterations: int = Field(10000, ge=1, le=100_000)
    num_users: int = Field(1000, ge=1, le=1_000_000)
    rollout_percentage: float = Field(100.0, ge=0.0, le=100.0)
    baseline_conversion_rate: float = Field(0.1, ge=0.0, le=1.0)
    treatment_effect: float = Field(0.05, ge=-1.0, le=10.0)
    environment: str = "production"
    description: Optional[str] = None


class SimulationResultResponse(BaseModel):
    run_id: str
    flag_key: str
    status: str
    mean_impact: float
    median_impact: float
    std_dev: float
    p5_impact: float
    p25_impact: float
    p75_impact: float
    p95_impact: float
    prob_positive: float
    prob_negative: float
    worst_case: float
    best_case: float
    created_at: str


@router.post("/run", response_model=SimulationResultResponse)
async def run_simulation(body: SimulationRequest, session=Depends(_get_session)):
    run, result = await service.run_simulation(
        session,
        flag_key=body.flag_key,
        num_iterations=body.num_iterations,
        num_users=body.num_users,
        rollout_percentage=body.rollout_percentage,
        baseline_conversion_rate=body.baseline_conversion_rate,
        treatment_effect=body.treatment_effect,
        environment=body.environment,
        description=body.description,
    )
    await session.commit()
    return SimulationResultResponse(
        run_id=run.id,
        flag_key=run.flag_key,
        status=run.status,
        mean_impact=result.mean_impact,
        median_impact=result.median_impact,
        std_dev=result.std_dev,
        p5_impact=result.p5_impact,
        p25_impact=result.p25_impact,
        p75_impact=result.p75_impact,
        p95_impact=result.p95_impact,
        prob_positive=result.prob_positive,
        prob_negative=result.prob_negative,
        worst_case=result.worst_case,
        best_case=result.best_case,
        created_at=result.created_at.isoformat(),
    )


@router.get("/results/{run_id}", response_model=SimulationResultResponse)
async def get_results(run_id: str, session=Depends(_get_session)):
    run = await service.get_run(session, run_id)
    if not run:
        raise HTTPException(404, "Simulation run not found")
    result = await service.get_result(session, run_id)
    if not result:
        raise HTTPException(404, "Results not yet available")
    return SimulationResultResponse(
        run_id=run.id,
        flag_key=run.flag_key,
        status=run.status,
        mean_impact=result.mean_impact,
        median_impact=result.median_impact,
        std_dev=result.std_dev,
        p5_impact=result.p5_impact,
        p25_impact=result.p25_impact,
        p75_impact=result.p75_impact,
        p95_impact=result.p95_impact,
        prob_positive=result.prob_positive,
        prob_negative=result.prob_negative,
        worst_case=result.worst_case,
        best_case=result.best_case,
        created_at=result.created_at.isoformat(),
    )
