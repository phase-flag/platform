"""Feature-flag CRUD endpoints."""

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.repositories import flag_repository
from phaseflag_api.services import flag_service

router = APIRouter(dependencies=[Depends(require_api_key)])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class VariationIn(BaseModel):
    key: str = Field(..., examples=["on"])
    name: str | None = Field(None, examples=["Enabled"])
    value: Any = Field(..., examples=[True])
    description: str | None = None


_VALID_FLAG_TYPES = {"boolean", "string", "number", "json"}
_VALID_ENVIRONMENTS = {"development", "staging", "production"}
_KEY_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,127}$")


_VALID_OPERATORS = {
    "is",
    "is_not",
    "contains",
    "not_contains",
    "one_of",
    "not_one_of",
    "gt",
    "lt",
    "matches_regex",
    "version_gt",
    "version_lt",
}


class TargetingConditionIn(BaseModel):
    attribute: str = Field(..., min_length=1, max_length=255)
    operator: str = Field(...)
    value: Any = Field(...)

    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v: str) -> str:
        if v not in _VALID_OPERATORS:
            raise ValueError(
                f"operator must be one of: {', '.join(sorted(_VALID_OPERATORS))}"
            )
        return v

    @field_validator("value")
    @classmethod
    def validate_regex_value(cls, v: Any, info) -> Any:
        """Pre-validate regex patterns at write time to prevent ReDoS."""
        if info.data.get("operator") == "matches_regex" and isinstance(v, str):
            if len(v) > 500:
                raise ValueError("Regex pattern must be 500 characters or fewer")
            try:
                re.compile(v)
            except re.error as exc:
                raise ValueError(f"Invalid regex pattern: {exc}")
        return v


class TargetingRuleIn(BaseModel):
    priority: int = Field(0, ge=0, le=10000)
    conditions: list[TargetingConditionIn] = Field(default=[], max_length=50)
    variation_id: str | None = None
    segment_id: str | None = None
    percentage_rollout: dict[str, Any] | None = None


class FlagCreate(BaseModel):
    key: str = Field(..., examples=["dark-mode"])
    name: str = Field(..., min_length=1, max_length=255, examples=["Dark Mode"])
    description: str | None = Field(None, examples=["Enable dark mode for users"])
    flag_type: str = Field("boolean", examples=["boolean"])
    environment: str = Field("development", examples=["production"])
    variations: list[VariationIn] = Field(..., min_length=1)
    default_variation_key: str = Field(..., examples=["off"])
    tags: list[str] = Field(default=[], max_length=50, examples=[["ui", "experiment"]])
    targeting_rules: list[TargetingRuleIn] = []
    created_by: str = Field("system", examples=["admin@example.com"])
    owner: str | None = None
    flag_classification: str = Field("release", examples=["release"])
    is_permanent: bool = Field(False)
    ticket_url: str | None = None
    runbook_url: str | None = None
    owner_team: str | None = None
    namespace: str | None = None

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        if not _KEY_PATTERN.match(v):
            raise ValueError(
                "Key must be lowercase alphanumeric with hyphens/dots/underscores (max 128 chars)"
            )
        return v

    @field_validator("flag_type")
    @classmethod
    def validate_flag_type(cls, v: str) -> str:
        if v not in _VALID_FLAG_TYPES:
            raise ValueError(
                f"flag_type must be one of: {', '.join(sorted(_VALID_FLAG_TYPES))}"
            )
        return v

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        if v not in _VALID_ENVIRONMENTS:
            raise ValueError(
                f"environment must be one of: {', '.join(sorted(_VALID_ENVIRONMENTS))}"
            )
        return v

    @field_validator("flag_classification")
    @classmethod
    def validate_classification(cls, v: str) -> str:
        valid = {"release", "experiment", "ops_killswitch", "permission", "migration"}
        if v not in valid:
            raise ValueError(
                f"flag_classification must be one of: {', '.join(sorted(valid))}"
            )
        return v


class PrerequisiteIn(BaseModel):
    flag_key: str
    variation_key: str


class FlagUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    flag_type: str | None = None
    environment: str | None = None
    variations: list[VariationIn] | None = None
    default_variation_key: str | None = None
    tags: list[str] | None = None
    targeting_rules: list[TargetingRuleIn] | None = None
    owner: str | None = None
    prerequisites: list[PrerequisiteIn] | None = None
    lifecycle_stage: str | None = None
    flag_classification: str | None = None
    is_permanent: bool | None = None
    expires_at: str | None = None
    ticket_url: str | None = None
    runbook_url: str | None = None
    owner_team: str | None = None
    namespace: str | None = None


class ScheduleRequest(BaseModel):
    scheduled_on: str = Field(
        ..., examples=["2026-03-15T00:00:00Z"], description="ISO 8601 UTC datetime"
    )
    scheduled_status: str = Field(
        ..., examples=["active"], description="Target status: active or inactive"
    )


class VariationOut(BaseModel):
    id: str
    key: str
    name: str
    value: Any
    description: str | None = None


class PrerequisiteOut(BaseModel):
    flag_key: str
    variation_key: str


