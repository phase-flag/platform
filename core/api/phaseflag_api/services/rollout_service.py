"""Progressive rollout service — pipeline lifecycle and stage advancement."""

import logging
from datetime import datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.pipelines import PipelineDB, PipelineStageDB, RollbackRuleDB
from phaseflag_api.repositories import audit_repository

logger = logging.getLogger(__name__)

PIPELINE_TEMPLATES = {
    "canary": [
        {"name": "Canary", "rollout_percentage": 1, "duration_minutes": 30},
        {"name": "Early Adopters", "rollout_percentage": 10, "duration_minutes": 60},
        {"name": "Half", "rollout_percentage": 50, "duration_minutes": 120},
        {"name": "Full Rollout", "rollout_percentage": 100, "duration_minutes": None},
    ],
    "blue_green": [
        {"name": "Green (New)", "rollout_percentage": 0, "duration_minutes": 10},
        {"name": "Switch", "rollout_percentage": 100, "duration_minutes": None},
    ],
    "linear": [{"name": f"{p}%", "rollout_percentage": p, "duration_minutes": 60} for p in [10, 25, 50, 75, 100]],
}


async def create_pipeline(
    session: AsyncSession,
    *,
    flag_key: str,
    name: str,
    description: str | None = None,
    template: str | None = None,
    stages: list[dict[str, Any]] | None = None,
    environment: str | None = None,
    created_by: str = "system",
    project_key: str | None = None,
) -> PipelineDB:
    if template and template in PIPELINE_TEMPLATES:
        stages = PIPELINE_TEMPLATES[template]
    elif not stages:
        raise HTTPException(status_code=400, detail="Provide either a template or custom stages")

    pipeline = PipelineDB(
        flag_key=flag_key,
        name=name,
        description=description,
        template=template,
        environment=environment,
        created_by=created_by,
        project_key=project_key,
    )
    session.add(pipeline)
    await session.flush()

    for i, s in enumerate(stages):
        stage = PipelineStageDB(
            pipeline_id=pipeline.id,
            stage_order=i,
            name=s["name"],
            rollout_percentage=s["rollout_percentage"],
            duration_minutes=s.get("duration_minutes"),
            health_check_url=s.get("health_check_url"),
            success_threshold=s.get("success_threshold"),
        )
        session.add(stage)
    await session.flush()
    await session.refresh(pipeline)

    await audit_repository.create_log(
        session,
        action="pipeline_created",
        entity_type="pipeline",
        entity_id=pipeline.id,
        entity_key=flag_key,
        actor=created_by,
        changes={"name": name, "stages": len(stages)},
    )
    return pipeline


async def advance_pipeline(session: AsyncSession, pipeline: PipelineDB) -> PipelineDB:
    if pipeline.status not in ("pending", "running"):
        raise HTTPException(status_code=400, detail=f"Cannot advance a '{pipeline.status}' pipeline")

    stages = sorted(pipeline.stages, key=lambda s: s.stage_order)
    current_idx = pipeline.current_stage_index

    # Complete current stage
    if current_idx < len(stages):
        stages[current_idx].status = "completed"
        stages[current_idx].completed_at = datetime.utcnow()

    # Move to next stage
    next_idx = current_idx + 1
    if next_idx >= len(stages):
        pipeline.status = "completed"
        pipeline.completed_at = datetime.utcnow()
    else:
        pipeline.current_stage_index = next_idx
        pipeline.status = "running"
        stages[next_idx].status = "active"
        stages[next_idx].started_at = datetime.utcnow()

    pipeline.updated_at = datetime.utcnow()
    await session.flush()
    await session.refresh(pipeline)
    return pipeline


async def pause_pipeline(session: AsyncSession, pipeline: PipelineDB) -> PipelineDB:
    if pipeline.status != "running":
        raise HTTPException(status_code=400, detail="Can only pause a running pipeline")
    pipeline.status = "paused"
    pipeline.updated_at = datetime.utcnow()
    await session.flush()
    await session.refresh(pipeline)
    return pipeline


