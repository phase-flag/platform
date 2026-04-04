"""Analytics and reporting endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key
from phaseflag_api.services import analytics_service

router = APIRouter(dependencies=[Depends(require_api_key)])


@router.get("/reports/stale-flags")
async def stale_flag_report(session: AsyncSession = Depends(get_session)):
    return await analytics_service.get_stale_flag_report(session)


@router.get("/reports/releases")
async def release_dashboard(session: AsyncSession = Depends(get_session)):
    return await analytics_service.get_release_dashboard(session)


@router.get("/reports/environment-drift")
async def environment_drift(session: AsyncSession = Depends(get_session)):
    return await analytics_service.get_environment_drift(session)


@router.get("/reports/change-timeline")
async def change_timeline(days: int = Query(30, ge=1, le=365), session: AsyncSession = Depends(get_session)):
    return await analytics_service.get_change_activity_timeline(session, days)


@router.get("/reports/top-flags")
async def top_flags(limit: int = Query(20, ge=1, le=100), session: AsyncSession = Depends(get_session)):
    return await analytics_service.get_top_flags(session, limit)


@router.get("/reports/unowned-flags")
async def unowned_flags(session: AsyncSession = Depends(get_session)):
    return await analytics_service.get_flags_without_owners(session)


@router.get("/reports/expired-flags")
async def expired_flags(session: AsyncSession = Depends(get_session)):
    return await analytics_service.get_expired_flags(session)


@router.get("/reports/segment-usage")
async def segment_usage(session: AsyncSession = Depends(get_session)):
    return await analytics_service.get_segment_usage(session)