class FlagOut(BaseModel):
    id: str
    key: str
    name: str
    description: str | None
    flag_type: str
    status: str
    environment: str
    default_variation_id: str
    variations: list[VariationOut]
    targeting_rules: list[dict[str, Any]]
    tags: list[str]
    prerequisites: list[PrerequisiteOut] = []
    lifecycle_stage: str = "development"
    flag_classification: str = "release"
    is_permanent: bool = False
    expires_at: str | None = None
    ticket_url: str | None = None
    runbook_url: str | None = None
    owner_team: str | None = None
    namespace: str | None = None
    scheduled_on: str | None = None
    scheduled_status: str | None = None
    created_by: str
    owner: str
    evaluation_count: int
    last_evaluated_at: str | None
    created_at: str
    updated_at: str


class PaginatedFlags(BaseModel):
    items: list[FlagOut]
    total: int
    limit: int
    offset: int


def _flag_to_out(flag) -> FlagOut:
    prereqs = flag.get_prerequisites() if hasattr(flag, "get_prerequisites") else []
    return FlagOut(
        id=flag.id,
        key=flag.key,
        name=flag.name,
        description=flag.description,
        flag_type=flag.flag_type,
        status=flag.status,
        environment=flag.environment,
        default_variation_id=flag.default_variation_id,
        variations=[
            VariationOut(
                id=v.id,
                key=v.key,
                name=v.name,
                value=v.get_value(),
                description=v.description,
            )
            for v in flag.variations
        ],
        targeting_rules=flag.get_targeting_rules(),
        tags=flag.get_tags(),
        prerequisites=[
            PrerequisiteOut(flag_key=p["flag_key"], variation_key=p["variation_key"])
            for p in prereqs
        ],
        lifecycle_stage=getattr(flag, "lifecycle_stage", "development")
        or "development",
        flag_classification=getattr(flag, "flag_classification", "release")
        or "release",
        is_permanent=getattr(flag, "is_permanent", False) or False,
        expires_at=flag.expires_at.isoformat()
        if getattr(flag, "expires_at", None)
        else None,
        ticket_url=getattr(flag, "ticket_url", None),
        runbook_url=getattr(flag, "runbook_url", None),
        owner_team=getattr(flag, "owner_team", None),
        namespace=getattr(flag, "namespace", None),
        scheduled_on=flag.scheduled_on.isoformat()
        if getattr(flag, "scheduled_on", None)
        else None,
        scheduled_status=getattr(flag, "scheduled_status", None),
        created_by=flag.created_by,
        owner=flag.owner,
        evaluation_count=flag.evaluation_count or 0,
        last_evaluated_at=flag.last_evaluated_at.isoformat()
        if flag.last_evaluated_at
        else None,
        created_at=flag.created_at.isoformat(),
        updated_at=flag.updated_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/flags", response_model=PaginatedFlags)
async def list_flags(
    environment: str | None = Query(None),
    flag_status: str | None = Query(None, alias="status"),
    lifecycle_stage: str | None = Query(None),
    namespace: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    flags, total = await flag_repository.list_flags(
        session,
        environment=environment,
        status=flag_status,
        lifecycle_stage=lifecycle_stage,
        namespace=namespace,
        limit=limit,
        offset=offset,
    )
    return PaginatedFlags(
        items=[_flag_to_out(f) for f in flags],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/flags/export")
async def export_flags(session: AsyncSession = Depends(get_session)):
    flags, _total = await flag_repository.list_flags(session, limit=10000, offset=0)
    export_data = []
    for f in flags:
        export_data.append(
            {
                "key": f.key,
                "name": f.name,
                "description": f.description,
                "flag_type": f.flag_type,
                "status": f.status,
                "environment": f.environment,
                "tags": f.get_tags(),
                "targeting_rules": f.get_targeting_rules(),
                "created_by": f.created_by,
                "owner": f.owner,
                "variations": [
                    {
                        "key": v.key,
                        "name": v.name,
                        "value": v.get_value(),
                        "description": v.description,
                    }
                    for v in f.variations
                ],
                "default_variation_key": next(
                    (v.key for v in f.variations if v.id == f.default_variation_id),
                    f.variations[0].key if f.variations else "off",
                ),
            }
        )
    return {"version": "1.0", "flags": export_data}


class FlagImportInput(BaseModel):
    version: str = "1.0"
    flags: list[FlagCreate]
    overwrite: bool = Field(False)


@router.post(
    "/flags/import",
    status_code=status.HTTP_200_OK,
    dependencies=[require_role("admin")],
)
async def import_flags(
    body: FlagImportInput, session: AsyncSession = Depends(get_session)
):
    created = 0
    skipped = 0
    for flag_data in body.flags:
        existing = await flag_repository.get_flag_by_key(session, flag_data.key)
        if existing is not None:
            if not body.overwrite:
                skipped += 1
                continue
            await flag_service.update_flag(
                session, existing, flag_data.model_dump(exclude_unset=True)
            )
            created += 1
        else:
            await flag_service.create_flag(session, flag_data.model_dump())
            created += 1
    return {"imported": created, "skipped": skipped}


@router.get("/flags/{key}", response_model=FlagOut)
async def get_flag(key: str, session: AsyncSession = Depends(get_session)):
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found"
        )
    return _flag_to_out(flag)


@router.post(
    "/flags",
    response_model=FlagOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role("editor")],
)
async def create_flag(body: FlagCreate, session: AsyncSession = Depends(get_session)):
    existing = await flag_repository.get_flag_by_key(session, body.key)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Flag with key '{body.key}' already exists",
        )
    flag = await flag_service.create_flag(session, body.model_dump())
    return _flag_to_out(flag)


