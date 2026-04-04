"""Progressive delivery pipeline endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import get_current_user, require_api_key, require_role
from phaseflag_api.services import rollout_service

router = APIRouter(dependencies=[Depends(require_api_key)])


class StageIn(BaseModel):
    name: str
    rollout_percentage: int = Field(..., ge=0, le=100)
    duration_minutes: int | None = None
    health_check_url: str | None = None
    success_threshold: float | None = None


class PipelineCreate(BaseModel):
    flag_key: str
    name: str
    description: str | None = None
    template: str | None = Field(None, examples=["canary"])
    stages: list[StageIn] | None = None
    environment: str | None = None


class StageOut(BaseModel):
    id: str
    stage_order: int
    name: str
    rollout_percentage: int
    duration_minutes: int | None
    status: str
    started_at: str | None
    completed_at: str | None


class PipelineOut(BaseModel):
    id: str
    flag_key: str
    name: str
    description: str | None
    status: str
    current_stage_index: int
    template: str | None
    stages: list[StageOut]
    created_by: str
    created_at: str
    completed_at: str | None


class PaginatedPipelines(BaseModel):
    items: list[PipelineOut]
    total: int


def _pipeline_to_out(p) -> PipelineOut:
    return PipelineOut(
        id=p.id, flag_key=p.flag_key, name=p.name, description=p.description,
        status=p.status, current_stage_index=p.current_stage_index,
        template=p.template, created_by=p.created_by,
        created_at=p.created_at.isoformat(),
        completed_at=p.completed_at.isoformat() if p.completed_at else None,
        stages=[
            StageOut(
                id=s.id, stage_order=s.stage_order, name=s.name,
                rollout_percentage=s.rollout_percentage,
                duration_minutes=s.duration_minutes, status=s.status,
                started_at=s.started_at.isoformat() if s.started_at else None,
                completed_at=s.completed_at.isoformat() if s.completed_at else None,
            )
            for s in sorted(p.stages, key=lambda s: s.stage_order)
        ],
    )


@router.post("/rollouts", response_model=PipelineOut, status_code=201, dependencies=[require_role("editor")])
async def create_pipeline(
    body: PipelineCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    stages = [s.model_dump() for s in body.stages] if body.stages else None
    pipeline = await rollout_service.create_pipeline(
        session, flag_key=body.flag_key, name=body.name,
        description=body.description, template=body.template,
        stages=stages, environment=body.environment,
        created_by=user.get("email", "system"),
    )
    return _pipeline_to_out(pipeline)


@router.get("/rollouts", response_model=PaginatedPipelines)
async def list_pipelines(
    flag_key: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    items, total = await rollout_service.list_pipelines(session, flag_key, limit=limit, offset=offset)
    return PaginatedPipelines(items=[_pipeline_to_out(p) for p in items], total=total)


@router.get("/rollouts/templates")
async def list_templates():
    """Return available rollout templates with full details."""
    return rollout_service.ROLLOUT_TEMPLATES_DETAILED


@router.get("/rollouts/{pipeline_id}", response_model=PipelineOut)
async def get_pipeline(pipeline_id: str, session: AsyncSession = Depends(get_session)):
    p = await rollout_service.get_pipeline(session, pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return _pipeline_to_out(p)


@router.post("/rollouts/{pipeline_id}/advance", response_model=PipelineOut, dependencies=[require_role("editor")])
async def advance_pipeline(pipeline_id: str, session: AsyncSession = Depends(get_session)):
    p = await rollout_service.get_pipeline(session, pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    updated = await rollout_service.advance_pipeline(session, p)
    return _pipeline_to_out(updated)


@router.post("/rollouts/{pipeline_id}/pause", response_model=PipelineOut, dependencies=[require_role("editor")])
async def pause_pipeline(pipeline_id: str, session: AsyncSession = Depends(get_session)):
    p = await rollout_service.get_pipeline(session, pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    updated = await rollout_service.pause_pipeline(session, p)
    return _pipeline_to_out(updated)


@router.post("/rollouts/{pipeline_id}/resume", response_model=PipelineOut, dependencies=[require_role("editor")])
async def resume_pipeline(pipeline_id: str, session: AsyncSession = Depends(get_session)):
    p = await rollout_service.get_pipeline(session, pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    updated = await rollout_service.resume_pipeline(session, p)
    return _pipeline_to_out(updated)


@router.post("/rollouts/{pipeline_id}/rollback", response_model=PipelineOut, dependencies=[require_role("editor")])
async def rollback_pipeline(pipeline_id: str, session: AsyncSession = Depends(get_session)):
    p = await rollout_service.get_pipeline(session, pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    updated = await rollout_service.rollback_pipeline(session, p)
    return _pipeline_to_out(updated)


@router.post("/rollouts/{pipeline_id}/auto-advance", dependencies=[require_role("editor")])
async def auto_advance(pipeline_id: str, session: AsyncSession = Depends(get_session)):
    """Check if the current stage duration has elapsed and auto-advance if so."""
    result = await rollout_service.auto_advance_pipeline(session, pipeline_id)
    return result


class RollbackTriggersBody(BaseModel):
    metrics: dict[str, float] = Field(..., examples=[{"error_rate": 0.05, "latency_p99": 1200}])


@router.post("/rollouts/{pipeline_id}/check-triggers")
async def check_rollback_triggers(
    pipeline_id: str,
    body: RollbackTriggersBody,
    session: AsyncSession = Depends(get_session),
):
    """Check rollback triggers against provided metrics."""
    result = await rollout_service.check_rollback_triggers(session, pipeline_id, body.metrics)
    return result
