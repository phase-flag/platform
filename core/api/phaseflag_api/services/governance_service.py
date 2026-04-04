"""Governance service — change requests, approval workflows, freeze windows, break-glass."""

import json
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.governance import (
    BreakGlassEventDB,
    ChangeRequestDB,
    FreezeWindowDB,
    ServiceAccountDB,
)
from phaseflag_api.repositories import audit_repository

logger = logging.getLogger(__name__)


# --- Change Requests ---

async def create_change_request(
    session: AsyncSession,
    *,
    title: str,
    description: str | None,
    entity_type: str,
    entity_key: str,
    change_type: str,
    payload: dict[str, Any],
    requested_by: str,
    environment: str | None = None,
    requires_approval_count: int = 1,
) -> ChangeRequestDB:
    # Check for active freeze windows
    await _check_freeze_windows(session, environment)

    cr = ChangeRequestDB(
        title=title,
        description=description,
        entity_type=entity_type,
        entity_key=entity_key,
        change_type=change_type,
        payload=json.dumps(payload),
        requested_by=requested_by,
        environment=environment,
        requires_approval_count=requires_approval_count,
    )
    session.add(cr)
    await session.flush()
    await session.refresh(cr)

    await audit_repository.create_log(
        session,
        action="change_request_created",
        entity_type="change_request",
        entity_id=cr.id,
        entity_key=entity_key,
        actor=requested_by,
        changes={"title": title, "change_type": change_type},
    )

    return cr


async def approve_change_request(
    session: AsyncSession,
    cr: ChangeRequestDB,
    *,
    reviewer: str,
    comment: str | None = None,
) -> ChangeRequestDB:
    if cr.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve a '{cr.status}' change request")
    if cr.requested_by == reviewer:
        raise HTTPException(status_code=400, detail="Cannot approve your own change request")

    cr.approval_count += 1
    cr.reviewed_by = reviewer
    cr.review_comment = comment

    if cr.approval_count >= cr.requires_approval_count:
        cr.status = "approved"
        cr.resolved_at = datetime.now(UTC)

    await session.flush()
    await session.refresh(cr)

    await audit_repository.create_log(
        session,
        action="change_request_approved",
        entity_type="change_request",
        entity_id=cr.id,
        entity_key=cr.entity_key,
        actor=reviewer,
        changes={"approval_count": cr.approval_count, "status": cr.status},
    )

    return cr


async def reject_change_request(
    session: AsyncSession,
    cr: ChangeRequestDB,
    *,
    reviewer: str,
    comment: str | None = None,
) -> ChangeRequestDB:
    if cr.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot reject a '{cr.status}' change request")

    cr.status = "rejected"
    cr.reviewed_by = reviewer
    cr.review_comment = comment
    cr.resolved_at = datetime.now(UTC)

    await session.flush()
    await session.refresh(cr)

    return cr


