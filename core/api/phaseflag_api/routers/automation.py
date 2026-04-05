"""Flag lifecycle automation endpoints — stale detection, auto-archival, bulk ops."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import get_current_user, require_api_key, require_role
from phaseflag_api.services import automation_service

router = APIRouter(dependencies=[Depends(require_api_key)])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class DetectStaleRequest(BaseModel):
    threshold_days: int = Field(90, ge=1, le=730)


class DetectStaleResponse(BaseModel):
    stale_count: int
    threshold_days: int
    flags: list[dict]


class AutoArchiveResponse(BaseModel):
    archived_count: int
    flags: list[dict]


class CleanupReportResponse(BaseModel):
    generated_at: str
    filter_team: str | None
    stale_count: int
    stale_flags: list[dict]
    team_scorecard: list[dict]
    trend: dict


class BulkArchiveRequest(BaseModel):
    flag_keys: list[str] = Field(..., min_length=1)


class BulkArchiveResponse(BaseModel):
    archived_count: int
    archived: list[str]
    already_archived: list[str]
    not_found: list[str]


class FlagHealthResponse(BaseModel):
    """Tech debt dashboard metrics."""

    total_stale: int
    total_expired: int
    total_archived: int
    by_team: list[dict]
    generated_at: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/automation/detect-stale",
    response_model=DetectStaleResponse,
    dependencies=[require_role("editor")],
    tags=["automation"],
)
async def detect_stale(
    body: DetectStaleRequest,
    session: AsyncSession = Depends(get_session),
):
    """Trigger stale flag detection — finds flags with no evaluations in N days."""
    flags = await automation_service.detect_stale_flags(session, threshold_days=body.threshold_days)
    return DetectStaleResponse(
        stale_count=len(flags),
        threshold_days=body.threshold_days,
        flags=flags,
    )


@router.post(
    "/automation/auto-archive",
    response_model=AutoArchiveResponse,
    dependencies=[require_role("admin")],
    tags=["automation"],
)
async def auto_archive(session: AsyncSession = Depends(get_session)):
    """Trigger auto-archival of expired flags (with 7-day grace period)."""
    archived_flags = await automation_service.auto_archive_expired(session)
    await session.commit()
    return AutoArchiveResponse(archived_count=len(archived_flags), flags=archived_flags)


@router.get(
    "/automation/cleanup-report",
    response_model=CleanupReportResponse,
    tags=["automation"],
)
async def cleanup_report(
    team: str | None = Query(None, description="Filter by owner team"),
    session: AsyncSession = Depends(get_session),
):
    """Get cleanup report with tech debt metrics grouped by team."""
    report = await automation_service.generate_cleanup_report(session, team=team)
    return CleanupReportResponse(**report)


@router.post(
    "/automation/bulk-archive",
    response_model=BulkArchiveResponse,
    dependencies=[require_role("editor")],
    tags=["automation"],
)
async def bulk_archive(
    body: BulkArchiveRequest,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Archive multiple flags at once."""
    result = await automation_service.bulk_archive(
        session,
        flag_keys=body.flag_keys,
        actor=user.get("email", "system"),
    )
    await session.commit()
    return BulkArchiveResponse(**result)


@router.get(
    "/reporting/flag-health",
    response_model=FlagHealthResponse,
    tags=["reporting"],
)
async def flag_health(session: AsyncSession = Depends(get_session)):
    """Tech debt dashboard — stale, expired, and archived flag counts by team."""
    report = await automation_service.generate_cleanup_report(session)
    scorecard = report.get("team_scorecard", [])
    trend = report.get("trend", {})

    return FlagHealthResponse(
        total_stale=trend.get("stale_90d_total", 0),
        total_expired=trend.get("expired_total", 0),
        total_archived=trend.get("archived_total", 0),
        by_team=scorecard,
        generated_at=report["generated_at"],
    )
