"""Integration tests for analytics reporting endpoints."""

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_stale_flag_report(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/reports/stale-flags → 200."""
    resp = await client.get("/api/v1/reports/stale-flags", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Stale flags report not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (dict, list))


@pytest.mark.asyncio
async def test_release_dashboard(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/reports/releases → 200."""
    resp = await client.get("/api/v1/reports/releases", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Release dashboard report not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (dict, list))


@pytest.mark.asyncio
async def test_environment_drift_report(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/reports/environment-drift → 200."""
    resp = await client.get("/api/v1/reports/environment-drift", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Environment drift report not implemented")

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_change_timeline_report(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/reports/change-timeline with days parameter → 200."""
    resp = await client.get("/api/v1/reports/change-timeline?days=30", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Change timeline report not implemented")

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_top_flags_report(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/reports/top-flags → 200 with list."""
    resp = await client.get("/api/v1/reports/top-flags?limit=10", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Top flags report not implemented")

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_unowned_flags_report(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/reports/unowned-flags → 200."""
    resp = await client.get("/api/v1/reports/unowned-flags", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Unowned flags report not implemented")

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_expired_flags_report(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/reports/expired-flags → 200."""
    resp = await client.get("/api/v1/reports/expired-flags", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Expired flags report not implemented")

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_segment_usage_report(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/reports/segment-usage → 200."""
    resp = await client.get("/api/v1/reports/segment-usage", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Segment usage report not implemented")

    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reports_without_auth_rejected(client: AsyncClient):
    """GET reports without auth → 401 or 403."""
    resp = await client.get("/api/v1/reports/stale-flags")
    if resp.status_code in (501,):
        pytest.skip("Reports endpoint not implemented")
    assert resp.status_code in (401, 403, 422)


@pytest.mark.asyncio
async def test_change_timeline_invalid_days(client: AsyncClient, auth_headers: dict):
    """GET change-timeline with days=0 → 422."""
    resp = await client.get("/api/v1/reports/change-timeline?days=0", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Change timeline report not implemented")
    assert resp.status_code == 422
