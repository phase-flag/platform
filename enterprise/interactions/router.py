"""Interactions router — flag interaction detection endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from . import service

router = APIRouter()


async def _get_session():
    raise RuntimeError("Override _get_session dependency in host app.")


class ObservationData(BaseModel):
    flags: Dict[str, str]  # flag_key -> variation
    outcome: float = 1.0


class DetectRequest(BaseModel):
    flag_keys: List[str]
    observations: List[ObservationData]
    metric_name: str = "conversion"
    environment: str = "production"
    significance_level: float = 0.05


class InteractionResultResponse(BaseModel):
    id: str
    flag_a: str
    flag_b: str
    chi_squared: float
    degrees_of_freedom: int
    p_value: float
    cramers_v: float
    is_significant: bool
    effect_size: str
    summary: str


class DetectResponse(BaseModel):
    test_id: str
    num_observations: int
    num_pairs: int
    significant_interactions: int
    results: List[InteractionResultResponse]


@router.post("/detect", response_model=DetectResponse)
async def detect_interactions(body: DetectRequest, session=Depends(_get_session)):
    obs = [o.model_dump() for o in body.observations]
    test, results = await service.detect_interactions(
        session,
        flag_keys=body.flag_keys,
        observations=obs,
        metric_name=body.metric_name,
        environment=body.environment,
        significance_level=body.significance_level,
    )
    await session.commit()

    result_responses = [
        InteractionResultResponse(
            id=r.id, flag_a=r.flag_a, flag_b=r.flag_b,
            chi_squared=r.chi_squared, degrees_of_freedom=r.degrees_of_freedom,
            p_value=r.p_value, cramers_v=r.cramers_v,
            is_significant=bool(r.is_significant),
            effect_size=r.effect_size, summary=r.summary,
        )
        for r in results
    ]

    return DetectResponse(
        test_id=test.id,
        num_observations=test.num_observations,
        num_pairs=len(results),
        significant_interactions=sum(1 for r in results if r.is_significant),
        results=result_responses,
    )


@router.get("/results/{test_id}", response_model=List[InteractionResultResponse])
async def get_results(test_id: str, session=Depends(_get_session)):
    results = await service.get_results(session, test_id)
    return [
        InteractionResultResponse(
            id=r.id, flag_a=r.flag_a, flag_b=r.flag_b,
            chi_squared=r.chi_squared, degrees_of_freedom=r.degrees_of_freedom,
            p_value=r.p_value, cramers_v=r.cramers_v,
            is_significant=bool(r.is_significant),
            effect_size=r.effect_size, summary=r.summary,
        )
        for r in results
    ]
