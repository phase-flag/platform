"""Analytics service — flag inventory, health dashboards, reporting."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.audit import EvaluationEventDB
from phaseflag_api.models.flags import FeatureFlagDB

logger = logging.getLogger(__name__)


async def get_flag_inventory(session: AsyncSession) -> dict[str, Any]:
    """Return a summary of all flags organized by type, status, and lifecycle."""
    # By status
    status_stmt = select(FeatureFlagDB.status, func.count().label("count")).group_by(FeatureFlagDB.status)
    status_rows = (await session.execute(status_stmt)).all()

    # By lifecycle stage
    lifecycle_stmt = select(FeatureFlagDB.lifecycle_stage, func.count().label("count")).group_by(
        FeatureFlagDB.lifecycle_stage
    )
    lifecycle_rows = (await session.execute(lifecycle_stmt)).all()

    # By environment
    env_stmt = select(FeatureFlagDB.environment, func.count().label("count")).group_by(FeatureFlagDB.environment)
    env_rows = (await session.execute(env_stmt)).all()

    # By classification
    class_stmt = select(FeatureFlagDB.flag_classification, func.count().label("count")).group_by(
        FeatureFlagDB.flag_classification
    )
    class_rows = (await session.execute(class_stmt)).all()

    # Flags without owners
    no_owner = (
        await session.execute(
            select(func.count()).where(
                or_(FeatureFlagDB.owner == "system", FeatureFlagDB.owner == None)  # noqa: E711
            )
        )
    ).scalar() or 0

    # Expired flags
    now = datetime.now(UTC)
    expired = (
        await session.execute(
            select(func.count())
            .where(FeatureFlagDB.expires_at != None)  # noqa: E711
            .where(FeatureFlagDB.expires_at <= now)
            .where(FeatureFlagDB.status != "archived")
        )
    ).scalar() or 0

    total = sum(row.count for row in status_rows)

    return {
        "total_flags": total,
        "by_status": {row.status: row.count for row in status_rows},
        "by_lifecycle": {(row.lifecycle_stage or "unknown"): row.count for row in lifecycle_rows},
        "by_environment": {row.environment: row.count for row in env_rows},
        "by_classification": {(row.flag_classification or "release"): row.count for row in class_rows},
        "flags_without_owner": no_owner,
        "expired_flags": expired,
    }


async def get_evaluation_trends(
    session: AsyncSession,
    days: int = 7,
) -> list[dict[str, Any]]:
    """Return daily evaluation counts for trending."""
    since = datetime.now(UTC) - timedelta(days=days)
    stmt = (
        select(
            func.strftime("%Y-%m-%d", EvaluationEventDB.timestamp).label("date"),
            func.count().label("count"),
        )
        .where(EvaluationEventDB.timestamp >= since)
        .group_by(func.strftime("%Y-%m-%d", EvaluationEventDB.timestamp))
        .order_by(func.strftime("%Y-%m-%d", EvaluationEventDB.timestamp))
    )
    rows = (await session.execute(stmt)).all()
    return [{"date": row.date, "count": row.count} for row in rows]


# ---------------------------------------------------------------------------
# Phase 4 — Analytics & Reporting
# ---------------------------------------------------------------------------


async def get_stale_flag_report(session: AsyncSession) -> dict:
    """Report on stale flags by team and age."""
    stmt = select(FeatureFlagDB).where(FeatureFlagDB.lifecycle_stage == "stale")
    result = await session.execute(stmt)
    flags = result.scalars().all()

    by_team: dict[str, Any] = {}
    for f in flags:
        team = f.owner_team or "unassigned"
        if team not in by_team:
            by_team[team] = {"count": 0, "flags": []}
        by_team[team]["count"] += 1
        by_team[team]["flags"].append({"key": f.key, "name": f.name, "updated_at": f.updated_at.isoformat()})

    return {"total_stale": len(flags), "by_team": by_team}


async def get_release_dashboard(session: AsyncSession) -> dict:
    """Release success/failure dashboard."""
    from phaseflag_api.models.pipelines import PipelineDB

    stmt = select(PipelineDB).order_by(PipelineDB.created_at.desc()).limit(50)
    result = await session.execute(stmt)
    pipelines = result.scalars().all()

    stats: dict[str, Any] = {
        "total": len(pipelines),
        "completed": 0,
        "failed": 0,
        "in_progress": 0,
        "paused": 0,
    }
    recent = []
    for p in pipelines:
        if p.status == "completed":
            stats["completed"] += 1
        elif p.status in ("failed", "rolled_back"):
            stats["failed"] += 1
        elif p.status == "paused":
            stats["paused"] += 1
        else:
            stats["in_progress"] += 1
        recent.append(
            {
                "id": p.id,
                "flag_key": p.flag_key,
                "status": p.status,
                "template": p.template,
                "created_at": p.created_at.isoformat(),
            }
        )

    stats["success_rate"] = round(stats["completed"] / max(stats["total"], 1) * 100, 1)
    return {"stats": stats, "recent_rollouts": recent[:20]}


async def get_environment_drift(session: AsyncSession) -> list[dict]:
    """Detect flag configuration differences between environments."""
    stmt = select(FeatureFlagDB).where(FeatureFlagDB.status != "archived").order_by(FeatureFlagDB.key)
    result = await session.execute(stmt)
    flags = result.scalars().all()

    # Group by key
    by_key: dict[str, dict] = {}
    for f in flags:
        if f.key not in by_key:
            by_key[f.key] = {}
        by_key[f.key][f.environment] = {"status": f.status}

    drifts = []
    for key, envs in by_key.items():
        if len(envs) > 1:
            statuses = set(e["status"] for e in envs.values())
            if len(statuses) > 1:
                drifts.append({"flag_key": key, "environments": envs, "drift_type": "status"})

    return drifts


async def get_change_activity_timeline(session: AsyncSession, days: int = 30) -> list[dict]:
    """Timeline of flag changes over the past N days."""
    from phaseflag_api.models.audit import AuditLogDB

    cutoff = datetime.now(UTC) - timedelta(days=days)
    stmt = select(AuditLogDB).where(AuditLogDB.timestamp >= cutoff).order_by(AuditLogDB.timestamp.desc())
    result = await session.execute(stmt)
    logs = result.scalars().all()

    # Group by day
    by_day: dict[str, dict] = {}
    for log in logs:
        day = log.timestamp.strftime("%Y-%m-%d")
        if day not in by_day:
            by_day[day] = {"date": day, "changes": 0, "actions": {}}
        by_day[day]["changes"] += 1
        action = log.action
        by_day[day]["actions"][action] = by_day[day]["actions"].get(action, 0) + 1

    return sorted(by_day.values(), key=lambda x: x["date"], reverse=True)


async def get_top_flags(session: AsyncSession, limit: int = 20) -> list[dict]:
    """Top evaluated flags."""
    stmt = (
        select(
            EvaluationEventDB.flag_key,
            func.count().label("eval_count"),
        )
        .group_by(EvaluationEventDB.flag_key)
        .order_by(func.count().desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return [{"flag_key": row[0], "evaluation_count": row[1]} for row in result.all()]


async def get_flags_without_owners(session: AsyncSession) -> list[dict]:
    """Flags that don't have an owner assigned."""
    stmt = select(FeatureFlagDB).where(
        FeatureFlagDB.status != "archived",
        or_(FeatureFlagDB.owner_team == None, FeatureFlagDB.owner_team == ""),  # noqa: E711
    )
    result = await session.execute(stmt)
    return [{"key": f.key, "name": f.name, "created_at": f.created_at.isoformat()} for f in result.scalars().all()]


