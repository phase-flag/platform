"""Async SQLAlchemy queries for audience segments."""

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.segments import SegmentDB


async def list_segments(
    session: AsyncSession,
    *,
    project_key: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[Sequence[SegmentDB], int]:
    base = select(SegmentDB)
    if project_key:
        base = base.where(SegmentDB.project_key == project_key)
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    items_stmt = base.order_by(SegmentDB.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(items_stmt)
    return result.scalars().all(), total


async def get_segment_by_key(session: AsyncSession, key: str) -> SegmentDB | None:
    stmt = select(SegmentDB).where(SegmentDB.key == key)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_segment_by_id(session: AsyncSession, segment_id: str) -> SegmentDB | None:
    stmt = select(SegmentDB).where(SegmentDB.id == segment_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def create_segment(session: AsyncSession, segment: SegmentDB) -> SegmentDB:
    session.add(segment)
    await session.flush()
    await session.refresh(segment)
    return segment


async def update_segment(session: AsyncSession, segment: SegmentDB) -> SegmentDB:
    await session.flush()
    await session.refresh(segment)
    return segment


async def delete_segment(session: AsyncSession, segment: SegmentDB) -> None:
    await session.delete(segment)
    await session.flush()