async def resume_pipeline(session: AsyncSession, pipeline: PipelineDB) -> PipelineDB:
    if pipeline.status != "paused":
        raise HTTPException(status_code=400, detail="Can only resume a paused pipeline")
    pipeline.status = "running"
    pipeline.updated_at = datetime.utcnow()
    await session.flush()
    await session.refresh(pipeline)
    return pipeline


async def rollback_pipeline(session: AsyncSession, pipeline: PipelineDB) -> PipelineDB:
    if pipeline.status in ("completed", "rolled_back"):
        raise HTTPException(status_code=400, detail=f"Cannot rollback a '{pipeline.status}' pipeline")
    pipeline.status = "rolled_back"
    pipeline.updated_at = datetime.utcnow()
    # Mark remaining stages as skipped
    for stage in pipeline.stages:
        if stage.status in ("pending", "active"):
            stage.status = "skipped"
    await session.flush()
    await session.refresh(pipeline)
    return pipeline


async def get_pipeline(session: AsyncSession, pipeline_id: str) -> PipelineDB | None:
    result = await session.execute(select(PipelineDB).where(PipelineDB.id == pipeline_id))
    return result.scalar_one_or_none()


async def list_pipelines(
    session: AsyncSession,
    flag_key: str | None = None,
    *,
    project_key: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[PipelineDB], int]:
    from sqlalchemy import func

    base = select(PipelineDB)
    if flag_key:
        base = base.where(PipelineDB.flag_key == flag_key)
    if project_key:
        base = base.where(PipelineDB.project_key == project_key)
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    items = (
        (await session.execute(base.order_by(PipelineDB.created_at.desc()).limit(limit).offset(offset))).scalars().all()
    )
    return list(items), total


# --- Rollback Rules ---


async def create_rollback_rule(
    session: AsyncSession,
    *,
    flag_key: str,
    metric_name: str,
    operator: str,
    threshold: float,
    window_minutes: int = 5,
    action: str = "disable",
) -> RollbackRuleDB:
    rule = RollbackRuleDB(
        flag_key=flag_key,
        metric_name=metric_name,
        operator=operator,
        threshold=threshold,
        window_minutes=window_minutes,
        action=action,
    )
    session.add(rule)
    await session.flush()
    await session.refresh(rule)
    return rule


