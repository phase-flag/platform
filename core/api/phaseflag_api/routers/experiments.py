"""Experiment management endpoints."""


from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import get_current_user, require_api_key, require_role
from phaseflag_api.services import experiment_service

router = APIRouter(dependencies=[Depends(require_api_key)])


class GoalIn(BaseModel):
    name: str
    metric_key: str
    description: str | None = None
    goal_type: str = "conversion"
    is_primary: bool = False
    min_sample_size: int | None = None


class ExperimentCreate(BaseModel):
    key: str
    name: str
    flag_key: str
    description: str | None = None
    hypothesis: str | None = None
    experiment_type: str = Field("ab", examples=["ab"])
    traffic_percentage: int = Field(100, ge=1, le=100)
    goals: list[GoalIn] | None = None


class GoalOut(BaseModel):
    id: str
    name: str
    metric_key: str
    goal_type: str
    is_primary: bool


class ResultOut(BaseModel):
    id: str
    variation_key: str
    sample_size: int
    conversions: int
    conversion_rate: float | None
    confidence_level: float | None
    is_significant: bool
    is_winner: bool
    lift: float | None


class ExperimentOut(BaseModel):
    id: str
    key: str
    name: str
    description: str | None
    flag_key: str
    hypothesis: str | None
    status: str
    experiment_type: str
    traffic_percentage: int
    start_date: str | None
    end_date: str | None
    goals: list[GoalOut]
    results: list[ResultOut]
    created_by: str
    created_at: str


class PaginatedExperiments(BaseModel):
    items: list[ExperimentOut]
    total: int


class RecordResultRequest(BaseModel):
    variation_key: str
    sample_size: int = Field(..., ge=0)
    conversions: int = Field(..., ge=0)
    goal_id: str | None = None


class SampleSizeRequest(BaseModel):
    baseline_rate: float = Field(..., gt=0, lt=1, examples=[0.1])
    min_detectable_effect: float = Field(..., gt=0, examples=[0.05])
    confidence: float = Field(0.95, ge=0.8, le=0.99)
    power: float = Field(0.8, ge=0.5, le=0.99)


class SignificanceRequest(BaseModel):
    control_conversions: int = Field(..., ge=0)
    control_size: int = Field(..., ge=1)
    treatment_conversions: int = Field(..., ge=0)
    treatment_size: int = Field(..., ge=1)
    confidence_threshold: float = Field(0.95)


class BayesianRequest(BaseModel):
    control_conversions: int = Field(..., ge=0)
    control_total: int = Field(..., ge=1)
    treatment_conversions: int = Field(..., ge=0)
    treatment_total: int = Field(..., ge=1)
    num_samples: int = Field(10000, ge=1000, le=100000)


class SequentialDayEntry(BaseModel):
    day: int
    control_conv: int = Field(..., ge=0)
    control_total: int = Field(..., ge=0)
    treatment_conv: int = Field(..., ge=0)
    treatment_total: int = Field(..., ge=0)
    planned_total: int = Field(1000, ge=1)


class SequentialRequest(BaseModel):
    conversions_over_time: list[SequentialDayEntry]


class PowerAnalysisRequest(BaseModel):
    baseline_rate: float = Field(..., gt=0, lt=1, examples=[0.1])
    minimum_detectable_effect: float = Field(..., gt=0, examples=[0.05])
    alpha: float = Field(0.05, gt=0, lt=1)
    power: float = Field(0.8, ge=0.5, le=0.99)


class InteractionsRequest(BaseModel):
    experiment_keys: list[str] = Field(..., min_length=2)


class HoldoutGroupRequest(BaseModel):
    name: str
    percentage: int = Field(..., ge=1, le=50)
    experiment_keys: list[str] = Field(..., min_length=1)


def _exp_to_out(exp) -> ExperimentOut:
    return ExperimentOut(
        id=exp.id, key=exp.key, name=exp.name, description=exp.description,
        flag_key=exp.flag_key, hypothesis=exp.hypothesis, status=exp.status,
        experiment_type=exp.experiment_type, traffic_percentage=exp.traffic_percentage,
        start_date=exp.start_date.isoformat() if exp.start_date else None,
        end_date=exp.end_date.isoformat() if exp.end_date else None,
        goals=[GoalOut(id=g.id, name=g.name, metric_key=g.metric_key, goal_type=g.goal_type, is_primary=g.is_primary) for g in exp.goals],
        results=[ResultOut(
            id=r.id, variation_key=r.variation_key, sample_size=r.sample_size,
            conversions=r.conversions, conversion_rate=r.conversion_rate,
            confidence_level=r.confidence_level, is_significant=r.is_significant,
            is_winner=r.is_winner, lift=r.lift,
        ) for r in exp.results],
        created_by=exp.created_by, created_at=exp.created_at.isoformat(),
    )


