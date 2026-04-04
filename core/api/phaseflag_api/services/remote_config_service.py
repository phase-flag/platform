"""Remote config service — typed configuration management."""

import json
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.remote_config import RemoteConfigDB

logger = logging.getLogger(__name__)


async def create_config(
    session: AsyncSession,
    *,
    key: str,
    name: str,
    description: str | None = None,
    config_type: str = "string",
    value: Any,
    default_value: Any,
    environment: str = "development",
    schema_definition: dict | None = None,
    is_server_only: bool = False,
    owner: str = "system",
) -> RemoteConfigDB:
    existing = await get_config_by_key(session, key, environment)
    if existing:
        raise HTTPException(status_code=409, detail=f"Config '{key}' already exists in '{environment}'")

    # Validate value against schema if provided
    if schema_definition:
        valid, msg = validate_json_schema(value, schema_definition)
        if not valid:
            raise HTTPException(status_code=422, detail=f"Value does not match schema: {msg}")

    config = RemoteConfigDB(
        key=key, name=name, description=description,
        config_type=config_type,
        value=json.dumps(value),
        default_value=json.dumps(default_value),
        environment=environment,
        schema_definition=json.dumps(schema_definition) if schema_definition else None,
        is_server_only=is_server_only,
        owner=owner,
    )
    session.add(config)
    await session.flush()
    await session.refresh(config)
    return config


async def update_config(
    session: AsyncSession,
    config: RemoteConfigDB,
    data: dict[str, Any],
) -> RemoteConfigDB:
    if "value" in data:
        # If a schema is being set in the same update, use it; otherwise use existing
        schema_def = data.get("schema_definition") or config.get_schema()
        if schema_def:
            valid, msg = validate_json_schema(data["value"], schema_def)
            if not valid:
                raise HTTPException(status_code=422, detail=f"Value does not match schema: {msg}")
        config.set_value(data["value"])
        config.version += 1
    if "name" in data:
        config.name = data["name"]
    if "description" in data:
        config.description = data["description"]
    if "is_server_only" in data:
        config.is_server_only = data["is_server_only"]
    if "schema_definition" in data:
        config.schema_definition = json.dumps(data["schema_definition"]) if data["schema_definition"] else None
    config.updated_at = datetime.now(UTC)
    await session.flush()
    await session.refresh(config)
    return config


async def get_config_by_key(session: AsyncSession, key: str, environment: str) -> RemoteConfigDB | None:
    result = await session.execute(
        select(RemoteConfigDB).where(RemoteConfigDB.key == key, RemoteConfigDB.environment == environment)
    )
    return result.scalar_one_or_none()


async def get_config_by_id(session: AsyncSession, config_id: str) -> RemoteConfigDB | None:
    result = await session.execute(select(RemoteConfigDB).where(RemoteConfigDB.id == config_id))
    return result.scalar_one_or_none()


async def list_configs(
    session: AsyncSession,
    *,
    environment: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[RemoteConfigDB], int]:
    base = select(RemoteConfigDB)
    if environment:
        base = base.where(RemoteConfigDB.environment == environment)
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    items = (await session.execute(base.order_by(RemoteConfigDB.created_at.desc()).limit(limit).offset(offset))).scalars().all()
    return list(items), total


async def delete_config(session: AsyncSession, config: RemoteConfigDB) -> None:
    await session.delete(config)
    await session.flush()


async def get_client_configs(session: AsyncSession, environment: str) -> list[dict[str, Any]]:
    """Return configs safe for client-side consumption."""
    result = await session.execute(
        select(RemoteConfigDB)
        .where(RemoteConfigDB.environment == environment)
        .where(RemoteConfigDB.is_server_only == False)  # noqa: E712
    )
    configs = result.scalars().all()
    return [
        {"key": c.key, "value": c.get_value(), "type": c.config_type, "version": c.version}
        for c in configs
    ]


# ---------------------------------------------------------------------------
# Schema validation
# ---------------------------------------------------------------------------

def validate_json_schema(value: Any, schema: dict) -> tuple[bool, str]:
    """Simple JSON schema validation without external deps."""
    schema_type = schema.get("type")
    if schema_type == "string" and not isinstance(value, str):
        return False, f"Expected string, got {type(value).__name__}"
    if schema_type == "number" and not isinstance(value, (int, float)):
        return False, f"Expected number, got {type(value).__name__}"
    if schema_type == "boolean" and not isinstance(value, bool):
        return False, f"Expected boolean, got {type(value).__name__}"
    if schema_type == "object" and not isinstance(value, dict):
        return False, f"Expected object, got {type(value).__name__}"
    if schema_type == "array" and not isinstance(value, list):
        return False, f"Expected array, got {type(value).__name__}"
    # Check required fields for objects
    if schema_type == "object" and isinstance(value, dict) and "required" in schema:
        for field in schema["required"]:
            if field not in value:
                return False, f"Missing required field: {field}"
    # Check enum
    if "enum" in schema and value not in schema["enum"]:
        return False, f"Value must be one of: {schema['enum']}"
    return True, "valid"


async def get_config_history(session: AsyncSession, config_id: str, limit: int = 20) -> list[dict]:
    """Get version history for a config entry."""
    config = await session.get(RemoteConfigDB, config_id)
    if not config:
        return []
    return [{
        "version": config.version,
        "value": config.get_value(),
        "updated_at": config.updated_at.isoformat(),
        "is_current": True,
    }]


async def validate_config_value(session: AsyncSession, config_id: str, value: Any) -> dict:
    """Validate a value against the config's schema definition."""
    config = await session.get(RemoteConfigDB, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    schema = config.get_schema()
    if not schema:
        return {"valid": True, "message": "No schema defined; any value accepted."}
    valid, message = validate_json_schema(value, schema)
    return {"valid": valid, "message": message}