async def list_rollback_rules(session: AsyncSession, flag_key: str) -> list[RollbackRuleDB]:
    result = await session.execute(
        select(RollbackRuleDB).where(RollbackRuleDB.flag_key == flag_key).order_by(RollbackRuleDB.created_at.desc())
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Phase 2: Auto-advance, rollback triggers, emergency kill
# ---------------------------------------------------------------------------


async def auto_advance_pipeline(session: AsyncSession, pipeline_id: str) -> dict[str, Any]:
    """Check if current stage duration has elapsed, advance to next stage if so.

    Returns a dict describing the action taken.
    """
    pipeline = await get_pipeline(session, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    if pipeline.status not in ("pending", "running"):
        return {
            "action": "none",
            "reason": f"Pipeline status is '{pipeline.status}', not advanceable",
        }

    stages = sorted(pipeline.stages, key=lambda s: s.stage_order)
    current_idx = pipeline.current_stage_index

    if current_idx >= len(stages):
        return {"action": "none", "reason": "No more stages"}

    current_stage = stages[current_idx]

    # If stage has no duration, it requires manual advance
    if current_stage.duration_minutes is None:
        return {
            "action": "none",
            "reason": "Current stage has no auto-advance duration (manual advance required)",
        }

    # Check if the stage has been active long enough
    if current_stage.started_at is None:
        # Stage hasn't started yet — start it
        current_stage.status = "active"
        current_stage.started_at = datetime.utcnow()
        pipeline.status = "running"
        pipeline.updated_at = datetime.utcnow()
        await session.flush()
        await session.refresh(pipeline)
        return {
            "action": "started",
            "stage": current_stage.name,
            "pipeline_status": pipeline.status,
        }

    from datetime import timedelta

    elapsed = datetime.utcnow() - current_stage.started_at
    required = timedelta(minutes=current_stage.duration_minutes)

    if elapsed < required:
        remaining_seconds = int((required - elapsed).total_seconds())
        return {
            "action": "waiting",
            "stage": current_stage.name,
            "elapsed_minutes": round(elapsed.total_seconds() / 60, 1),
            "required_minutes": current_stage.duration_minutes,
            "remaining_seconds": remaining_seconds,
        }

    # Duration has elapsed — advance
    updated = await advance_pipeline(session, pipeline)

    await audit_repository.create_log(
        session,
        action="pipeline_auto_advanced",
        entity_type="pipeline",
        entity_id=pipeline.id,
        entity_key=pipeline.flag_key,
        actor="system",
        changes={
            "from_stage": current_stage.name,
            "to_stage_index": updated.current_stage_index,
            "pipeline_status": updated.status,
        },
    )

    return {
        "action": "advanced",
        "from_stage": current_stage.name,
        "new_stage_index": updated.current_stage_index,
        "pipeline_status": updated.status,
    }


async def check_rollback_triggers(
    session: AsyncSession,
    pipeline_id: str,
    metrics: dict[str, float],
) -> dict[str, Any]:
    """Compare provided metrics against rollback rules for the pipeline's flag.

    Returns whether a rollback is needed and which rules triggered.
    """
    pipeline = await get_pipeline(session, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    rules = await list_rollback_rules(session, pipeline.flag_key)
    active_rules = [r for r in rules if r.active]

    if not active_rules:
        return {
            "rollback_needed": False,
            "reason": "No active rollback rules",
            "triggered_rules": [],
        }

    triggered: list[dict[str, Any]] = []
    for rule in active_rules:
        metric_value = metrics.get(rule.metric_name)
        if metric_value is None:
            continue

        should_trigger = False
        if rule.operator == "gt" and metric_value > rule.threshold:
            should_trigger = True
        elif rule.operator == "lt" and metric_value < rule.threshold:
            should_trigger = True
        elif rule.operator == "gte" and metric_value >= rule.threshold:
            should_trigger = True
        elif rule.operator == "lte" and metric_value <= rule.threshold:
            should_trigger = True

        if should_trigger:
            rule.last_triggered_at = datetime.utcnow()
            triggered.append(
                {
                    "rule_id": rule.id,
                    "metric_name": rule.metric_name,
                    "operator": rule.operator,
                    "threshold": rule.threshold,
                    "actual_value": metric_value,
                    "action": rule.action,
                }
            )

    if triggered:
        # Determine the most severe action
        actions = {t["action"] for t in triggered}
        if "rollback" in actions:
            await rollback_pipeline(session, pipeline)
            await audit_repository.create_log(
                session,
                action="pipeline_auto_rollback",
                entity_type="pipeline",
                entity_id=pipeline.id,
                entity_key=pipeline.flag_key,
                actor="system",
                changes={"triggered_rules": triggered, "metrics": metrics},
            )
        elif "disable" in actions:
            # Disable the flag
            from phaseflag_api.repositories import flag_repository

            flag_db = await flag_repository.get_flag_by_key(session, pipeline.flag_key)
            if flag_db and flag_db.status == "active":
                flag_db.status = "inactive"
                flag_db.updated_at = datetime.utcnow()
                await flag_repository.update_flag(session, flag_db)
            await rollback_pipeline(session, pipeline)
            await audit_repository.create_log(
                session,
                action="pipeline_auto_disable",
                entity_type="pipeline",
                entity_id=pipeline.id,
                entity_key=pipeline.flag_key,
                actor="system",
                changes={"triggered_rules": triggered, "metrics": metrics},
            )

        await session.flush()
        return {
            "rollback_needed": True,
            "triggered_rules": triggered,
            "pipeline_status": pipeline.status,
        }

    return {
        "rollback_needed": False,
        "triggered_rules": [],
        "pipeline_status": pipeline.status,
    }


async def emergency_kill(session: AsyncSession, flag_key: str) -> dict[str, Any]:
    """Immediately disable a flag, pause any active pipeline, and log an audit event."""
    from phaseflag_api.repositories import flag_repository

    flag_db = await flag_repository.get_flag_by_key(session, flag_key)
    if not flag_db:
        raise HTTPException(status_code=404, detail=f"Flag '{flag_key}' not found")

    old_status = flag_db.status
    flag_db.status = "inactive"
    flag_db.updated_at = datetime.utcnow()
    await flag_repository.update_flag(session, flag_db)

    # Pause any active pipelines for this flag
    paused_pipelines: list[str] = []
    pipelines_list, _ = await list_pipelines(session, flag_key, limit=100, offset=0)
    for pipeline in pipelines_list:
        if pipeline.status in ("running", "pending"):
            pipeline.status = "paused"
            pipeline.updated_at = datetime.utcnow()
            paused_pipelines.append(pipeline.id)
    await session.flush()

    await audit_repository.create_log(
        session,
        action="emergency_kill",
        entity_type="flag",
        entity_id=flag_db.id,
        entity_key=flag_key,
        actor="system",
        changes={
            "status": {"old": old_status, "new": "inactive"},
            "paused_pipelines": paused_pipelines,
            "reason": "emergency_kill_switch",
        },
    )

    return {
        "flag_key": flag_key,
        "old_status": old_status,
        "new_status": "inactive",
        "paused_pipelines": paused_pipelines,
    }


# ---------------------------------------------------------------------------
# Rollout Templates (Phase 2 — rich template definitions)
# ---------------------------------------------------------------------------

ROLLOUT_TEMPLATES_DETAILED: dict[str, dict[str, Any]] = {
    "canary": {
        "name": "Canary Rollout",
        "description": "Small percentage first, then expand",
        "stages": [
            {"name": "canary", "percentage": 1, "duration_minutes": 30},
            {"name": "early_adopters", "percentage": 10, "duration_minutes": 60},
            {"name": "half", "percentage": 50, "duration_minutes": 120},
            {"name": "full", "percentage": 100, "duration_minutes": None},
        ],
    },
    "blue_green": {
        "name": "Blue-Green",
        "description": "Instant switch from 0 to 100",
        "stages": [
            {"name": "green", "percentage": 0, "duration_minutes": None},
            {"name": "blue", "percentage": 100, "duration_minutes": None},
        ],
    },
    "gradual": {
        "name": "Gradual Rollout",
        "description": "Linear increase over time",
        "stages": [
            {"name": "5_percent", "percentage": 5, "duration_minutes": 60},
            {"name": "25_percent", "percentage": 25, "duration_minutes": 120},
            {"name": "50_percent", "percentage": 50, "duration_minutes": 240},
            {"name": "75_percent", "percentage": 75, "duration_minutes": 360},
            {"name": "100_percent", "percentage": 100, "duration_minutes": None},
        ],
    },
    "ring": {
        "name": "Ring Deployment",
        "description": "Internal -> Beta -> GA",
        "stages": [
            {"name": "internal", "percentage": 1, "duration_minutes": 60},
            {"name": "beta", "percentage": 10, "duration_minutes": 120},
            {"name": "early_access", "percentage": 30, "duration_minutes": 240},
            {"name": "ga", "percentage": 100, "duration_minutes": None},
        ],
    },
    "segment_first": {
        "name": "Segment-First",
        "description": "Target specific segments before general availability",
        "stages": [
            {"name": "beta_users", "percentage": 5, "duration_minutes": 120},
            {"name": "internal", "percentage": 15, "duration_minutes": 180},
            {"name": "general", "percentage": 100, "duration_minutes": None},
        ],
    },
}
