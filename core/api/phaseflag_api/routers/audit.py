"""Audit log endpoints."""

import json
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key
from phaseflag_api.repositories import audit_repository

router = APIRouter(dependencies=[Depends(require_api_key)])


class AuditLogOut(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: str
    entity_key: str
    actor: str
    changes: dict[str, Any]
    timestamp: str


def _log_to_out(log) -> AuditLogOut:
    return AuditLogOut(
        id=log.id,
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        entity_key=log.entity_key,
        actor=log.actor,
        changes=json.loads(log.changes) if log.changes else {},
        timestamp=log.timestamp.isoformat(),
    )


@router.get("/audit-logs", response_model=list[AuditLogOut])
async def list_audit_logs(
    entity_key: str | None = Query(None),
    entity_type: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    logs = await audit_repository.list_logs(
        session,
        entity_key=entity_key,
        entity_type=entity_type,
        limit=limit,
        offset=offset,
    )
    return [_log_to_out(log) for log in logs]


@router.get("/flags/{key}/audit-logs", response_model=list[AuditLogOut])
async def list_flag_audit_logs(
    key: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    logs = await audit_repository.list_logs(
        session,
        entity_key=key,
        entity_type="flag",
        limit=limit,
        offset=offset,
    )
    return [_log_to_out(log) for log in logs]
