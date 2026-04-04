"""Flag lifecycle management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import (
    get_current_user,
    require_api_key,
    require_role,
)
from phaseflag_api.repositories import flag_repository
from phaseflag_api.services import lifecycle_service

router = APIRouter(dependencies=[Depends(require_api_key)])


class LifecycleTransitionRequest(BaseModel):
    target_stage: str = Field(..., examples=["testing"])


class LifecycleTransitionResponse(BaseModel):
    flag_key: str
    old_stage: str
    new_stage: str
    status: str


class StaleFlag(BaseModel):
    key: str
    name: str
    last_evaluated_at: str | None
    owner: str
    owner_team: str | None = None


class ExpiringFlag(BaseModel):
    key: str
    name: str
    expires_at: str
    status: str


@router.post(
    "/flags/{key}/lifecycle/transition",
    response_model=LifecycleTransitionResponse,
    dependencies=[require_role("editor")],
)
async def transition_flag_lifecycle(
    key: str,
    body: LifecycleTransitionRequest,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Transition a flag to a new lifecycle stage."""
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found"
        )

    old_stage = flag.lifecycle_stage or "development"
    updated = await lifecycle_service.transition_lifecycle(
        session,
        flag,
        body.target_stage,
        actor=user.get("email", "system"),
    )

    return LifecycleTransitionResponse(
        flag_key=key,
        old_stage=old_stage,
        new_stage=updated.lifecycle_stage,
        status=updated.status,
    )


@router.get("/lifecycle/stale-flags", response_model=list[StaleFlag])
async def list_stale_flags(session: AsyncSession = Depends(get_session)):
    """List flags that haven't been evaluated in 30+ days."""
    stale = await lifecycle_service.check_stale_flags(session)
    return [StaleFlag(**f) for f in stale]


@router.get("/lifecycle/expiring-flags", response_model=list[ExpiringFlag])
async def list_expiring_flags(session: AsyncSession = Depends(get_session)):
    """List flags that are past their expiration date."""
    expired = await lifecycle_service.check_expiring_flags(session)
    return [ExpiringFlag(**f) for f in expired]


class StaleDetectionResponse(BaseModel):
    marked_stale: int
    flags: list[dict]


class ExpirationCheckResponse(BaseModel):
    archived: int
    flags: list[dict]


class CleanupTeamScore(BaseModel):
    owner_team: str
    stale_count: int
    expired_count: int
    archived_count: int
    total_count: int


@router.post(
    "/lifecycle/run-stale-detection",
    response_model=StaleDetectionResponse,
    dependencies=[require_role("admin")],
)
async def run_stale_detection(session: AsyncSession = Depends(get_session)):
    """Run stale detection: flags not updated in 90 days are marked stale."""
    marked = await lifecycle_service.run_stale_detection(session)
    return StaleDetectionResponse(marked_stale=len(marked), flags=marked)


@router.post(
    "/lifecycle/run-expiration-check",
    response_model=ExpirationCheckResponse,
    dependencies=[require_role("admin")],
)
async def run_expiration_check(session: AsyncSession = Depends(get_session)):
    """Run expiration check: flags past expires_at are auto-archived."""
    archived = await lifecycle_service.run_expiration_check(session)
    return ExpirationCheckResponse(archived=len(archived), flags=archived)


@router.get("/lifecycle/cleanup-scorecard", response_model=list[CleanupTeamScore])
async def cleanup_scorecard(session: AsyncSession = Depends(get_session)):
    """Return per-team counts of stale, expired, and archived flags."""
    scorecard = await lifecycle_service.run_cleanup_scorecard(session)
    return [CleanupTeamScore(**entry) for entry in scorecard]