async def get_expired_flags(session: AsyncSession) -> list[dict]:
    """Flags past their expiration date."""
    now = datetime.now(UTC)
    stmt = select(FeatureFlagDB).where(
        FeatureFlagDB.expires_at != None,  # noqa: E711
        FeatureFlagDB.expires_at < now,
        FeatureFlagDB.status != "archived",
    )
    result = await session.execute(stmt)
    return [
        {
            "key": f.key,
            "name": f.name,
            "expires_at": f.expires_at.isoformat(),
            "owner_team": f.owner_team,
        }
        for f in result.scalars().all()
    ]


async def get_segment_usage(session: AsyncSession) -> list[dict]:
    """Report on segment usage across flags."""
    from phaseflag_api.models.segments import SegmentDB

    stmt = select(SegmentDB)
    result = await session.execute(stmt)
    segments = result.scalars().all()

    usage = []
    for seg in segments:
        # Count flags referencing this segment (check targeting rules JSON)
        flag_stmt = (
            select(func.count()).select_from(FeatureFlagDB).where(FeatureFlagDB.targeting_rules.contains(seg.key))
        )
        count_result = await session.execute(flag_stmt)
        count = count_result.scalar() or 0
        usage.append({"segment_key": seg.key, "segment_name": seg.name, "flag_count": count})

    return sorted(usage, key=lambda x: x["flag_count"], reverse=True)
