"""Analytics router — A/B testing endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .service import get_results, run_bayesian_test, run_frequentist_test, store_metric

router = APIRouter()


# ---------------------------------------------------------------------------
# Dependency — async session placeholder
# ---------------------------------------------------------------------------

async def _get_session():
    """Yield an AsyncSession.

    The host application must override this dependency with its own session
    factory via ``router.dependency_overrides``.
    """
    raise RuntimeError(
        "enterprise.analytics requires a database session dependency. "
        "Override _get_session in the host application."
    )


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ABTestRequest(BaseModel):
    experiment_id: str
    test_type: str = Field("frequentist", pattern="^(frequentist|bayesian)$")
    variant_a_name: str = "control"
    variant_b_name: str = "treatment"
    variant_a_count: int
    variant_a_successes: int
    variant_b_count: int
    variant_b_successes: int


class ABTestResponse(BaseModel):
    id: str
    experiment_id: str
    test_type: str
    variant_a_name: str
    variant_b_name: str
    variant_a_count: int
    variant_a_successes: int
    variant_b_count: int
    variant_b_successes: int
    p_value: Optional[float] = None
    z_score: Optional[float] = None
    confidence_level: Optional[float] = None
    prob_b_beats_a: Optional[float] = None
    expected_loss: Optional[float] = None
    credible_interval_low: Optional[float] = None
    credible_interval_high: Optional[float] = None
    is_significant: bool
    recommendation: Optional[str] = None
    created_at: str


class MetricSnapshotRequest(BaseModel):
    experiment_id: str
    variant: str
    metric_name: str
    metric_value: float
    sample_size: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_response(r) -> ABTestResponse:
    return ABTestResponse(
        id=r.id,
        experiment_id=r.experiment_id,
        test_type=r.test_type,
        variant_a_name=r.variant_a_name,
        variant_b_name=r.variant_b_name,
        variant_a_count=r.variant_a_count,
        variant_a_successes=r.variant_a_successes,
        variant_b_count=r.variant_b_count,
        variant_b_successes=r.variant_b_successes,
        p_value=r.p_value,
        z_score=r.z_score,
        confidence_level=r.confidence_level,
        prob_b_beats_a=r.prob_b_beats_a,
        expected_loss=r.expected_loss,
        credible_interval_low=r.credible_interval_low,
        credible_interval_high=r.credible_interval_high,
        is_significant=bool(r.is_significant),
        recommendation=r.recommendation,
        created_at=r.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/ab-test", response_model=ABTestResponse)
async def run_ab_test(body: ABTestRequest, session=Depends(_get_session)):
    if body.test_type == "bayesian":
        result = await run_bayesian_test(
            session,
            body.experiment_id,
            body.variant_a_count,
            body.variant_a_successes,
            body.variant_b_count,
            body.variant_b_successes,
            body.variant_a_name,
            body.variant_b_name,
        )
    else:
        result = await run_frequentist_test(
            session,
            body.experiment_id,
            body.variant_a_count,
            body.variant_a_successes,
            body.variant_b_count,
            body.variant_b_successes,
            body.variant_a_name,
            body.variant_b_name,
        )
    await session.commit()
    return _to_response(result)


@router.get("/results/{experiment_id}", response_model=List[ABTestResponse])
async def list_results(experiment_id: str, session=Depends(_get_session)):
    results = await get_results(session, experiment_id)
    return [_to_response(r) for r in results]


@router.post("/metrics")
async def record_metric(body: MetricSnapshotRequest, session=Depends(_get_session)):
    snap = await store_metric(
        session,
        body.experiment_id,
        body.variant,
        body.metric_name,
        body.metric_value,
        body.sample_size,
    )
    await session.commit()
    return {"id": snap.id, "captured_at": snap.captured_at.isoformat()}
