"""GraphQL query and mutation resolvers — delegate to existing service layer."""

from __future__ import annotations

import logging
from typing import Any, Optional

import strawberry
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.types import Info

from phaseflag_api.models.environments import EnvironmentDB
from phaseflag_api.models.projects import ProjectDB
from phaseflag_api.models.segments import SegmentDB
from phaseflag_api.repositories import flag_repository
from phaseflag_api.services import flag_service

from .types import (
    EvaluateFlagInput,
    EvaluationResultType,
    EnvironmentType,
    FlagCreateInput,
    FlagType,
    FlagUpdateInput,
    ProjectType,
    SegmentType,
    environment_db_to_gql,
    flag_db_to_gql,
    project_db_to_gql,
    segment_db_to_gql,
)

logger = logging.getLogger(__name__)


def _get_session(info: Info) -> AsyncSession:
    """Extract the database session from the Strawberry context."""
    return info.context["session"]


# ---------------------------------------------------------------------------
# Query resolvers
# ---------------------------------------------------------------------------


async def resolve_flags(
    info: Info,
    project_id: Optional[str] = None,
    environment: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[FlagType]:
    """List feature flags, optionally filtered by environment."""
    session = _get_session(info)
    flags, _total = await flag_repository.list_flags(
        session,
        environment=environment,
        limit=limit,
        offset=offset,
    )
    return [flag_db_to_gql(f) for f in flags]


async def resolve_flag(info: Info, key: str) -> Optional[FlagType]:
    """Fetch a single flag by key."""
    session = _get_session(info)
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        return None
    return flag_db_to_gql(flag)


async def resolve_segments(
    info: Info,
    limit: int = 50,
    offset: int = 0,
) -> list[SegmentType]:
    """List all segments."""
    session = _get_session(info)
    result = await session.execute(select(SegmentDB).order_by(SegmentDB.created_at.desc()).limit(limit).offset(offset))
    segments = list(result.scalars().all())
    return [segment_db_to_gql(s) for s in segments]


async def resolve_projects(
    info: Info,
    limit: int = 50,
    offset: int = 0,
) -> list[ProjectType]:
    """List all projects."""
    session = _get_session(info)
    result = await session.execute(select(ProjectDB).order_by(ProjectDB.created_at.desc()).limit(limit).offset(offset))
    projects = list(result.scalars().all())
    return [project_db_to_gql(p) for p in projects]


async def resolve_environments(
    info: Info,
    project_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list[EnvironmentType]:
    """List environments, optionally filtered by project_id."""
    session = _get_session(info)
    stmt = select(EnvironmentDB).order_by(EnvironmentDB.created_at.desc()).limit(limit).offset(offset)
    if project_id:
        stmt = stmt.where(EnvironmentDB.project_id == project_id)
    result = await session.execute(stmt)
    envs = list(result.scalars().all())
    return [environment_db_to_gql(e) for e in envs]


# ---------------------------------------------------------------------------
# Mutation resolvers
# ---------------------------------------------------------------------------


async def resolve_create_flag(info: Info, input: FlagCreateInput) -> FlagType:
    """Create a new feature flag."""
    session = _get_session(info)
    existing = await flag_repository.get_flag_by_key(session, input.key)
    if existing is not None:
        raise ValueError(f"Flag with key '{input.key}' already exists")

    data: dict[str, Any] = {
        "key": input.key,
        "name": input.name,
        "description": input.description,
        "flag_type": input.flag_type,
        "environment": input.environment,
        "default_variation_key": input.default_variation_key,
        "tags": input.tags or [],
        "created_by": input.created_by,
        "flag_classification": input.flag_classification,
        "is_permanent": input.is_permanent,
        "variations": [
            {
                "key": v.key,
                "name": v.name,
                "value": v.value,
                "description": v.description,
            }
            for v in (input.variations or [])
        ],
        "targeting_rules": [],
    }
    flag = await flag_service.create_flag(session, data)
    return flag_db_to_gql(flag)


async def resolve_update_flag(info: Info, key: str, input: FlagUpdateInput) -> Optional[FlagType]:
    """Update an existing feature flag."""
    session = _get_session(info)
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        return None

    data: dict[str, Any] = {}
    if input.name is not None:
        data["name"] = input.name
    if input.description is not None:
        data["description"] = input.description
    if input.tags is not None:
        data["tags"] = input.tags
    if input.flag_classification is not None:
        data["flag_classification"] = input.flag_classification
    if input.is_permanent is not None:
        data["is_permanent"] = input.is_permanent
    if input.owner is not None:
        data["owner"] = input.owner

    updated = await flag_service.update_flag(session, flag, data)
    return flag_db_to_gql(updated)


async def resolve_toggle_flag(info: Info, key: str) -> Optional[FlagType]:
    """Toggle a flag between active and inactive."""
    session = _get_session(info)
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        return None
    if flag.status == "archived":
        raise ValueError("Cannot toggle an archived flag")
    toggled = await flag_service.toggle_flag(session, flag)
    return flag_db_to_gql(toggled)


async def resolve_delete_flag(info: Info, key: str) -> bool:
    """Delete a flag (must be archived first)."""
    session = _get_session(info)
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        return False
    if flag.status != "archived":
        raise ValueError("Flag must be archived before it can be deleted")
    await flag_service.delete_flag(session, flag)
    return True


async def resolve_create_segment(
    info: Info,
    key: str,
    name: str,
    description: Optional[str] = None,
    conditions: Optional[list[dict[str, Any]]] = None,
    created_by: str = "system",
) -> SegmentType:
    """Create a new audience segment."""
    session = _get_session(info)
    segment = SegmentDB(
        key=key,
        name=name,
        description=description,
        created_by=created_by,
    )
    segment.set_conditions(conditions or [])
    session.add(segment)
    await session.flush()
    await session.refresh(segment)
    return segment_db_to_gql(segment)


async def resolve_evaluate_flag(info: Info, input: EvaluateFlagInput) -> EvaluationResultType:
    """Evaluate a flag for a given user context."""
    from phaseflag_api.services.evaluation_engine import evaluate as evaluate_flag

    session = _get_session(info)
    flag = await flag_repository.get_flag_by_key(session, input.flag_key)
    if flag is None:
        raise ValueError(f"Flag '{input.flag_key}' not found")

    if flag.status != "active":
        # Return default variation when flag is disabled
        default_var = next((v for v in flag.variations if v.id == flag.default_variation_id), None)
        variation_key = default_var.key if default_var else "off"
        variation_value = default_var.get_value() if default_var else None
        return EvaluationResultType(
            flag_key=input.flag_key,
            variation_key=variation_key,
            variation_value=variation_value,
            reason="flag_disabled",
            enabled=False,
        )

    context: dict[str, Any] = {"user_id": input.user_id, **(input.attributes or {})}

    # Build a flag dict compatible with evaluation_engine.evaluate()
    flag_dict: dict[str, Any] = {
        "key": flag.key,
        "default_variation_id": flag.default_variation_id,
        "targeting_rules": flag.get_targeting_rules(),
        "variations": [
            {"id": v.id, "key": v.key, "value": v.get_value()}
            for v in flag.variations
        ],
    }
    result = evaluate_flag(flag_dict, context)

    return EvaluationResultType(
        flag_key=input.flag_key,
        variation_key=result.get("variation_key", "off"),
        variation_value=result.get("value"),
        reason=result.get("reason", "default"),
        enabled=True,
    )
