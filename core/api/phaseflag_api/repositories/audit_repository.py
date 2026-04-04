"""Async SQLAlchemy queries for audit logs."""

import json
from typing import Any, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.audit import AuditLogDB


async def create_log(
    session: AsyncSession,
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    entity_key: str,
    actor: str = "system",
    changes: dict[str, Any] | None = None,
) -> AuditLogDB:
    log = AuditLogDB(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_key=entity_key,
        actor=actor,
        changes=json.dumps(changes or {}),
    )
    session.add(log)
    await session.flush()
    return log


async def list_logs(
    session: AsyncSession,
    *,
    entity_key: str | None = None,
    entity_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> Sequence[AuditLogDB]:
    stmt = select(AuditLogDB).order_by(AuditLogDB.timestamp.desc())
    if entity_key:
        stmt = stmt.where(AuditLogDB.entity_key == entity_key)
    if entity_type:
        stmt = stmt.where(AuditLogDB.entity_type == entity_type)
    stmt = stmt.limit(limit).offset(offset)
    result = await session.execute(stmt)
    return result.scalars().all()
