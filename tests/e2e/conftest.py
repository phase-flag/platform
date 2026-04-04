"""
E2E test configuration — tests run against a live Phase Flag API server.

The API base URL is read from the PHASEFLAG_API_URL environment variable,
defaulting to http://localhost:8000/api/v1.

All tests in this directory are automatically skipped when the API server
is not reachable.
"""

import os

import httpx
import pytest
import pytest_asyncio

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_BASE_URL: str = os.environ.get(
    "PHASEFLAG_API_URL", "http://localhost:8000/api/v1"
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def api_client():
    """
    Yield an httpx.AsyncClient targeting the live API.

    The fixture performs a quick health-check before yielding; if the server
    is not reachable the test is skipped rather than failed.
    """
    base = API_BASE_URL.rstrip("/")
    # Derive the health-check URL (one level above the /api/v1 prefix)
    health_url = base.replace("/api/v1", "") + "/health"

    async with httpx.AsyncClient(base_url=base, timeout=10.0) as client:
        try:
            resp = await client.get(health_url)
            if resp.status_code >= 500:
                pytest.skip(f"API server returned {resp.status_code} — skipping E2E tests")
        except (httpx.ConnectError, httpx.TimeoutException):
            pytest.skip("API server not reachable — skipping E2E tests")

        yield client