@router.post("/experiments", response_model=ExperimentOut, status_code=201, dependencies=[require_role("editor")])
async def create_experiment(body: ExperimentCreate, user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    goals = [g.model_dump() for g in body.goals] if body.goals else None
    exp = await experiment_service.create_experiment(
        session, key=body.key, name=body.name, flag_key=body.flag_key,
        description=body.description, hypothesis=body.hypothesis,
        experiment_type=body.experiment_type, traffic_percentage=body.traffic_percentage,
        goals=goals, created_by=user.get("email", "system"),
    )
    return _exp_to_out(exp)


@router.get("/experiments", response_model=PaginatedExperiments)
async def list_experiments(
    status_filter: str | None = Query(None, alias="status"),
    flag_key: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    items, total = await experiment_service.list_experiments(session, status_filter=status_filter, flag_key=flag_key, limit=limit, offset=offset)
    return PaginatedExperiments(items=[_exp_to_out(e) for e in items], total=total)


@router.get("/experiments/{key}", response_model=ExperimentOut)
async def get_experiment(key: str, session: AsyncSession = Depends(get_session)):
    exp = await experiment_service.get_experiment_by_key(session, key)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return _exp_to_out(exp)


@router.post("/experiments/{key}/start", response_model=ExperimentOut, dependencies=[require_role("editor")])
async def start_experiment(key: str, session: AsyncSession = Depends(get_session)):
    exp = await experiment_service.get_experiment_by_key(session, key)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    updated = await experiment_service.start_experiment(session, exp)
    return _exp_to_out(updated)


@router.post("/experiments/{key}/stop", response_model=ExperimentOut, dependencies=[require_role("editor")])
async def stop_experiment(key: str, session: AsyncSession = Depends(get_session)):
    exp = await experiment_service.get_experiment_by_key(session, key)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    updated = await experiment_service.stop_experiment(session, exp)
    return _exp_to_out(updated)


@router.post("/experiments/{key}/pause", response_model=ExperimentOut, dependencies=[require_role("editor")])
async def pause_experiment(key: str, session: AsyncSession = Depends(get_session)):
    exp = await experiment_service.get_experiment_by_key(session, key)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    updated = await experiment_service.pause_experiment(session, exp)
    return _exp_to_out(updated)


@router.post("/experiments/{key}/results", response_model=ResultOut, status_code=201, dependencies=[require_role("editor")])
async def record_result(key: str, body: RecordResultRequest, session: AsyncSession = Depends(get_session)):
    exp = await experiment_service.get_experiment_by_key(session, key)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
    result = await experiment_service.record_result(
        session, exp, variation_key=body.variation_key,
        sample_size=body.sample_size, conversions=body.conversions, goal_id=body.goal_id,
    )
    return ResultOut(
        id=result.id, variation_key=result.variation_key, sample_size=result.sample_size,
        conversions=result.conversions, conversion_rate=result.conversion_rate,
        confidence_level=result.confidence_level, is_significant=result.is_significant,
        is_winner=result.is_winner, lift=result.lift,
    )


@router.post("/experiments/calculate/significance")
async def calculate_significance(body: SignificanceRequest):
    return experiment_service.calculate_significance(
        body.control_conversions, body.control_size,
        body.treatment_conversions, body.treatment_size,
        body.confidence_threshold,
    )


@router.post("/experiments/calculate/sample-size")
async def calculate_sample_size(body: SampleSizeRequest):
    n = experiment_service.calculate_sample_size(
        body.baseline_rate, body.min_detectable_effect,
        body.confidence, body.power,
    )
    return {"sample_size_per_variation": n, "total_sample_size": n * 2}


@router.post("/experiments/analyze/bayesian")
async def bayesian_analysis(body: BayesianRequest):
    return experiment_service.bayesian_ab_test(
        body.control_conversions, body.control_total,
        body.treatment_conversions, body.treatment_total,
        body.num_samples,
    )


@router.post("/experiments/analyze/sequential")
async def sequential_analysis(body: SequentialRequest):
    return experiment_service.sequential_test(
        [entry.model_dump() for entry in body.conversions_over_time],
    )


@router.post("/experiments/analyze/power")
async def power_analysis(body: PowerAnalysisRequest):
    return experiment_service.power_analysis(
        body.baseline_rate, body.minimum_detectable_effect,
        body.alpha, body.power,
    )


@router.post("/experiments/interactions")
async def detect_interactions(body: InteractionsRequest, session: AsyncSession = Depends(get_session)):
    return await experiment_service.detect_experiment_interactions(session, body.experiment_keys)


@router.post("/experiments/holdout-groups", status_code=201)
async def create_holdout_group(body: HoldoutGroupRequest, session: AsyncSession = Depends(get_session)):
    return await experiment_service.create_holdout_group(
        session, body.name, body.percentage, body.experiment_keys,
    )
