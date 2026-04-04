"""Shared test fixtures for the Phase Flag API test suite."""

import asyncio
import os
from typing import AsyncGenerator
from uuid import uuid4

# Set test secrets BEFORE importing the app
os.environ.setdefault("PHASEFLAG_API_SECRET_KEY", "test-api-key")
os.environ.setdefault("PHASEFLAG_JWT_SECRET_KEY", "test-jwt-secret-key-32chars!!")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402

from phaseflag_api.config import settings  # noqa: E402

# Force settings to use our test keys
settings.API_SECRET_KEY = "test-api-key"  # type: ignore[misc]
settings.JWT_SECRET_KEY = "test-jwt-secret-key-32chars!!"  # type: ignore[misc]

from phaseflag_api.database import Base, get_session  # noqa: E402
from phaseflag_api.main import app  # noqa: E402

# Use an in-memory SQLite database for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
test_session_factory = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


@pytest.fixture(scope="session")
def event_loop():
    """Create a single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test and drop them after."""
    import phaseflag_api.models  # noqa: F401

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a test database session."""
    async with test_session_factory() as session:
        yield session


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
    """Yield an httpx AsyncClient wired to the FastAPI test app."""
    app.dependency_overrides[get_session] = _override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """Register a test user, log in, and return auth headers with JWT."""
    email = f"test-{uuid4().hex[:8]}@example.com"
    password = "TestPassword123!"

    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "name": "Test User",
        },
    )

    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )

    if resp.status_code == 200:
        data = resp.json()
        token = data.get("access_token") or data.get("token", "")
        return {"Authorization": f"Bearer {token}", "X-API-Key": "test-api-key"}

    # Fallback: use API key header
    return {"X-API-Key": "test-api-key"}


@pytest_asyncio.fixture
async def admin_headers(
    client: AsyncClient, db_session: AsyncSession
) -> dict[str, str]:
    """Create an admin user and return auth headers."""
    from phaseflag_api.models.users import UserDB

    email = f"admin-{uuid4().hex[:8]}@example.com"
    password = "AdminPassword123!"

    await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "name": "Admin User",
        },
    )

    # Upgrade to admin role
    from sqlalchemy import update

    async with test_session_factory() as session:
        await session.execute(
            update(UserDB).where(UserDB.email == email).values(role="admin")
        )
        await session.commit()

    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": password,
        },
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
        "variations": [
            {"key": "on", "name": "Enabled", "value": True},
            {"key": "off", "name": "Disabled", "value": False},
        ],
        "default_variation_key": "off",
    }
