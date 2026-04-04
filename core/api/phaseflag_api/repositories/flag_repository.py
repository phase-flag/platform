"""Async SQLAlchemy queries for feature flags."""

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.flags import FeatureFlagDB, VariationDB


async def list_flags(
    session: AsyncSession,
    *,
    environment: str | None = None,
    status: str | None = None,
    lifecycle_stage: str | None = None,
    namespace: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[Sequence[FeatureFlagDB], int]:
    """Return flags with pagination, optionally filtered."""
    base = select(FeatureFlagDB)
    if environment:
        base = base.where(FeatureFlagDB.environment == environment)
    if status:
        base = base.where(FeatureFlagDB.status == status)
    if lifecycle_stage:
        base = base.where(FeatureFlagDB.lifecycle_stage == lifecycle_stage)
    if namespace:
        base = base.where(FeatureFlagDB.namespace == namespace)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    items_stmt = base.order_by(FeatureFlagDB.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(items_stmt)
    return result.scalars().all(), total


async def get_flag_by_key(session: AsyncSession, key: str) -> FeatureFlagDB | None:
    stmt = select(FeatureFlagDB).where(FeatureFlagDB.key == key)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_flag_by_id(session: AsyncSession, flag_id: str) -> FeatureFlagDB | None:
    stmt = select(FeatureFlagDB).where(FeatureFlagDB.id == flag_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def create_flag(session: AsyncSession, flag: FeatureFlagDB) -> FeatureFlagDB:
    session.add(flag)
    await session.flush()
    await session.refresh(flag)
    return flag


async def update_flag(session: AsyncSession, flag: FeatureFlagDB) -> FeatureFlagDB:
    await session.flush()
    await session.refresh(flag)
    return flag


async def delete_flag(session: AsyncSession, flag: FeatureFlagDB) -> None:
    await session.delete(flag)
    await session.flush()


async def list_active_flags(session: AsyncSession) -> Sequence[FeatureFlagDB]:
    stmt = (
        select(FeatureFlagDB)
        .where(FeatureFlagDB.status == "active")
        .order_by(FeatureFlagDB.key)
    )
    result = await session.execute(stmt)
    return result.scalars().all()
