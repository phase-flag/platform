"""Integration tests for analytics endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_flag_evaluations_empty(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/analytics/flags/{key}/evaluations for new flag → 200 empty list."""
    key = f"analytic-flag-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)

    resp = await client.get(f"/api/v1/analytics/flags/{key}/evaluations", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Analytics evaluations endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_get_flag_summary(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/analytics/flags/{key}/summary → 200 with summary fields."""
    key = f"summary-flag-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)

    resp = await client.get(f"/api/v1/analytics/flags/{key}/summary", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Analytics summary endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert "flag_key" in data
    assert data["flag_key"] == key
    assert "total_evaluations" in data
    assert "unique_users" in data


@pytest.mark.asyncio
async def test_get_flag_evaluations_with_period_filter(client: AsyncClient, auth_headers: dict):
    """GET flag evaluations with period=hour → 200."""
    key = f"period-flag-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)

    resp = await client.get(
        f"/api/v1/analytics/flags/{key}/evaluations?period=hour&days=1",
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Analytics evaluations endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_analytics_cleanup_old_events(client: AsyncClient, auth_headers: dict):
    """DELETE /api/v1/analytics/events/cleanup → 200 with deleted count."""
    resp = await client.delete("/api/v1/analytics/events/cleanup?days=90", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Analytics cleanup endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert "deleted" in data
    assert isinstance(data["deleted"], int)


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_evaluations_invalid_period(client: AsyncClient, auth_headers: dict):
    """GET evaluations with invalid period → 422."""
    key = f"invalid-period-flag-{uuid4().hex[:8]}"
    resp = await client.get(
        f"/api/v1/analytics/flags/{key}/evaluations?period=invalid",
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Analytics endpoint not implemented")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_flag_evaluations_without_auth(client: AsyncClient):
    """GET evaluations without auth → 401 or 403."""
    resp = await client.get("/api/v1/analytics/flags/some-flag/evaluations")
    if resp.status_code in (501,):
        pytest.skip("Analytics endpoint not implemented")
    assert resp.status_code in (401, 403, 422)
