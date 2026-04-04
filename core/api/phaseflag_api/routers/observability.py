"""Observability endpoints — system metrics, flag health, and debugging."""

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.services import analytics_service, observability_service

router = APIRouter(dependencies=[Depends(require_api_key)])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class IncidentCorrelation(BaseModel):
    flag_key: str
    incident_id: str
    description: str
    timestamp: str | None = None


# ---------------------------------------------------------------------------
# Existing endpoints
# ---------------------------------------------------------------------------

@router.get("/metrics")
async def get_system_metrics(session: AsyncSession = Depends(get_session)):
    """Return system-wide metrics for monitoring dashboards."""
    return await observability_service.get_system_metrics(session)


@router.get("/metrics/requests")
async def get_request_metrics():
    """Return HTTP request metrics (latency, throughput, error rates)."""
    from phaseflag_api.middleware.telemetry import get_metrics
    return get_metrics()


@router.get("/metrics/cache")
async def get_cache_metrics():
    """Return cache hit/miss/eviction rates."""
    return observability_service.get_cache_metrics()


@router.get("/metrics/sync")
async def get_sync_metrics():
    """Return sync lag metrics (last sync, average lag, sync count)."""
    return observability_service.get_sync_metrics()


@router.get("/flags/{flag_key}/health")
async def get_flag_health(flag_key: str, session: AsyncSession = Depends(get_session)):
    """Return health metrics and recent activity for a specific flag."""
    return await observability_service.get_flag_health(session, flag_key)


@router.get("/flags/{flag_key}/rollout-timeline")
async def get_rollout_timeline(flag_key: str, session: AsyncSession = Depends(get_session)):
    """Get the rollout progression timeline for a flag."""
    return await observability_service.get_rollout_timeline(session, flag_key)


@router.post("/incidents/correlate", status_code=201, dependencies=[require_role("editor")])
async def correlate_incident(body: IncidentCorrelation):
    """Correlate a flag change with an incident for root-cause analysis."""
    return observability_service.correlate_incident(
        flag_key=body.flag_key,
        incident_id=body.incident_id,
        description=body.description,
        timestamp=body.timestamp,
    )


@router.get("/incidents")
async def list_incidents(flag_key: str | None = Query(None)):
    """List incident correlations, optionally filtered by flag key."""
    return observability_service.get_incident_correlations(flag_key)


@router.get("/users/{user_id}/flags")
async def inspect_user_flags(user_id: str, session: AsyncSession = Depends(get_session)):
    """Inspect all flag evaluations for a specific user."""
    return await observability_service.inspect_user_flags(session, user_id)


@router.get("/inventory")
async def get_flag_inventory(session: AsyncSession = Depends(get_session)):
    """Return a comprehensive inventory of all flags by status, lifecycle, type."""
    return await analytics_service.get_flag_inventory(session)


@router.get("/trends")
async def get_evaluation_trends(
    days: int = Query(7, ge=1, le=90),
    session: AsyncSession = Depends(get_session),
):
    """Return daily evaluation count trends."""
    return await analytics_service.get_evaluation_trends(session, days=days)