@router.put(
    "/flags/{key}", response_model=FlagOut, dependencies=[require_role("editor")]
)
async def update_flag(
    key: str, body: FlagUpdate, session: AsyncSession = Depends(get_session)
):
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found"
        )
    data = body.model_dump(exclude_unset=True)
    updated = await flag_service.update_flag(session, flag, data)
    return _flag_to_out(updated)


@router.post(
    "/flags/{key}/toggle", response_model=FlagOut, dependencies=[require_role("editor")]
)
async def toggle_flag(key: str, session: AsyncSession = Depends(get_session)):
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found"
        )
    if flag.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot toggle an archived flag",
        )
    toggled = await flag_service.toggle_flag(session, flag)
    return _flag_to_out(toggled)


@router.post(
    "/flags/{key}/archive",
    response_model=FlagOut,
    dependencies=[require_role("editor")],
)
async def archive_flag(key: str, session: AsyncSession = Depends(get_session)):
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found"
        )
    if flag.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Flag is already archived"
        )
    archived = await flag_service.archive_flag(session, flag)
    return _flag_to_out(archived)


@router.post(
    "/flags/{key}/restore",
    response_model=FlagOut,
    dependencies=[require_role("editor")],
)
async def restore_flag(key: str, session: AsyncSession = Depends(get_session)):
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found"
        )
    if flag.status != "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only archived flags can be restored",
        )
    restored = await flag_service.restore_flag(session, flag)
    return _flag_to_out(restored)


@router.post(
    "/flags/{key}/clone",
    response_model=FlagOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role("editor")],
)
async def clone_flag(key: str, session: AsyncSession = Depends(get_session)):
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found"
        )
    cloned = await flag_service.clone_flag(session, flag)
    return _flag_to_out(cloned)


@router.delete(
    "/flags/{key}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[require_role("admin")],
)
async def delete_flag(key: str, session: AsyncSession = Depends(get_session)):
    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found"
        )
    if flag.status != "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Flag must be archived before it can be deleted",
        )
    await flag_service.delete_flag(session, flag)


@router.post(
    "/flags/{key}/schedule",
    response_model=FlagOut,
    dependencies=[require_role("editor")],
)
async def schedule_flag(
    key: str, body: ScheduleRequest, session: AsyncSession = Depends(get_session)
):
    from datetime import UTC, datetime as dt

    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found"
        )
    if flag.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot schedule changes for an archived flag",
        )
    if body.scheduled_status not in ("active", "inactive"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scheduled_status must be 'active' or 'inactive'",
        )

    scheduled_on = dt.fromisoformat(body.scheduled_on.replace("Z", "+00:00"))
    if scheduled_on <= dt.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scheduled_on must be in the future",
        )

    flag.scheduled_on = scheduled_on
    flag.scheduled_status = body.scheduled_status
    flag.updated_at = dt.now(UTC)
    await flag_repository.update_flag(session, flag)

    from phaseflag_api.repositories import audit_repository

    await audit_repository.create_log(
        session,
        action="scheduled",
        entity_type="flag",
        entity_id=flag.id,
        entity_key=flag.key,
        changes={
            "scheduled_on": body.scheduled_on,
            "scheduled_status": body.scheduled_status,
        },
    )
    return _flag_to_out(flag)


@router.post("/flags/{key}/kill", dependencies=[require_role("editor")])
async def kill_flag(key: str, session: AsyncSession = Depends(get_session)):
    """Emergency kill switch: immediately disable a flag and pause its rollout pipelines."""
    from phaseflag_api.services import rollout_service

    result = await rollout_service.emergency_kill(session, key)
    return result


@router.delete(
    "/flags/{key}/schedule",
    response_model=FlagOut,
    dependencies=[require_role("editor")],
)
async def cancel_schedule(key: str, session: AsyncSession = Depends(get_session)):
    from datetime import UTC, datetime as dt

    flag = await flag_repository.get_flag_by_key(session, key)
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found"
        )
    if flag.scheduled_on is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No schedule set for this flag",
        )

    flag.scheduled_on = None
    flag.scheduled_status = None
    flag.updated_at = dt.now(UTC)
    await flag_repository.update_flag(session, flag)

    from phaseflag_api.repositories import audit_repository

    await audit_repository.create_log(
        session,
        action="schedule_cancelled",
        entity_type="flag",
        entity_id=flag.id,
        entity_key=flag.key,
        changes={"schedule": "cancelled"},
    )
    return _flag_to_out(flag)
