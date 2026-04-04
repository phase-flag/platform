"""Migration flag service — staged migration workflows."""

import logging
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.migrations import MigrationFlagDB

logger = logging.getLogger(__name__)

VALID_STAGES = ("dual_read", "dual_write", "shadow", "cutover", "cleanup")
STAGE_ORDER = {stage: i for i, stage in enumerate(VALID_STAGES)}


async def create_migration(
    session: AsyncSession,
    *,
    flag_key: str,
    name: str,
    description: str | None = None,
    source_system: str | None = None,
    target_system: str | None = None,
    created_by: str = "system",
) -> MigrationFlagDB:
    existing = await get_migration_by_key(session, flag_key)
    if existing:
        raise HTTPException(status_code=409, detail=f"Migration '{flag_key}' already exists")

    mig = MigrationFlagDB(
        flag_key=flag_key, name=name, description=description,
        source_system=source_system, target_system=target_system,
        created_by=created_by,
    )
    session.add(mig)
    await session.flush()
    await session.refresh(mig)
    return mig


async def advance_stage(session: AsyncSession, mig: MigrationFlagDB) -> MigrationFlagDB:
    current_idx = STAGE_ORDER.get(mig.stage, 0)
    if current_idx >= len(VALID_STAGES) - 1:
        raise HTTPException(status_code=400, detail="Migration is already at final stage")
    mig.stage = VALID_STAGES[current_idx + 1]
    mig.updated_at = datetime.now(UTC)
    await session.flush()
    await session.refresh(mig)
    return mig


async def rollback_stage(session: AsyncSession, mig: MigrationFlagDB) -> MigrationFlagDB:
    current_idx = STAGE_ORDER.get(mig.stage, 0)
    if current_idx <= 0:
        raise HTTPException(status_code=400, detail="Migration is already at initial stage")
    mig.stage = VALID_STAGES[current_idx - 1]
    mig.updated_at = datetime.now(UTC)
    await session.flush()
    await session.refresh(mig)
    return mig


async def update_metrics(
    session: AsyncSession,
    mig: MigrationFlagDB,
    success_count: int = 0,
    error_count: int = 0,
) -> MigrationFlagDB:
    mig.success_count += success_count
    mig.error_count += error_count
    mig.updated_at = datetime.now(UTC)
    # Auto-rollback check
    total = mig.success_count + mig.error_count
    if total > 0 and mig.rollback_threshold:
        error_rate = mig.error_count / total
        if error_rate > mig.rollback_threshold:
            logger.warning("Migration %s error rate %.2f exceeds threshold %.2f", mig.flag_key, error_rate, mig.rollback_threshold)
    await session.flush()
    await session.refresh(mig)
    return mig


async def get_migration_by_key(session: AsyncSession, flag_key: str) -> MigrationFlagDB | None:
    result = await session.execute(select(MigrationFlagDB).where(MigrationFlagDB.flag_key == flag_key))
    return result.scalar_one_or_none()


async def list_migrations(session: AsyncSession, *, limit: int = 50, offset: int = 0) -> tuple[list[MigrationFlagDB], int]:
    base = select(MigrationFlagDB)
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    items = (await session.execute(base.order_by(MigrationFlagDB.created_at.desc()).limit(limit).offset(offset))).scalars().all()
    return list(items), total