async def list_change_requests(
    session: AsyncSession,
    *,
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ChangeRequestDB], int]:
    from sqlalchemy import func

    base = select(ChangeRequestDB)
    if status_filter:
        base = base.where(ChangeRequestDB.status == status_filter)

    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    items = (await session.execute(
        base.order_by(ChangeRequestDB.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()

    return list(items), total


async def get_change_request(session: AsyncSession, cr_id: str) -> ChangeRequestDB | None:
    result = await session.execute(select(ChangeRequestDB).where(ChangeRequestDB.id == cr_id))
    return result.scalar_one_or_none()


# --- Service Accounts ---

async def create_service_account(
    session: AsyncSession,
    *,
    name: str,
    description: str | None,
    role: str,
    scopes: list[str],
    created_by: str,
    expires_at: datetime | None = None,
) -> ServiceAccountDB:
    api_key = f"pf_sa_{secrets.token_urlsafe(32)}"
    sa = ServiceAccountDB(
        name=name,
        description=description,
        api_key=api_key,
        role=role,
        scopes=json.dumps(scopes),
        created_by=created_by,
        expires_at=expires_at,
    )
    session.add(sa)
    await session.flush()
    await session.refresh(sa)
    return sa


async def list_service_accounts(session: AsyncSession, *, limit: int = 50, offset: int = 0) -> tuple[list[ServiceAccountDB], int]:
    from sqlalchemy import func

    base = select(ServiceAccountDB)
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    items = (await session.execute(
        base.order_by(ServiceAccountDB.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    return list(items), total


async def get_service_account_by_key(session: AsyncSession, api_key: str) -> ServiceAccountDB | None:
    result = await session.execute(
        select(ServiceAccountDB).where(ServiceAccountDB.api_key == api_key, ServiceAccountDB.active == True)  # noqa: E712
    )
    return result.scalar_one_or_none()


async def revoke_service_account(session: AsyncSession, sa: ServiceAccountDB) -> ServiceAccountDB:
    sa.active = False
    await session.flush()
    await session.refresh(sa)
    return sa


# --- Freeze Windows ---

async def _check_freeze_windows(session: AsyncSession, environment: str | None) -> None:
    """Raise if there's an active freeze window covering the given environment."""
    now = datetime.now(UTC)
    stmt = (
        select(FreezeWindowDB)
        .where(FreezeWindowDB.active == True)  # noqa: E712
        .where(FreezeWindowDB.starts_at <= now)
        .where(FreezeWindowDB.ends_at >= now)
    )
    result = await session.execute(stmt)
    windows = result.scalars().all()

    for w in windows:
        if w.environment is None or w.environment == environment:
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Environment is frozen: {w.reason or w.name}. Freeze ends at {w.ends_at.isoformat()}",
            )


async def create_freeze_window(
    session: AsyncSession,
    *,
    name: str,
    environment: str | None,
    starts_at: datetime,
    ends_at: datetime,
    reason: str | None,
    created_by: str,
) -> FreezeWindowDB:
    fw = FreezeWindowDB(
        name=name,
        environment=environment,
        starts_at=starts_at,
        ends_at=ends_at,
        reason=reason,
        created_by=created_by,
    )
    session.add(fw)
    await session.flush()
    await session.refresh(fw)
    return fw


async def list_freeze_windows(session: AsyncSession, *, active_only: bool = True) -> list[FreezeWindowDB]:
    stmt = select(FreezeWindowDB).order_by(FreezeWindowDB.starts_at.desc())
    if active_only:
        stmt = stmt.where(FreezeWindowDB.active == True)  # noqa: E712
    result = await session.execute(stmt)
    return list(result.scalars().all())


# --- Two-Person Rule ---

async def enforce_two_person_rule(session: AsyncSession, change_request_id: str, approver_id: str) -> bool:
    """Ensure the approver is not the same person who created the change request."""
    cr = await session.get(ChangeRequestDB, change_request_id)
    if not cr:
        return False
    if cr.requested_by == approver_id:
        raise ValueError("Two-person rule: creator cannot approve their own change request")
    return True


async def check_required_approvals(session: AsyncSession, change_request_id: str, required_count: int = 1) -> bool:
    """Check if a change request has enough approvals."""
    cr = await session.get(ChangeRequestDB, change_request_id)
    if not cr:
        return False
    return (cr.approval_count or 0) >= required_count


# --- Break-Glass Workflow ---

async def break_glass(
    session: AsyncSession,
    flag_key: str,
    environment: str,
    action: str,
    reason: str,
    performer: str,
    expires_hours: int = 24,
) -> BreakGlassEventDB:
    """Emergency override that bypasses freeze windows and approval requirements."""
    event = BreakGlassEventDB(
        flag_key=flag_key,
        environment=environment,
        action=action,
        reason=reason,
        performed_by=performer,
        expires_at=datetime.now(UTC) + timedelta(hours=expires_hours),
    )
    session.add(event)
    await session.flush()
    await session.refresh(event)

    await audit_repository.create_log(
        session,
        action="break_glass",
        entity_type="flag",
        entity_id=event.id,
        entity_key=flag_key,
        actor=performer,
        changes={
            "environment": environment,
            "action": action,
            "reason": reason,
            "expires_hours": expires_hours,
        },
    )

    return event


async def list_break_glass_events(
    session: AsyncSession, *, limit: int = 50, offset: int = 0,
) -> tuple[list[BreakGlassEventDB], int]:
    """List break-glass events with pagination."""
    base = select(BreakGlassEventDB)
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    items = (await session.execute(
        base.order_by(BreakGlassEventDB.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()
    return list(items), total


async def revert_break_glass(session: AsyncSession, event_id: str) -> BreakGlassEventDB:
    """Mark a break-glass event as reverted."""
    event = await session.get(BreakGlassEventDB, event_id)
    if not event:
        raise ValueError("Break-glass event not found")
    if event.reverted:
        raise ValueError("Break-glass event already reverted")
    event.reverted = True
    await session.flush()
    await session.refresh(event)

    await audit_repository.create_log(
        session,
        action="break_glass_reverted",
        entity_type="flag",
        entity_id=event.id,
        entity_key=event.flag_key,
        actor=event.performed_by,
        changes={"reverted": True},
    )

    return event


# --- Token Rotation ---

async def rotate_service_account_key(session: AsyncSession, sa_id: str) -> dict:
    """Rotate a service account's API key."""
    sa = await session.get(ServiceAccountDB, sa_id)
    if not sa:
        raise ValueError("Service account not found")
    old_key_prefix = sa.api_key[:8] if sa.api_key else None
    sa.api_key = f"pf_sa_{secrets.token_urlsafe(32)}"
    await session.flush()
    await session.refresh(sa)
    return {"id": sa.id, "name": sa.name, "api_key": sa.api_key, "old_key_prefix": old_key_prefix}


async def set_key_expiry(session: AsyncSession, sa_id: str, expires_at: datetime) -> dict:
    """Set expiration date for a service account key."""
    sa = await session.get(ServiceAccountDB, sa_id)
    if not sa:
        raise ValueError("Service account not found")
    sa.expires_at = expires_at
    await session.flush()
    await session.refresh(sa)
    return {"id": sa.id, "expires_at": sa.expires_at.isoformat()}
