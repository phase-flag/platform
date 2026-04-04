"""Remote configuration management endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.services import remote_config_service

router = APIRouter(prefix="/configs", dependencies=[Depends(require_api_key)])


class ConfigCreate(BaseModel):
    key: str = Field(..., examples=["max-upload-size"])
    name: str = Field(..., examples=["Max Upload Size"])
    description: str | None = None
    config_type: str = Field("string", examples=["number"])
    value: Any = Field(..., examples=[10485760])
    default_value: Any = Field(..., examples=[5242880])
    environment: str = Field("development", examples=["production"])
    schema_definition: dict | None = None
    is_server_only: bool = False


class ConfigUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    value: Any = None
    is_server_only: bool | None = None
    schema_definition: dict | None = None


class ConfigOut(BaseModel):
    id: str
    key: str
    name: str
    description: str | None
    config_type: str
    value: Any
    default_value: Any
    environment: str
    is_server_only: bool
    version: int
    owner: str
    created_at: str
    updated_at: str


class PaginatedConfigs(BaseModel):
    items: list[ConfigOut]
    total: int


def _config_to_out(c) -> ConfigOut:
    return ConfigOut(
        id=c.id,
        key=c.key,
        name=c.name,
        description=c.description,
        config_type=c.config_type,
        value=c.get_value(),
        default_value=c.get_default_value(),
        environment=c.environment,
        is_server_only=c.is_server_only,
        version=c.version,
        owner=c.owner,
        created_at=c.created_at.isoformat(),
        updated_at=c.updated_at.isoformat(),
    )


@router.post("", response_model=ConfigOut, status_code=201, dependencies=[require_role("editor")])
async def create_config(body: ConfigCreate, session: AsyncSession = Depends(get_session)):
    config = await remote_config_service.create_config(
        session,
        key=body.key,
        name=body.name,
        description=body.description,
        config_type=body.config_type,
        value=body.value,
        default_value=body.default_value,
        environment=body.environment,
        schema_definition=body.schema_definition,
        is_server_only=body.is_server_only,
    )
    return _config_to_out(config)


@router.get("", response_model=PaginatedConfigs)
async def list_configs(
    environment: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    items, total = await remote_config_service.list_configs(
        session, environment=environment, limit=limit, offset=offset
    )
    return PaginatedConfigs(items=[_config_to_out(c) for c in items], total=total)


@router.get("/{config_id}", response_model=ConfigOut)
async def get_config(config_id: str, session: AsyncSession = Depends(get_session)):
    config = await remote_config_service.get_config_by_id(session, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return _config_to_out(config)


@router.put("/{config_id}", response_model=ConfigOut, dependencies=[require_role("editor")])
async def update_config(config_id: str, body: ConfigUpdate, session: AsyncSession = Depends(get_session)):
    config = await remote_config_service.get_config_by_id(session, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    updated = await remote_config_service.update_config(session, config, body.model_dump(exclude_unset=True))
    return _config_to_out(updated)


@router.delete("/{config_id}", status_code=204, dependencies=[require_role("admin")])
async def delete_config(config_id: str, session: AsyncSession = Depends(get_session)):
    config = await remote_config_service.get_config_by_id(session, config_id)
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    await remote_config_service.delete_config(session, config)


@router.get("/{config_id}/history")
async def get_config_history(
    config_id: str,
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """Return version history for a config entry."""
    return await remote_config_service.get_config_history(session, config_id, limit=limit)


class ValidateRequest(BaseModel):
    value: Any


@router.post("/{config_id}/validate")
async def validate_config_value(
    config_id: str,
    body: ValidateRequest,
    session: AsyncSession = Depends(get_session),
):
    """Validate a value against the config's JSON schema definition."""
    return await remote_config_service.validate_config_value(session, config_id, body.value)


@router.get("/client/{environment}")
async def get_client_configs(environment: str, session: AsyncSession = Depends(get_session)):
    """Return all client-safe configs for an environment (for SDK consumption)."""
    return await remote_config_service.get_client_configs(session, environment)
