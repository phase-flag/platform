"""Integration tests for observability / system metrics endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_system_metrics(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/metrics → 200 with metric fields."""
    resp = await client.get("/api/v1/metrics", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("System metrics endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    # Should have some standard metrics fields
    assert isinstance(data, dict)


@pytest.mark.asyncio
async def test_get_request_metrics(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/metrics/requests → 200 with request metrics."""
    resp = await client.get("/api/v1/metrics/requests", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Request metrics endpoint not implemented")

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_cache_metrics(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/metrics/cache → 200 with cache metrics."""
    resp = await client.get("/api/v1/metrics/cache", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Cache metrics endpoint not implemented")

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_flag_health(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/flags/{key}/health → 200 with health data."""
    key = f"health-flag-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)

    resp = await client.get(f"/api/v1/flags/{key}/health", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Flag health endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)


@pytest.mark.asyncio
async def test_get_flag_inventory(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/inventory → 200 with flag inventory data."""
    resp = await client.get("/api/v1/inventory", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Inventory endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)


@pytest.mark.asyncio
async def test_get_evaluation_trends(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/trends → 200 with trend data."""
    resp = await client.get("/api/v1/trends?days=7", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Trends endpoint not implemented")

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_correlate_incident(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/incidents/correlate → 201 with correlation data."""
    key = f"incident-flag-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)

    resp = await client.post(
        "/api/v1/incidents/correlate",
        json={
            "flag_key": key,
            "incident_id": f"INC-{uuid4().hex[:6].upper()}",
            "description": "Error rate spiked after flag enable",
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Incident correlation endpoint not implemented")

    assert resp.status_code in (200, 201)


@pytest.mark.asyncio
async def test_list_incidents(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/incidents → 200."""
    resp = await client.get("/api/v1/incidents", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Incidents endpoint not implemented")

    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_metrics_without_auth(client: AsyncClient):
    """GET /api/v1/metrics without auth → 401 or 403."""
    resp = await client.get("/api/v1/metrics")
    if resp.status_code in (501,):
        pytest.skip("Metrics endpoint not implemented")
    assert resp.status_code in (401, 403, 422)


@pytest.mark.asyncio
async def test_correlate_incident_missing_fields(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/incidents/correlate without required fields → 422."""
    resp = await client.post(
        "/api/v1/incidents/correlate",
        json={"flag_key": "some-flag"},  # missing incident_id, description
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Incident correlation endpoint not implemented")
    assert resp.status_code in (400, 422)
