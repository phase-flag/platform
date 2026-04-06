"""Flag lifecycle state machine.

Valid transitions:
    development -> testing -> production -> stale -> archived -> deleted

Special transitions:
    any -> archived (via archive)
    archived -> inactive (via restore)
    development/testing -> production (auto on toggle active)
"""

import logging
from datetime import datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.flags import FeatureFlagDB
from phaseflag_api.repositories import audit_repository, flag_repository

logger = logging.getLogger(__name__)

VALID_STAGES = ("development", "testing", "production", "stale", "archived")

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "development": {"testing", "production", "archived"},
    "testing": {"development", "production", "archived"},
    "production": {"stale", "archived"},
    "stale": {"production", "archived"},
    "archived": {"development"},
}


def can_transition(current: str, target: str) -> bool:
    """Check if a lifecycle transition is allowed."""
    return target in ALLOWED_TRANSITIONS.get(current, set())


async def transition_lifecycle(
    session: AsyncSession,
    flag: FeatureFlagDB,
    target_stage: str,
    *,
    actor: str = "system",
) -> FeatureFlagDB:
    """Transition a flag to a new lifecycle stage.

    Raises HTTPException if the transition is not allowed.
    """
    if target_stage not in VALID_STAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid lifecycle stage '{target_stage}'. Must be one of: {', '.join(VALID_STAGES)}",
        )

    current = flag.lifecycle_stage or "development"
    if not can_transition(current, target_stage):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition from '{current}' to '{target_stage}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_TRANSITIONS.get(current, set())))}",
        )

    old_stage = flag.lifecycle_stage
    flag.lifecycle_stage = target_stage
    flag.updated_at = datetime.utcnow()

    # Auto-deactivate when archiving
    if target_stage == "archived" and flag.status == "active":
        flag.status = "inactive"

    result = await flag_repository.update_flag(session, flag)

    await audit_repository.create_log(
        session,
        action="lifecycle_transition",
        entity_type="flag",
        entity_id=flag.id,
        entity_key=flag.key,
        actor=actor,
        changes={"lifecycle_stage": {"old": old_stage, "new": target_stage}},
    )

    return result


async def check_expiring_flags(session: AsyncSession) -> list[dict[str, Any]]:
    """Find flags that are past their expiration date."""
    from sqlalchemy import select

    now = datetime.utcnow()
    stmt = (
        select(FeatureFlagDB)
        .where(FeatureFlagDB.expires_at != None)  # noqa: E711
        .where(FeatureFlagDB.expires_at <= now)
        .where(FeatureFlagDB.status != "archived")
    )
    result = await session.execute(stmt)
    expired = result.scalars().all()

    return [
        {
            "key": f.key,
            "name": f.name,
            "expires_at": f.expires_at.isoformat(),
            "status": f.status,
        }
        for f in expired
    ]


async def check_stale_flags(
    session: AsyncSession,
    stale_days: int = 30,
) -> list[dict[str, Any]]:
    """Find flags that haven't been evaluated recently."""
    from sqlalchemy import select, or_

    cutoff = datetime.utcnow() - __import__("datetime").timedelta(days=stale_days)
    stmt = (
        select(FeatureFlagDB)
        .where(FeatureFlagDB.status == "active")
        .where(FeatureFlagDB.lifecycle_stage == "production")
        .where(
            or_(
                FeatureFlagDB.last_evaluated_at == None,  # noqa: E711
                FeatureFlagDB.last_evaluated_at < cutoff,
            )
        )
    )
    result = await session.execute(stmt)
    stale = result.scalars().all()

    return [
        {
            "key": f.key,
            "name": f.name,
            "last_evaluated_at": f.last_evaluated_at.isoformat() if f.last_evaluated_at else None,
            "owner": f.owner,
            "owner_team": getattr(f, "owner_team", None),
        }
        for f in stale
    ]


