"""Async SQLAlchemy queries for environments."""

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.environments import EnvironmentDB


async def list_environments(
    session: AsyncSession, project_id: str, *, limit: int = 50, offset: int = 0
) -> tuple[Sequence[EnvironmentDB], int]:
    base = select(EnvironmentDB).where(EnvironmentDB.project_id == project_id)
    total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    items = (
        (await session.execute(base.order_by(EnvironmentDB.created_at.desc()).limit(limit).offset(offset)))
        .scalars()
        .all()
    )
    return items, total


async def get_env_by_id(session: AsyncSession, env_id: str) -> EnvironmentDB | None:
    result = await session.execute(select(EnvironmentDB).where(EnvironmentDB.id == env_id))
    return result.scalar_one_or_none()


async def get_env_by_slug(session: AsyncSession, project_id: str, slug: str) -> EnvironmentDB | None:
    result = await session.execute(
        select(EnvironmentDB).where(EnvironmentDB.project_id == project_id, EnvironmentDB.slug == slug)
    )
    return result.scalar_one_or_none()


async def get_env_by_api_key(session: AsyncSession, api_key: str) -> EnvironmentDB | None:
    result = await session.execute(select(EnvironmentDB).where(EnvironmentDB.api_key == api_key))
    return result.scalar_one_or_none()


async def create_environment(session: AsyncSession, env: EnvironmentDB) -> EnvironmentDB:
    session.add(env)
    await session.flush()
    await session.refresh(env)
    return env


async def update_environment(session: AsyncSession, env: EnvironmentDB) -> EnvironmentDB:
    await session.flush()
    await session.refresh(env)
    return env


async def delete_environment(session: AsyncSession, env: EnvironmentDB) -> None:
    await session.delete(env)
    await session.flush()


async def clone_environment(
    session: AsyncSession, source: EnvironmentDB, new_slug: str, new_name: str
) -> EnvironmentDB:
    """Clone an environment with a new API key."""
    cloned = EnvironmentDB(
        project_id=source.project_id,
        slug=new_slug,
        name=new_name,
        description=f"Cloned from {source.name}",
        color=source.color,
        is_production=False,
        settings=source.settings,
    )
    return await create_environment(session, cloned)
