"""SQLAlchemy async engine, session factory, and declarative base.

All ORM models live in phaseflag_api.models.* — this module contains
only the engine, session, and Base class.
"""

from typing import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from phaseflag_api.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

_db_url = settings.DATABASE_URL.replace("?sslmode=", "?ssl=").replace("&sslmode=", "&ssl=")

_engine_kwargs: dict = {"echo": settings.LOG_LEVEL.upper() == "DEBUG"}
if not _is_sqlite:
    _engine_kwargs.update(pool_size=5, max_overflow=10, pool_pre_ping=True)

engine = create_async_engine(_db_url, **_engine_kwargs)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

if _is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def create_tables() -> None:
    """Create all tables (used on startup for development)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
