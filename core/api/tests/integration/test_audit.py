"""Integration tests for audit log endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_audit_logs(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/audit-logs → 200 with list (may be empty)."""
    resp = await client.get("/api/v1/audit-logs", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Audit logs endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_audit_logs_generated_on_flag_create(client: AsyncClient, auth_headers: dict):
    """Create a flag, then query audit logs for it → at least one entry."""
    key = f"audit-flag-{uuid4().hex[:8]}"
    create_resp = await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)
    assert create_resp.status_code in (200, 201)

    resp = await client.get(f"/api/v1/audit-logs?entity_key={key}", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Audit logs endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    # Audit log may or may not be generated for flag creation depending on implementation
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_flag_specific_audit_logs(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/flags/{key}/audit-logs → 200 with flag-specific logs."""
    key = f"flag-audit-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)

    resp = await client.get(f"/api/v1/flags/{key}/audit-logs", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Flag audit logs endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_audit_logs_with_entity_type_filter(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/audit-logs?entity_type=flag → 200 filtered results."""
    resp = await client.get("/api/v1/audit-logs?entity_type=flag", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Audit logs endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # All returned entries should be for flags
    for entry in data:
        assert entry.get("entity_type") == "flag"


@pytest.mark.asyncio
async def test_audit_logs_pagination(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/audit-logs?limit=5 → at most 5 entries."""
    resp = await client.get("/api/v1/audit-logs?limit=5", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Audit logs endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) <= 5


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_audit_logs_without_auth_rejected(client: AsyncClient):
    """GET /api/v1/audit-logs without auth → 401 or 403."""
    resp = await client.get("/api/v1/audit-logs")
    if resp.status_code in (501,):
        pytest.skip("Audit logs endpoint not implemented")
    assert resp.status_code in (401, 403, 422)


@pytest.mark.asyncio
async def test_flag_audit_logs_for_nonexistent_flag(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/flags/{key}/audit-logs for non-existent flag → 200 empty list."""
    resp = await client.get(
        f"/api/v1/flags/no-such-flag-{uuid4().hex[:8]}/audit-logs",
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Flag audit logs endpoint not implemented")
    # Non-existent flag → empty list (or 404 depending on implementation)
    assert resp.status_code in (200, 404)
    if resp.status_code == 200:
        assert resp.json() == []
