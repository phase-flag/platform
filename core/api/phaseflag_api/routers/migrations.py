"""Migration flag endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import get_current_user, require_api_key, require_role
from phaseflag_api.services import migration_service

router = APIRouter(dependencies=[Depends(require_api_key)])


class MigrationCreate(BaseModel):
    flag_key: str
    name: str
    description: str | None = None
    source_system: str | None = None
    target_system: str | None = None
    rollback_threshold: float | None = Field(None, ge=0, le=1)


class MigrationOut(BaseModel):
    id: str
    flag_key: str
    name: str
    description: str | None
    source_system: str | None
    target_system: str | None
    stage: str
    rollout_percentage: int
    error_count: int
    success_count: int
    rollback_threshold: float | None
    created_by: str
    created_at: str
    updated_at: str


class MetricsUpdate(BaseModel):
    success_count: int = 0
    error_count: int = 0


class PaginatedMigrations(BaseModel):
    items: list[MigrationOut]
    total: int


def _mig_to_out(m) -> MigrationOut:
    return MigrationOut(
        id=m.id, flag_key=m.flag_key, name=m.name, description=m.description,
        source_system=m.source_system, target_system=m.target_system,
        stage=m.stage, rollout_percentage=m.rollout_percentage,
        error_count=m.error_count, success_count=m.success_count,
        rollback_threshold=m.rollback_threshold,
        created_by=m.created_by, created_at=m.created_at.isoformat(),
        updated_at=m.updated_at.isoformat(),
    )


@router.post("/migrations", response_model=MigrationOut, status_code=201, dependencies=[require_role("editor")])
async def create_migration(body: MigrationCreate, user: dict = Depends(get_current_user), session: AsyncSession = Depends(get_session)):
    mig = await migration_service.create_migration(
        session, flag_key=body.flag_key, name=body.name,
        description=body.description, source_system=body.source_system,
        target_system=body.target_system, created_by=user.get("email", "system"),
    )
    if body.rollback_threshold is not None:
        mig.rollback_threshold = body.rollback_threshold
        await session.flush()
        await session.refresh(mig)
    return _mig_to_out(mig)


@router.get("/migrations", response_model=PaginatedMigrations)
async def list_migrations(
    limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    items, total = await migration_service.list_migrations(session, limit=limit, offset=offset)
    return PaginatedMigrations(items=[_mig_to_out(m) for m in items], total=total)


@router.get("/migrations/{flag_key}", response_model=MigrationOut)
async def get_migration(flag_key: str, session: AsyncSession = Depends(get_session)):
    mig = await migration_service.get_migration_by_key(session, flag_key)
    if not mig:
        raise HTTPException(status_code=404, detail="Migration not found")
    return _mig_to_out(mig)


@router.post("/migrations/{flag_key}/advance", response_model=MigrationOut, dependencies=[require_role("editor")])
async def advance_stage(flag_key: str, session: AsyncSession = Depends(get_session)):
    mig = await migration_service.get_migration_by_key(session, flag_key)
    if not mig:
        raise HTTPException(status_code=404, detail="Migration not found")
    updated = await migration_service.advance_stage(session, mig)
    return _mig_to_out(updated)


@router.post("/migrations/{flag_key}/rollback", response_model=MigrationOut, dependencies=[require_role("editor")])
async def rollback_stage(flag_key: str, session: AsyncSession = Depends(get_session)):
    mig = await migration_service.get_migration_by_key(session, flag_key)
    if not mig:
        raise HTTPException(status_code=404, detail="Migration not found")
    updated = await migration_service.rollback_stage(session, mig)
    return _mig_to_out(updated)


@router.post("/migrations/{flag_key}/metrics", response_model=MigrationOut, dependencies=[require_role("editor")])
async def update_metrics(flag_key: str, body: MetricsUpdate, session: AsyncSession = Depends(get_session)):
    mig = await migration_service.get_migration_by_key(session, flag_key)
    if not mig:
        raise HTTPException(status_code=404, detail="Migration not found")
    updated = await migration_service.update_metrics(session, mig, success_count=body.success_count, error_count=body.error_count)
    return _mig_to_out(updated)
