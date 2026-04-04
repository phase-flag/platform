"""Async SQLAlchemy queries for users."""

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.users import UserDB


async def get_user_by_id(session: AsyncSession, user_id: str) -> UserDB | None:
    result = await session.execute(select(UserDB).where(UserDB.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(session: AsyncSession, email: str) -> UserDB | None:
    result = await session.execute(select(UserDB).where(UserDB.email == email))
    return result.scalar_one_or_none()


async def list_users(
    session: AsyncSession, *, limit: int = 50, offset: int = 0
) -> tuple[Sequence[UserDB], int]:
    base = select(UserDB)
    total = (
        await session.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0
    items = (
        (
            await session.execute(
                base.order_by(UserDB.created_at.desc()).limit(limit).offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return items, total


async def update_user(session: AsyncSession, user: UserDB) -> UserDB:
    await session.flush()
    await session.refresh(user)
    return user


async def delete_user(session: AsyncSession, user: UserDB) -> None:
    await session.delete(user)
    await session.flush()
