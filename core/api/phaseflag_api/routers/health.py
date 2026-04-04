"""Health-check endpoint."""

import asyncio
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api import __version__
from phaseflag_api.database import get_session

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check(session: AsyncSession = Depends(get_session)) -> JSONResponse:
    """Return health status with database connectivity check."""
    db_status = "connected"
    status_code = 200
    try:
        await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=5.0)
    except Exception as exc:
        logger.warning("Health check DB probe failed: %s", exc)
        db_status = "unreachable"
        status_code = 503

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ok" if status_code == 200 else "degraded",
            "version": __version__,
            "database": db_status,
        },
    )
