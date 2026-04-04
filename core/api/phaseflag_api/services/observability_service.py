"""Observability service — metrics collection and flag evaluation statistics."""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.audit import AuditLogDB, EvaluationEventDB
from phaseflag_api.models.flags import FeatureFlagDB

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory metrics stores
# ---------------------------------------------------------------------------
_cache_metrics: dict[str, int] = {"hits": 0, "misses": 0, "evictions": 0}
_sync_metrics: dict[str, Any] = {"last_sync": None, "sync_count": 0, "avg_lag_ms": 0.0, "total_lag_ms": 0}
_incident_correlations: list[dict] = []


def record_cache_hit() -> None:
    _cache_metrics["hits"] += 1


def record_cache_miss() -> None:
    _cache_metrics["misses"] += 1


def get_cache_metrics() -> dict:
    total = _cache_metrics["hits"] + _cache_metrics["misses"]
    return {
        **_cache_metrics,
        "hit_rate": _cache_metrics["hits"] / total if total > 0 else 0.0,
        "total_requests": total,
    }


def record_sync(lag_ms: float) -> None:
    _sync_metrics["last_sync"] = datetime.now(UTC).isoformat()
    _sync_metrics["sync_count"] += 1
    _sync_metrics["total_lag_ms"] += lag_ms
    _sync_metrics["avg_lag_ms"] = _sync_metrics["total_lag_ms"] / _sync_metrics["sync_count"]


def get_sync_metrics() -> dict:
    return dict(_sync_metrics)


async def get_rollout_timeline(session: AsyncSession, flag_key: str) -> list[dict]:
    """Get the rollout progression timeline for a flag."""
    from phaseflag_api.models.pipelines import PipelineDB

    stmt = (
        select(PipelineDB)
        .where(PipelineDB.flag_key == flag_key)
        .order_by(PipelineDB.created_at.desc())
    )
    result = await session.execute(stmt)
    pipelines = result.scalars().all()
    timeline = []
    for p in pipelines:
        stages = []
        for s in sorted(p.stages, key=lambda x: x.stage_order):
            stages.append({
                "name": s.name,
                "percentage": s.rollout_percentage,
                "status": s.status,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            })
        timeline.append({
            "pipeline_id": p.id,
            "status": p.status,
            "created_at": p.created_at.isoformat(),
            "stages": stages,
        })
    return timeline


def correlate_incident(flag_key: str, incident_id: str, description: str, timestamp: str | None = None) -> dict:
    """Correlate a flag change with an incident."""
    entry = {
        "flag_key": flag_key,
        "incident_id": incident_id,
        "description": description,
        "timestamp": timestamp or datetime.now(UTC).isoformat(),
    }
    _incident_correlations.append(entry)
    return entry


def get_incident_correlations(flag_key: str | None = None) -> list[dict]:
    if flag_key:
        return [c for c in _incident_correlations if c["flag_key"] == flag_key]
    return list(_incident_correlations)


async def inspect_user_flags(session: AsyncSession, user_id: str) -> list[dict]:
    """Inspect all flag evaluations for a specific user."""
    stmt = (
        select(EvaluationEventDB)
        .where(EvaluationEventDB.user_id == user_id)
        .order_by(EvaluationEventDB.timestamp.desc())
        .limit(100)
    )
    result = await session.execute(stmt)
    events = result.scalars().all()
    return [
        {
            "flag_key": e.flag_key,
            "variation": e.variation_key,
            "timestamp": e.timestamp.isoformat(),
        }
        for e in events
    ]


async def get_system_metrics(session: AsyncSession) -> dict[str, Any]:
    """Return system-wide metrics for monitoring."""
    # Flag counts by status
    flag_counts = {}
    for s in ("active", "inactive", "archived"):
        count = (await session.execute(
            select(func.count()).where(FeatureFlagDB.status == s)
        )).scalar() or 0
        flag_counts[s] = count

    # Total evaluations in last 24h
    since_24h = datetime.now(UTC) - timedelta(hours=24)
    eval_count_24h = (await session.execute(
        select(func.count()).where(EvaluationEventDB.timestamp >= since_24h)
    )).scalar() or 0

    # Total evaluations in last 7d
    since_7d = datetime.now(UTC) - timedelta(days=7)
    eval_count_7d = (await session.execute(
        select(func.count()).where(EvaluationEventDB.timestamp >= since_7d)
    )).scalar() or 0

    # Unique users in last 24h
    unique_users_24h = (await session.execute(
        select(func.count(func.distinct(EvaluationEventDB.user_id)))
        .where(EvaluationEventDB.timestamp >= since_24h)
    )).scalar() or 0

    # Audit log count in last 24h
    audit_count_24h = (await session.execute(
        select(func.count()).where(AuditLogDB.timestamp >= since_24h)
    )).scalar() or 0

    # Top evaluated flags (last 24h)
    top_flags_stmt = (
        select(EvaluationEventDB.flag_key, func.count().label("count"))
        .where(EvaluationEventDB.timestamp >= since_24h)
        .group_by(EvaluationEventDB.flag_key)
        .order_by(func.count().desc())
        .limit(10)
    )
    top_flags = (await session.execute(top_flags_stmt)).all()

    return {
        "timestamp": datetime.now(UTC).isoformat(),
        "flags": {
            "total": sum(flag_counts.values()),
            "by_status": flag_counts,
        },
        "evaluations": {
            "last_24h": eval_count_24h,
            "last_7d": eval_count_7d,
            "unique_users_24h": unique_users_24h,
        },
        "audit": {
            "changes_24h": audit_count_24h,
        },
        "top_flags_24h": [
            {"flag_key": row.flag_key, "count": row.count}
            for row in top_flags
        ],
    }


async def get_flag_health(session: AsyncSession, flag_key: str) -> dict[str, Any]:
    """Return health metrics for a specific flag."""
    since_24h = datetime.now(UTC) - timedelta(hours=24)
    since_7d = datetime.now(UTC) - timedelta(days=7)

    # Evaluation count
    eval_24h = (await session.execute(
        select(func.count())
        .where(EvaluationEventDB.flag_key == flag_key)
        .where(EvaluationEventDB.timestamp >= since_24h)
    )).scalar() or 0

    eval_7d = (await session.execute(
        select(func.count())
        .where(EvaluationEventDB.flag_key == flag_key)
        .where(EvaluationEventDB.timestamp >= since_7d)
    )).scalar() or 0

    # Variation distribution
    var_stmt = (
        select(EvaluationEventDB.variation_key, func.count().label("count"))
        .where(EvaluationEventDB.flag_key == flag_key)
        .where(EvaluationEventDB.timestamp >= since_24h)
        .group_by(EvaluationEventDB.variation_key)
    )
    var_rows = (await session.execute(var_stmt)).all()

    # Recent changes
    changes = (await session.execute(
        select(AuditLogDB)
        .where(AuditLogDB.entity_key == flag_key)
        .order_by(AuditLogDB.timestamp.desc())
        .limit(5)
    )).scalars().all()

    return {
        "flag_key": flag_key,
        "evaluations": {
            "last_24h": eval_24h,
            "last_7d": eval_7d,
        },
        "variation_distribution_24h": {
            (row.variation_key or "unknown"): row.count for row in var_rows
        },
        "recent_changes": [
            {"action": c.action, "actor": c.actor, "timestamp": c.timestamp.isoformat()}
            for c in changes
        ],
    }
