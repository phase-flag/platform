"""
Root-level integration test configuration.

Adds core/api to sys.path so that phaseflag_api can be imported, sets required
environment variables, and provides client/auth_headers/make_flag_payload fixtures
backed by an in-memory SQLite database.

Usage:
    cd <project_root>
    pip install -e core/api
    pytest tests/integration/ -v
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import AsyncGenerator
from uuid import uuid4

# ---------------------------------------------------------------------------
# Ensure phaseflag_api is importable
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_API_ROOT = _PROJECT_ROOT / "core" / "api"

if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

# ---------------------------------------------------------------------------
# Required env vars — must be set BEFORE importing the app
# ---------------------------------------------------------------------------
os.environ.setdefault("PHASEFLAG_API_SECRET_KEY", "test-api-key")
os.environ.setdefault("PHASEFLAG_JWT_SECRET_KEY", "test-jwt-secret-key-32chars!!")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from phaseflag_api.config import settings

settings.API_SECRET_KEY = "test-api-key"  # type: ignore[misc]
settings.JWT_SECRET_KEY = "test-jwt-secret-key-32chars!!"  # type: ignore[misc]

from phaseflag_api.database import Base, get_session
from phaseflag_api.main import app

# ---------------------------------------------------------------------------
# In-memory SQLite engine
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_factory = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def event_loop():
    """Single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create tables before each test and drop them after."""
    import phaseflag_api.models  # noqa: F401

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def _override_get_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """AsyncClient wired to the FastAPI app."""
    app.dependency_overrides[get_session] = _override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """Register a test user, log in, and return auth headers."""
    email = f"test-{uuid4().hex[:8]}@example.com"
    password = "TestPassword123!"

    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": "Test User"},
    )

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )

    if resp.status_code == 200:
        data = resp.json()
        token = data.get("access_token") or data.get("token", "")
        return {"Authorization": f"Bearer {token}", "X-API-Key": "test-api-key"}

    return {"X-API-Key": "test-api-key"}


def make_flag_payload(
    key: str | None = None,
    name: str | None = None,
    flag_type: str = "boolean",
    environment: str = "development",
    status: str = "inactive",
) -> dict:
    """Create a flag creation payload with sensible defaults."""
    if key is None:
        key = f"test-flag-{uuid4().hex[:8]}"
    if name is None:
        name = f"Test Flag {key}"

    return {
        "key": key,
        "name": name,
        "flag_type": flag_type,
        "environment": environment,
        "status": status,
        "variations": [
            {"key": "on", "name": "Enabled", "value": True},
            {"key": "off", "name": "Disabled", "value": False},
        ],
        "default_variation_key": "off",
    }
