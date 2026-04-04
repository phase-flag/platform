"""Business logic for feature-flag management."""

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.flags import FeatureFlagDB, VariationDB
from phaseflag_api.repositories import audit_repository, flag_repository
from phaseflag_api.services import webhook_service
from phaseflag_api.services.sse_manager import sse_manager

logger = logging.getLogger(__name__)


def _flag_summary(flag: FeatureFlagDB) -> dict[str, Any]:
    return {
        "key": flag.key,
        "name": flag.name,
        "status": flag.status,
        "environment": flag.environment,
        "flag_type": flag.flag_type,
    }


async def _check_circular_prerequisites(
    session: AsyncSession, flag_key: str, prereqs: list[dict[str, str]]
) -> None:
    from fastapi import HTTPException, status

    visited: set[str] = {flag_key}
    to_check = [p["flag_key"] for p in prereqs]

    while to_check:
        current_key = to_check.pop()
        if current_key in visited:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Circular prerequisite detected: '{flag_key}' -> '{current_key}' creates a cycle",
            )
        visited.add(current_key)

        dep_flag = await flag_repository.get_flag_by_key(session, current_key)
        if dep_flag:
            dep_prereqs = dep_flag.get_prerequisites()
            for dp in dep_prereqs:
                to_check.append(dp["flag_key"])


async def _notify_flag_change(event_type: str, flag: FeatureFlagDB, session: AsyncSession) -> None:
    summary = _flag_summary(flag)
    await webhook_service.fire_webhooks(session, event_type, flag.key, summary)
    await sse_manager.broadcast(event_type, {
        "flag_key": flag.key,
        "event": event_type,
        "timestamp": datetime.now(UTC).isoformat(),
        **summary,
    })


async def create_flag(session: AsyncSession, data: dict[str, Any]) -> FeatureFlagDB:
    flag_id = str(uuid4())

    variation_rows: list[VariationDB] = []
    default_variation_id: str | None = None
    for v in data.get("variations", []):
        vid = str(uuid4())
        row = VariationDB(
            id=vid, flag_id=flag_id,
            key=v["key"], name=v.get("name") or v["key"],
            value=json.dumps(v["value"]), description=v.get("description"),
        )
        variation_rows.append(row)
        if v["key"] == data.get("default_variation_key"):
            default_variation_id = vid

    if default_variation_id is None and variation_rows:
        default_variation_id = variation_rows[0].id

    flag = FeatureFlagDB(
        id=flag_id, key=data["key"], name=data["name"],
        description=data.get("description"),
        flag_type=data.get("flag_type", "boolean"),
        status="inactive",
        environment=data.get("environment", "development"),
        default_variation_id=default_variation_id or "",
        tags=json.dumps(data.get("tags", [])),
        targeting_rules=json.dumps(data.get("targeting_rules", [])),
        created_by=data.get("created_by", "system"),
        owner=data.get("owner", data.get("created_by", "system")),
        flag_classification=data.get("flag_classification", "release"),
        is_permanent=data.get("is_permanent", False),
        expires_at=None,  # Set via separate endpoint or update
        ticket_url=data.get("ticket_url"),
        runbook_url=data.get("runbook_url"),
        owner_team=data.get("owner_team"),
        namespace=data.get("namespace"),
        variations=variation_rows,
    )

    result = await flag_repository.create_flag(session, flag)

    await audit_repository.create_log(
        session, action="created", entity_type="flag",
        entity_id=flag.id, entity_key=flag.key,
        actor=data.get("created_by", "system"),
        changes={"name": flag.name, "flag_type": flag.flag_type, "environment": flag.environment},
    )

    await _notify_flag_change("flag.created", flag, session)
    return result


async def update_flag(
    session: AsyncSession,
    existing: FeatureFlagDB,
    data: dict[str, Any],
) -> FeatureFlagDB:
    changes: dict[str, Any] = {}
    simple_fields = ("name", "description", "flag_type", "environment", "owner", "flag_classification", "ticket_url", "runbook_url", "owner_team", "namespace")
    for field in simple_fields:
        if field in data:
            old_val = getattr(existing, field)
            if old_val != data[field]:
                changes[field] = {"old": old_val, "new": data[field]}
            setattr(existing, field, data[field])

    if "tags" in data:
        old_tags = existing.get_tags()
        if old_tags != data["tags"]:
            changes["tags"] = {"old": old_tags, "new": data["tags"]}
        existing.set_tags(data["tags"])

    if "targeting_rules" in data:
        changes["targeting_rules"] = {"updated": True}
        existing.set_targeting_rules(data["targeting_rules"])

    if "prerequisites" in data:
        prereq_data = data["prerequisites"]
        prereqs = [
            p if isinstance(p, dict) else p.model_dump() if hasattr(p, 'model_dump') else {"flag_key": p.flag_key, "variation_key": p.variation_key}
            for p in prereq_data
        ]
        await _check_circular_prerequisites(session, existing.key, prereqs)
        changes["prerequisites"] = {"updated": True}
        existing.set_prerequisites(prereqs)

    if "is_permanent" in data:
        old_val = getattr(existing, 'is_permanent', False)
        if old_val != data["is_permanent"]:
            changes["is_permanent"] = {"old": old_val, "new": data["is_permanent"]}
        existing.is_permanent = data["is_permanent"]

    if "expires_at" in data:
        if data["expires_at"]:
            from datetime import datetime as dt
            existing.expires_at = dt.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
        else:
            existing.expires_at = None
        changes["expires_at"] = {"updated": True}

    if "lifecycle_stage" in data and data["lifecycle_stage"]:
        valid_stages = ("development", "testing", "production", "stale", "archived")
        if data["lifecycle_stage"] in valid_stages:
            old_stage = existing.lifecycle_stage
            if old_stage != data["lifecycle_stage"]:
                changes["lifecycle_stage"] = {"old": old_stage, "new": data["lifecycle_stage"]}
            existing.lifecycle_stage = data["lifecycle_stage"]

    if "variations" in data:
        changes["variations"] = {"updated": True}
        existing.variations.clear()
        default_variation_id: str | None = None
        for v in data["variations"]:
            vid = str(uuid4())
            row = VariationDB(
                id=vid, flag_id=existing.id,
                key=v["key"], name=v.get("name") or v["key"],
                value=json.dumps(v["value"]), description=v.get("description"),
            )
            existing.variations.append(row)
            if v["key"] == data.get("default_variation_key"):
                default_variation_id = vid
        if default_variation_id:
            existing.default_variation_id = default_variation_id

    existing.updated_at = datetime.now(UTC)
    result = await flag_repository.update_flag(session, existing)

    if changes:
        await audit_repository.create_log(
            session, action="updated", entity_type="flag",
            entity_id=existing.id, entity_key=existing.key, changes=changes,
        )

    await _notify_flag_change("flag.updated", existing, session)
    return result


