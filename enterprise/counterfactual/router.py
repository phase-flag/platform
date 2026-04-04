"""Counterfactual router — causal inference endpoints."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from . import service

router = APIRouter()


async def _get_session():
    raise RuntimeError("Override _get_session dependency in host app.")


class Observation(BaseModel):
    user_id: str
    variation: str
    outcome: float
    propensity: Optional[float] = None


class CounterfactualRequest(BaseModel):
    flag_key: str
    original_variation: str
    counterfactual_variation: str
    metric_name: str
    historical_data: List[Observation]
    environment: str = "production"
    description: Optional[str] = None
    method: str = "auto"  # "auto", "difference_in_means", "ipw"


class CounterfactualResponse(BaseModel):
    query_id: str
    flag_key: str
    estimated_effect: float
    confidence_interval_low: float
    confidence_interval_high: float
    original_mean: float
    counterfactual_mean: float
    sample_size: int
    method: str
    summary: str
    created_at: str


@router.post("/analyze", response_model=CounterfactualResponse)
async def analyze(body: CounterfactualRequest, session=Depends(_get_session)):
    hist = [o.model_dump() for o in body.historical_data]
    query, result = await service.run_counterfactual(
        session,
        flag_key=body.flag_key,
        original_variation=body.original_variation,
        counterfactual_variation=body.counterfactual_variation,
        metric_name=body.metric_name,
        historical_data=hist,
        environment=body.environment,
        description=body.description,
        method=body.method,
    )
    await session.commit()
    return CounterfactualResponse(
        query_id=query.id,
        flag_key=body.flag_key,
        estimated_effect=result.estimated_effect,
        confidence_interval_low=result.confidence_interval_low,
        confidence_interval_high=result.confidence_interval_high,
        original_mean=result.original_mean,
        counterfactual_mean=result.counterfactual_mean,
        sample_size=result.sample_size,
        method=result.method,
        summary=result.summary,
        created_at=result.created_at.isoformat(),
    )


@router.get("/results/{query_id}", response_model=CounterfactualResponse)
async def get_result(query_id: str, session=Depends(_get_session)):
    result = await service.get_result(session, query_id)
    if not result:
        raise HTTPException(404, "Counterfactual result not found")
    return CounterfactualResponse(
        query_id=result.query_id,
        flag_key="",  # query_id is the lookup key
        estimated_effect=result.estimated_effect,
        confidence_interval_low=result.confidence_interval_low,
        confidence_interval_high=result.confidence_interval_high,
        original_mean=result.original_mean,
        counterfactual_mean=result.counterfactual_mean,
        sample_size=result.sample_size,
        method=result.method,
        summary=result.summary,
        created_at=result.created_at.isoformat(),
    )