async def run_stale_detection(session: AsyncSession) -> list[dict[str, Any]]:
    """Find flags not updated in 90 days with status=active, mark lifecycle_stage='stale'.

    Returns list of flags that were marked stale.
    """
    from datetime import timedelta
    from sqlalchemy import select, or_

    cutoff = datetime.utcnow() - timedelta(days=90)
    stmt = (
        select(FeatureFlagDB)
        .where(FeatureFlagDB.status == "active")
        .where(FeatureFlagDB.lifecycle_stage == "production")
        .where(
            or_(
                FeatureFlagDB.updated_at < cutoff,
                FeatureFlagDB.updated_at == None,  # noqa: E711
            )
        )
    )
    result = await session.execute(stmt)
    candidates = result.scalars().all()

    marked: list[dict[str, Any]] = []
    for flag in candidates:
        flag.lifecycle_stage = "stale"
        flag.updated_at = datetime.utcnow()
        await flag_repository.update_flag(session, flag)
        await audit_repository.create_log(
            session,
            action="lifecycle_transition",
            entity_type="flag",
            entity_id=flag.id,
            entity_key=flag.key,
            actor="system",
            changes={
                "lifecycle_stage": {"old": "production", "new": "stale"},
                "reason": "auto_stale_detection_90_days",
            },
        )
        marked.append(
            {
                "key": flag.key,
                "name": flag.name,
                "updated_at": flag.updated_at.isoformat(),
                "owner": flag.owner,
                "owner_team": getattr(flag, "owner_team", None),
            }
        )

    return marked


async def run_expiration_check(session: AsyncSession) -> list[dict[str, Any]]:
    """Find flags where expires_at < now and status=active, auto-archive them.

    Returns list of flags that were archived.
    """
    from sqlalchemy import select

    now = datetime.utcnow()
    stmt = (
        select(FeatureFlagDB)
        .where(FeatureFlagDB.expires_at != None)  # noqa: E711
        .where(FeatureFlagDB.expires_at <= now)
        .where(FeatureFlagDB.status == "active")
    )
    result = await session.execute(stmt)
    expired = result.scalars().all()

    archived: list[dict[str, Any]] = []
    for flag in expired:
        old_stage = flag.lifecycle_stage
        flag.status = "inactive"
        flag.lifecycle_stage = "archived"
        flag.updated_at = datetime.utcnow()
        await flag_repository.update_flag(session, flag)
        await audit_repository.create_log(
            session,
            action="lifecycle_transition",
            entity_type="flag",
            entity_id=flag.id,
            entity_key=flag.key,
            actor="system",
            changes={
                "status": {"old": "active", "new": "inactive"},
                "lifecycle_stage": {"old": old_stage, "new": "archived"},
                "reason": "auto_expired",
                "expires_at": flag.expires_at.isoformat() if flag.expires_at else None,
            },
        )
        archived.append(
            {
                "key": flag.key,
                "name": flag.name,
                "expires_at": flag.expires_at.isoformat() if flag.expires_at else None,
                "status": "archived",
            }
        )

    return archived


async def run_cleanup_scorecard(session: AsyncSession) -> list[dict[str, Any]]:
    """Return per-owner_team counts of stale, expired, and archived flags."""
    from sqlalchemy import select, func

    stmt = select(
        FeatureFlagDB.owner_team,
        func.count().filter(FeatureFlagDB.lifecycle_stage == "stale").label("stale_count"),
        func.count()
        .filter(
            (FeatureFlagDB.expires_at != None)  # noqa: E711
            & (FeatureFlagDB.expires_at <= datetime.utcnow())
        )
        .label("expired_count"),
        func.count().filter(FeatureFlagDB.lifecycle_stage == "archived").label("archived_count"),
        func.count().label("total_count"),
    ).group_by(FeatureFlagDB.owner_team)
    result = await session.execute(stmt)
    rows = result.all()

    scorecard: list[dict[str, Any]] = []
    for row in rows:
        scorecard.append(
            {
                "owner_team": row[0] or "unassigned",
                "stale_count": row[1],
                "expired_count": row[2],
                "archived_count": row[3],
                "total_count": row[4],
            }
        )

    return scorecard
