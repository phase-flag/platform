"""Migration service — vendor migration workflow engine.

Handles importing flags from LaunchDarkly, Unleash, Flagsmith, and ConfigCat
by transforming their flag definitions into Phase Flag format.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import MigrationJob, MigrationMapping


# ---------------------------------------------------------------------------
# Key normalization
# ---------------------------------------------------------------------------

def _normalize_key(key: str) -> str:
    """Convert a flag key to Phase Flag format (lowercase, hyphens)."""
    normalized = re.sub(r"[^a-zA-Z0-9_\-.]", "-", key)
    normalized = re.sub(r"-+", "-", normalized).strip("-").lower()
    return normalized[:255]


# ---------------------------------------------------------------------------
# Vendor-specific transformers
# ---------------------------------------------------------------------------

def _transform_launchdarkly_flag(flag: Dict[str, Any]) -> Dict[str, Any]:
    """Transform a LaunchDarkly flag export into Phase Flag format.

    LD export format (simplified):
    {
      "key": "my-flag",
      "name": "My Flag",
      "description": "...",
      "kind": "boolean" | "multivariate",
      "variations": [{"value": true}, {"value": false}],
      "on": true,
      "fallthrough": {"variation": 0},
      "offVariation": 1,
      "targets": [{"values": ["user1"], "variation": 0}],
      "rules": [{"clauses": [...], "variation": 0}],
      "tags": ["tag1"]
    }
    """
    key = _normalize_key(flag.get("key", ""))
    kind = flag.get("kind", "boolean")
    variations_raw = flag.get("variations", [])

    # Map LD type to PF type
    if kind == "boolean":
        flag_type = "boolean"
    elif kind == "multivariate":
        # Infer from first variation value
        if variations_raw:
            first_val = variations_raw[0].get("value")
            if isinstance(first_val, bool):
                flag_type = "boolean"
            elif isinstance(first_val, (int, float)):
                flag_type = "number"
            elif isinstance(first_val, dict):
                flag_type = "json"
            else:
                flag_type = "string"
        else:
            flag_type = "string"
    else:
        flag_type = "string"

    variations = []
    for i, v in enumerate(variations_raw):
        variations.append({
            "key": f"variation_{i}",
            "value": v.get("value"),
            "name": v.get("name", f"Variation {i}"),
        })

    # Convert targeting rules
    targeting_rules = []
    for ri, rule in enumerate(flag.get("rules", [])):
        conditions = []
        for clause in rule.get("clauses", []):
            op_map = {
                "in": "one_of",
                "notIn": "not_one_of",
                "contains": "contains",
                "startsWith": "contains",
                "matches": "matches_regex",
                "lessThan": "lt",
                "greaterThan": "gt",
                "semVerGreaterThan": "version_gt",
                "semVerLessThan": "version_lt",
            }
            conditions.append({
                "attribute": clause.get("attribute", ""),
                "operator": op_map.get(clause.get("op", ""), clause.get("op", "is")),
                "value": clause.get("values", []),
            })
        variation_idx = rule.get("variation", 0)
        targeting_rules.append({
            "priority": ri + 1,
            "conditions": conditions,
            "variation": f"variation_{variation_idx}" if variation_idx < len(variations_raw) else "variation_0",
        })

    return {
        "key": key,
        "name": flag.get("name", key),
        "description": flag.get("description", ""),
        "type": flag_type,
        "is_active": flag.get("on", False),
        "variations": variations,
        "targeting_rules": targeting_rules,
        "tags": flag.get("tags", []),
        "default_variation": f"variation_{flag.get('fallthrough', {}).get('variation', 0)}",
        "off_variation": f"variation_{flag.get('offVariation', len(variations_raw) - 1)}",
    }


def _transform_unleash_flag(flag: Dict[str, Any]) -> Dict[str, Any]:
    """Transform an Unleash feature toggle into Phase Flag format.

    Unleash export format:
    {
      "name": "my-toggle",
      "description": "...",
      "type": "release",
      "enabled": true,
      "strategies": [
        {"name": "default", "parameters": {}},
        {"name": "userWithId", "parameters": {"userIds": "user1,user2"}},
        {"name": "gradualRolloutRandom", "parameters": {"percentage": "50"}}
      ],
      "variants": [{"name": "blue", "weight": 50}, {"name": "red", "weight": 50}]
    }
    """
    key = _normalize_key(flag.get("name", ""))

    variants = flag.get("variants", [])
    if variants:
        flag_type = "string"
        variations = [{"key": v.get("name", f"v{i}"), "value": v.get("name", ""), "name": v.get("name", "")} for i, v in enumerate(variants)]
    else:
        flag_type = "boolean"
        variations = [
            {"key": "on", "value": True, "name": "On"},
            {"key": "off", "value": False, "name": "Off"},
        ]

    targeting_rules = []
    for si, strategy in enumerate(flag.get("strategies", [])):
        sname = strategy.get("name", "")
        params = strategy.get("parameters", {})

        if sname == "userWithId":
            user_ids = [uid.strip() for uid in params.get("userIds", "").split(",") if uid.strip()]
            if user_ids:
                targeting_rules.append({
                    "priority": si + 1,
                    "conditions": [{"attribute": "user_id", "operator": "one_of", "value": user_ids}],
                    "variation": variations[0]["key"] if variations else "on",
                })
        elif sname in ("gradualRolloutRandom", "flexibleRollout"):
            pct = int(params.get("percentage", "100"))
            targeting_rules.append({
                "priority": si + 1,
                "conditions": [],
                "variation": variations[0]["key"] if variations else "on",
                "rollout_percentage": pct,
            })

    return {
        "key": key,
        "name": flag.get("name", key),
        "description": flag.get("description", ""),
        "type": flag_type,
        "is_active": flag.get("enabled", False),
        "variations": variations,
        "targeting_rules": targeting_rules,
        "tags": [],
        "default_variation": variations[0]["key"] if variations else "on",
        "off_variation": variations[-1]["key"] if variations else "off",
    }


def _transform_flagsmith_flag(flag: Dict[str, Any]) -> Dict[str, Any]:
    """Transform a Flagsmith feature into Phase Flag format.

    Flagsmith export format:
    {
      "name": "my_feature",
      "description": "...",
      "enabled": true,
      "initial_value": "some_value",
      "type": "STANDARD" | "MULTIVARIATE",
      "multivariate_options": [{"string_value": "a", "percentage_allocation": 50}]
    }
    """
    key = _normalize_key(flag.get("name", ""))
    initial_value = flag.get("initial_value", "")
    ft = flag.get("type", "STANDARD")

    if ft == "MULTIVARIATE":
        flag_type = "string"
        mv_options = flag.get("multivariate_options", [])
        variations = [
            {"key": f"variant_{i}", "value": opt.get("string_value", ""), "name": f"Variant {i}"}
            for i, opt in enumerate(mv_options)
        ]
        if not variations:
            variations = [{"key": "default", "value": initial_value, "name": "Default"}]
    else:
        # Check if initial_value is boolean-like
        if initial_value in ("true", "false", "True", "False", True, False):
            flag_type = "boolean"
            variations = [
                {"key": "on", "value": True, "name": "On"},
                {"key": "off", "value": False, "name": "Off"},
            ]
        elif initial_value:
            flag_type = "string"
            variations = [{"key": "default", "value": initial_value, "name": "Default"}]
        else:
            flag_type = "boolean"
            variations = [
                {"key": "on", "value": True, "name": "On"},
                {"key": "off", "value": False, "name": "Off"},
            ]

    return {
        "key": key,
        "name": flag.get("name", key),
        "description": flag.get("description", ""),
        "type": flag_type,
        "is_active": flag.get("enabled", False),
        "variations": variations,
        "targeting_rules": [],
        "tags": flag.get("tags", []) if isinstance(flag.get("tags"), list) else [],
        "default_variation": variations[0]["key"],
        "off_variation": variations[-1]["key"],
    }


def _transform_configcat_flag(flag: Dict[str, Any]) -> Dict[str, Any]:
    """Transform a ConfigCat setting into Phase Flag format."""
    key = _normalize_key(flag.get("key", flag.get("settingId", "")))
    setting_type = flag.get("settingType", "boolean")

    type_map = {"boolean": "boolean", "string": "string", "int": "number", "double": "number"}
    flag_type = type_map.get(setting_type, "string")

    value = flag.get("value")
    variations = []
    if flag_type == "boolean":
        variations = [
            {"key": "on", "value": True, "name": "On"},
            {"key": "off", "value": False, "name": "Off"},
        ]
    else:
        variations = [{"key": "default", "value": value, "name": "Default"}]

    # Convert targeting rules from ConfigCat's format
    targeting_rules = []
    for ri, rule in enumerate(flag.get("targetingRules", [])):
        conditions = []
        for cond in rule.get("conditions", []):
            user_cond = cond.get("userCondition", {})
            if user_cond:
                comparator_map = {
                    "isOneOf": "one_of",
                    "isNotOneOf": "not_one_of",
                    "contains": "contains",
                    "notContains": "not_contains",
                    "semVerIsOneOf": "one_of",
                    "numberEquals": "is",
                    "numberGreater": "gt",
                    "numberLess": "lt",
                }
                conditions.append({
                    "attribute": user_cond.get("comparisonAttribute", ""),
                    "operator": comparator_map.get(user_cond.get("comparator", ""), "is"),
                    "value": user_cond.get("comparisonValue", ""),
                })
        served = rule.get("then", {})
        targeting_rules.append({
            "priority": ri + 1,
            "conditions": conditions,
            "variation": "on" if served.get("value") else "off",
        })

    return {
        "key": key,
        "name": flag.get("name", key),
        "description": flag.get("hint", ""),
        "type": flag_type,
        "is_active": True,
        "variations": variations,
        "targeting_rules": targeting_rules,
        "tags": [],
        "default_variation": variations[0]["key"],
        "off_variation": variations[-1]["key"],
    }


# Transformer registry
_TRANSFORMERS = {
    "launchdarkly": _transform_launchdarkly_flag,
    "unleash": _transform_unleash_flag,
    "flagsmith": _transform_flagsmith_flag,
    "configcat": _transform_configcat_flag,
}


# ---------------------------------------------------------------------------
# Migration service
# ---------------------------------------------------------------------------

async def create_migration(
    session: AsyncSession,
    organization_id: str,
    source: str,
    flags: List[Dict[str, Any]],
    created_by: Optional[str] = None,
) -> Tuple[MigrationJob, List[MigrationMapping]]:
    """Create a migration job and process flags."""
    transformer = _TRANSFORMERS.get(source)
    if not transformer:
        # Use a generic passthrough for unknown sources
        transformer = lambda f: {
            "key": _normalize_key(f.get("key", f.get("name", "unknown"))),
            "name": f.get("name", ""),
            "description": f.get("description", ""),
            "type": "boolean",
            "is_active": f.get("enabled", False),
            "variations": [
                {"key": "on", "value": True, "name": "On"},
                {"key": "off", "value": False, "name": "Off"},
            ],
            "targeting_rules": [],
            "tags": [],
            "default_variation": "on",
            "off_variation": "off",
        }

    job = MigrationJob(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        source=source,
        status="running",
        total_flags=len(flags),
        created_by=created_by,
        started_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    session.add(job)
    await session.flush()

    mappings: List[MigrationMapping] = []
    errors: List[str] = []
    imported = 0
    failed = 0
    skipped = 0

    for flag_data in flags:
        source_key = flag_data.get("key", flag_data.get("name", "unknown"))
        try:
            transformed = transformer(flag_data)
            target_key = transformed["key"]

            if not target_key:
                skipped += 1
                mapping = MigrationMapping(
                    id=str(uuid.uuid4()),
                    job_id=job.id,
                    source_key=str(source_key),
                    source_name=flag_data.get("name"),
                    target_key="",
                    flag_type=transformed.get("type", "boolean"),
                    status="skipped",
                    source_data=json.dumps(flag_data),
                    error="Empty key after normalization",
                    created_at=datetime.utcnow(),
                )
                session.add(mapping)
                mappings.append(mapping)
                continue

            mapping = MigrationMapping(
                id=str(uuid.uuid4()),
                job_id=job.id,
                source_key=str(source_key),
                source_name=flag_data.get("name"),
                target_key=target_key,
                flag_type=transformed.get("type", "boolean"),
                status="imported",
                source_data=json.dumps(flag_data),
                target_data=json.dumps(transformed),
                created_at=datetime.utcnow(),
            )
            session.add(mapping)
            mappings.append(mapping)
            imported += 1

        except Exception as exc:
            failed += 1
            error_msg = f"Flag '{source_key}': {exc}"
            errors.append(error_msg)
            mapping = MigrationMapping(
                id=str(uuid.uuid4()),
                job_id=job.id,
                source_key=str(source_key),
                source_name=flag_data.get("name"),
                target_key=_normalize_key(str(source_key)),
                status="failed",
                source_data=json.dumps(flag_data),
                error=str(exc),
                created_at=datetime.utcnow(),
            )
            session.add(mapping)
            mappings.append(mapping)

    job.imported_flags = imported
    job.skipped_flags = skipped
    job.failed_flags = failed
    job.error_log = json.dumps(errors) if errors else None
    job.status = "completed" if failed == 0 else "completed_with_errors"
    job.completed_at = datetime.utcnow()
    await session.flush()

    return job, mappings


async def import_from_launchdarkly(
    session: AsyncSession,
    organization_id: str,
    flags: List[Dict[str, Any]],
    created_by: Optional[str] = None,
) -> Tuple[MigrationJob, List[MigrationMapping]]:
    return await create_migration(session, organization_id, "launchdarkly", flags, created_by)


async def import_from_unleash(
    session: AsyncSession,
    organization_id: str,
    flags: List[Dict[str, Any]],
    created_by: Optional[str] = None,
) -> Tuple[MigrationJob, List[MigrationMapping]]:
    return await create_migration(session, organization_id, "unleash", flags, created_by)


async def import_from_flagsmith(
    session: AsyncSession,
    organization_id: str,
    flags: List[Dict[str, Any]],
    created_by: Optional[str] = None,
) -> Tuple[MigrationJob, List[MigrationMapping]]:
    return await create_migration(session, organization_id, "flagsmith", flags, created_by)


async def import_from_configcat(
    session: AsyncSession,
    organization_id: str,
    flags: List[Dict[str, Any]],
    created_by: Optional[str] = None,
) -> Tuple[MigrationJob, List[MigrationMapping]]:
    return await create_migration(session, organization_id, "configcat", flags, created_by)


async def get_job(session: AsyncSession, job_id: str) -> Optional[MigrationJob]:
    stmt = select(MigrationJob).where(MigrationJob.id == job_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_jobs(
    session: AsyncSession, organization_id: str
) -> List[MigrationJob]:
    stmt = (
        select(MigrationJob)
        .where(MigrationJob.organization_id == organization_id)
        .order_by(MigrationJob.created_at.desc())
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_mappings(
    session: AsyncSession, job_id: str
) -> List[MigrationMapping]:
    stmt = (
        select(MigrationMapping)
        .where(MigrationMapping.job_id == job_id)
        .order_by(MigrationMapping.source_key)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
