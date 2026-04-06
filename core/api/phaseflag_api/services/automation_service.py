"""Flag lifecycle automation service — stale detection, auto-archival, bulk ops."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.flags import FeatureFlagDB
from phaseflag_api.repositories import audit_repository, flag_repository

logger = logging.getLogger(__name__)


async def detect_stale_flags(
    session: AsyncSession,
    threshold_days: int = 90,
) -> list[dict[str, Any]]:
    """Find flags with no evaluations (last_evaluated_at) in the past N days.

    Returns a list of flag dicts describing the stale flags found.
    """
    cutoff = datetime.utcnow() - timedelta(days=threshold_days)
    stmt = (
        select(FeatureFlagDB)
        .where(FeatureFlagDB.status == "active")
        .where(
            or_(
                FeatureFlagDB.last_evaluated_at == None,  # noqa: E711
                FeatureFlagDB.last_evaluated_at < cutoff,
            )
        )
        .order_by(FeatureFlagDB.last_evaluated_at.asc().nulls_first())
    )
    result = await session.execute(stmt)
    stale = result.scalars().all()

    return [
        {
            "key": f.key,
            "name": f.name,
            "owner": f.owner,
            "owner_team": getattr(f, "owner_team", None),
            "lifecycle_stage": f.lifecycle_stage,
            "last_evaluated_at": f.last_evaluated_at.isoformat() if f.last_evaluated_at else None,
            "days_since_evaluation": (
                (datetime.utcnow() - f.last_evaluated_at).days if f.last_evaluated_at else None
            ),
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in stale
    ]


async def auto_archive_expired(session: AsyncSession) -> list[dict[str, Any]]:
    """Archive flags past their expiration date with a 7-day grace period.

    Flags are archived only when expires_at + 7 days <= now.
    Returns list of flags that were archived.
    """
    grace_period = timedelta(days=7)
    now = datetime.utcnow()
    cutoff = now - grace_period

    stmt = (
        select(FeatureFlagDB)
        .where(FeatureFlagDB.expires_at != None)  # noqa: E711
        .where(FeatureFlagDB.expires_at <= cutoff)
        .where(FeatureFlagDB.status != "archived")
        .where(FeatureFlagDB.lifecycle_stage != "archived")
    )
    result = await session.execute(stmt)
    expired = result.scalars().all()

    archived: list[dict[str, Any]] = []
    for flag in expired:
        old_status = flag.status
        old_stage = flag.lifecycle_stage
        flag.status = "inactive"
        flag.lifecycle_stage = "archived"
        flag.updated_at = now

        await flag_repository.update_flag(session, flag)
        await audit_repository.create_log(
            session,
            action="auto_archive",
            entity_type="flag",
            entity_id=flag.id,
            entity_key=flag.key,
            actor="system",
            changes={
                "status": {"old": old_status, "new": "inactive"},
                "lifecycle_stage": {"old": old_stage, "new": "archived"},
                "reason": "auto_archive_expired_grace_period",
                "expires_at": flag.expires_at.isoformat() if flag.expires_at else None,
                "grace_period_days": 7,
            },
        )
        archived.append(
            {
                "key": flag.key,
                "name": flag.name,
                "owner": flag.owner,
                "owner_team": getattr(flag, "owner_team", None),
                "expires_at": flag.expires_at.isoformat() if flag.expires_at else None,
                "archived_at": now.isoformat(),
            }
        )

    logger.info("auto_archive_expired: archived %d flags", len(archived))
    return archived


async def generate_cleanup_report(
    session: AsyncSession,
    team: str | None = None,
) -> dict[str, Any]:
    """Generate a cleanup report with stale flags by team and tech-debt scorecard.

    Args:
        team: Optional owner_team filter. If None, report covers all teams.

    Returns a dict with stale_flags, team_scorecard, and trend data.
    """
    now = datetime.utcnow()
    cutoff_90 = now - timedelta(days=90)
    cutoff_30 = now - timedelta(days=30)

    # Base stale query
    stale_stmt = select(FeatureFlagDB).where(FeatureFlagDB.status == "active").where(
        or_(
            FeatureFlagDB.last_evaluated_at == None,  # noqa: E711
            FeatureFlagDB.last_evaluated_at < cutoff_90,
        )
    )
    if team:
        stale_stmt = stale_stmt.where(FeatureFlagDB.owner_team == team)

    stale_result = await session.execute(stale_stmt)
    stale_flags = stale_result.scalars().all()

    # Scorecard by team
    scorecard_stmt = select(
        FeatureFlagDB.owner_team,
        func.count().filter(
            or_(
                FeatureFlagDB.last_evaluated_at == None,  # noqa: E711
                FeatureFlagDB.last_evaluated_at < cutoff_90,
            )
        ).label("stale_90d"),
        func.count().filter(
            or_(
                FeatureFlagDB.last_evaluated_at == None,  # noqa: E711
                FeatureFlagDB.last_evaluated_at < cutoff_30,
            )
        ).label("stale_30d"),
        func.count().filter(FeatureFlagDB.lifecycle_stage == "archived").label("archived"),
        func.count().filter(
            (FeatureFlagDB.expires_at != None)  # noqa: E711
            & (FeatureFlagDB.expires_at <= now)
        ).label("expired"),
        func.count().label("total"),
    ).group_by(FeatureFlagDB.owner_team)

    if team:
        scorecard_stmt = scorecard_stmt.where(FeatureFlagDB.owner_team == team)

    scorecard_result = await session.execute(scorecard_stmt)
    scorecard_rows = scorecard_result.all()

    team_scorecard = [
        {
            "owner_team": row[0] or "unassigned",
            "stale_90d": row[1],
            "stale_30d": row[2],
            "archived": row[3],
            "expired": row[4],
            "total": row[5],
            "tech_debt_score": round((row[1] / row[5] * 100) if row[5] > 0 else 0, 1),
        }
        for row in scorecard_rows
    ]

    return {
        "generated_at": now.isoformat(),
        "filter_team": team,
        "stale_flags": [
            {
                "key": f.key,
                "name": f.name,
                "owner": f.owner,
                "owner_team": getattr(f, "owner_team", None),
                "lifecycle_stage": f.lifecycle_stage,
                "last_evaluated_at": f.last_evaluated_at.isoformat() if f.last_evaluated_at else None,
            }
            for f in stale_flags
        ],
        "stale_count": len(stale_flags),
        "team_scorecard": sorted(team_scorecard, key=lambda x: x["tech_debt_score"], reverse=True),
        "trend": {
            "stale_90d_total": sum(r["stale_90d"] for r in team_scorecard),
            "stale_30d_total": sum(r["stale_30d"] for r in team_scorecard),
            "archived_total": sum(r["archived"] for r in team_scorecard),
            "expired_total": sum(r["expired"] for r in team_scorecard),
        },
    }


async def notify_flag_owners(stale_flags: list[dict[str, Any]]) -> dict[str, Any]:
    """Queue notifications for flag owners about stale flags.

    In production this would publish to a message queue (SQS, Redis Streams, etc.).
    Currently logs the notification intent and returns a summary.
    """
    grouped: dict[str, list[str]] = {}
    for flag in stale_flags:
        owner = flag.get("owner") or "unknown"
        grouped.setdefault(owner, []).append(flag["key"])

    notifications = []
    for owner, keys in grouped.items():
        logger.info(
            "notify_flag_owners: queuing notification to %s for %d stale flag(s): %s",
            owner,
            len(keys),
            ", ".join(keys),
        )
        notifications.append({"owner": owner, "flag_count": len(keys), "flag_keys": keys})

    return {
        "queued": len(notifications),
        "notifications": notifications,
    }


async def bulk_archive(
    session: AsyncSession,
    flag_keys: list[str],
    actor: str = "system",
) -> dict[str, Any]:
    """Archive multiple flags at once.

    Returns counts of archived, already_archived, and not_found flags.
    """
    archived: list[str] = []
    already_archived: list[str] = []
    not_found: list[str] = []
    now = datetime.utcnow()

    for key in flag_keys:
        flag = await flag_repository.get_flag_by_key(session, key)
        if flag is None:
            not_found.append(key)
            continue

        if flag.lifecycle_stage == "archived" or flag.status == "archived":
            already_archived.append(key)
            continue

        old_stage = flag.lifecycle_stage
        old_status = flag.status
        flag.status = "inactive"
        flag.lifecycle_stage = "archived"
        flag.updated_at = now

        await flag_repository.update_flag(session, flag)
        await audit_repository.create_log(
            session,
            action="bulk_archive",
            entity_type="flag",
            entity_id=flag.id,
            entity_key=flag.key,
            actor=actor,
            changes={
                "status": {"old": old_status, "new": "inactive"},
                "lifecycle_stage": {"old": old_stage, "new": "archived"},
                "reason": "bulk_archive",
            },
        )
        archived.append(key)

    logger.info(
        "bulk_archive: archived=%d already_archived=%d not_found=%d",
        len(archived),
        len(already_archived),
        len(not_found),
    )
    return {
        "archived": archived,
        "archived_count": len(archived),
        "already_archived": already_archived,
        "not_found": not_found,
    }