async def toggle_flag(session: AsyncSession, flag: FeatureFlagDB) -> FeatureFlagDB:
    old_status = flag.status
    if flag.status == "active":
        flag.status = "inactive"
    else:
        flag.status = "active"
        if flag.lifecycle_stage in ("development", "testing"):
            flag.lifecycle_stage = "production"
    flag.updated_at = datetime.now(UTC)
    result = await flag_repository.update_flag(session, flag)

    await audit_repository.create_log(
        session, action="toggled", entity_type="flag",
        entity_id=flag.id, entity_key=flag.key,
        changes={"status": {"old": old_status, "new": flag.status}},
    )
    await _notify_flag_change("flag.toggled", flag, session)
    return result


async def archive_flag(session: AsyncSession, flag: FeatureFlagDB) -> FeatureFlagDB:
    old_status = flag.status
    flag.status = "archived"
    flag.updated_at = datetime.now(UTC)
    result = await flag_repository.update_flag(session, flag)

    await audit_repository.create_log(
        session, action="archived", entity_type="flag",
        entity_id=flag.id, entity_key=flag.key,
        changes={"status": {"old": old_status, "new": "archived"}},
    )
    await _notify_flag_change("flag.archived", flag, session)
    return result


async def restore_flag(session: AsyncSession, flag: FeatureFlagDB) -> FeatureFlagDB:
    old_status = flag.status
    flag.status = "inactive"
    flag.updated_at = datetime.now(UTC)
    result = await flag_repository.update_flag(session, flag)

    await audit_repository.create_log(
        session, action="restored", entity_type="flag",
        entity_id=flag.id, entity_key=flag.key,
        changes={"status": {"old": old_status, "new": "inactive"}},
    )
    await _notify_flag_change("flag.restored", flag, session)
    return result


async def clone_flag(session: AsyncSession, flag: FeatureFlagDB) -> FeatureFlagDB:
    base_key = flag.key + "-copy"
    new_key = base_key
    counter = 1
    while await flag_repository.get_flag_by_key(session, new_key) is not None:
        counter += 1
        new_key = f"{base_key}-{counter}"

    new_flag_id = str(uuid4())
    variation_rows: list[VariationDB] = []
    default_variation_id: str | None = None
    for v in flag.variations:
        vid = str(uuid4())
        row = VariationDB(
            id=vid, flag_id=new_flag_id,
            key=v.key, name=v.name, value=v.value, description=v.description,
        )
        variation_rows.append(row)
        if v.id == flag.default_variation_id:
            default_variation_id = vid

    if default_variation_id is None and variation_rows:
        default_variation_id = variation_rows[0].id

    new_flag = FeatureFlagDB(
        id=new_flag_id, key=new_key, name=f"{flag.name} (Copy)",
        description=flag.description, flag_type=flag.flag_type,
        status="inactive", environment=flag.environment,
        default_variation_id=default_variation_id or "",
        tags=flag.tags, targeting_rules=flag.targeting_rules,
        created_by=flag.created_by, owner=flag.owner,
        variations=variation_rows,
    )

    result = await flag_repository.create_flag(session, new_flag)

    await audit_repository.create_log(
        session, action="cloned", entity_type="flag",
        entity_id=new_flag.id, entity_key=new_flag.key,
        changes={"cloned_from": flag.key},
    )
    await _notify_flag_change("flag.created", new_flag, session)
    return result


async def delete_flag(session: AsyncSession, flag: FeatureFlagDB) -> None:
    await audit_repository.create_log(
        session, action="deleted", entity_type="flag",
        entity_id=flag.id, entity_key=flag.key,
        changes={"name": flag.name, "flag_type": flag.flag_type},
    )
    await _notify_flag_change("flag.deleted", flag, session)
    await flag_repository.delete_flag(session, flag)


async def compile_ruleset(session: AsyncSession) -> list[dict[str, Any]]:
    active_flags = await flag_repository.list_active_flags(session)
    ruleset: list[dict[str, Any]] = []

    for flag in active_flags:
        variations = [
            {"id": v.id, "key": v.key, "name": v.name, "value": v.get_value(), "description": v.description}
            for v in flag.variations
        ]
        ruleset.append({
            "id": flag.id, "key": flag.key, "name": flag.name,
            "flag_type": flag.flag_type, "status": flag.status,
            "environment": flag.environment,
            "default_variation_id": flag.default_variation_id,
            "variations": variations,
            "targeting_rules": flag.get_targeting_rules(),
            "tags": flag.get_tags(),
        })

    return ruleset
