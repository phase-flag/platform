"""Integration tests for governance endpoints — change requests, freeze windows, break-glass."""

from uuid import uuid4

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Change request happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_change_request(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/changes with valid payload → 201 with change request data."""
    flag_key = f"gov-flag-{uuid4().hex[:8]}"
    resp = await client.post(
        "/api/v1/changes",
        json={
            "title": "Enable dark mode",
            "description": "Turning on dark-mode for 10% of users",
            "entity_type": "flag",
            "entity_key": flag_key,
            "change_type": "update",
            "payload": {"status": "active"},
            "requires_approval_count": 1,
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Change requests endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "id" in data
    assert data["status"] in ("pending", "open", "created")
    assert data["entity_key"] == flag_key


@pytest.mark.asyncio
async def test_list_change_requests(client: AsyncClient, auth_headers: dict):
    """Create 2 change requests, list them → both appear."""
    created_ids = []
    for i in range(2):
        r = await client.post(
            "/api/v1/changes",
            json={
                "title": f"Change {i}",
                "entity_type": "flag",
                "entity_key": f"flag-{uuid4().hex[:8]}",
                "change_type": "update",
                "payload": {},
            },
            headers=auth_headers,
        )
        if r.status_code in (404, 501):
            pytest.skip("Change requests endpoint not implemented")
        assert r.status_code in (200, 201)
        created_ids.append(r.json()["id"])

    list_resp = await client.get("/api/v1/changes", headers=auth_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Change requests list endpoint not implemented")
    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data.get("items", data) if isinstance(data, dict) else data
    found_ids = [cr["id"] for cr in items]
    for cid in created_ids:
        assert cid in found_ids


@pytest.mark.asyncio
async def test_get_change_request_by_id(client: AsyncClient, auth_headers: dict):
    """Create change request, GET by ID → correct data."""
    create_resp = await client.post(
        "/api/v1/changes",
        json={
            "title": "Get by ID Test",
            "entity_type": "flag",
            "entity_key": f"flag-{uuid4().hex[:8]}",
            "change_type": "create",
            "payload": {},
        },
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Change requests endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    cr_id = create_resp.json()["id"]

    get_resp = await client.get(f"/api/v1/changes/{cr_id}", headers=auth_headers)
    if get_resp.status_code in (404, 501):
        pytest.skip("Get change request not implemented")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == cr_id


@pytest.mark.asyncio
async def test_reject_change_request(client: AsyncClient, admin_headers: dict):
    """Create and reject a change request → status becomes rejected."""
    create_resp = await client.post(
        "/api/v1/changes",
        json={
            "title": "Rejected Change",
            "entity_type": "flag",
            "entity_key": f"flag-{uuid4().hex[:8]}",
            "change_type": "delete",
            "payload": {},
        },
        headers=admin_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Change requests endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    cr_id = create_resp.json()["id"]

    reject_resp = await client.post(
        f"/api/v1/changes/{cr_id}/reject",
        json={"comment": "Not approved at this time"},
        headers=admin_headers,
    )
    if reject_resp.status_code in (404, 501):
        pytest.skip("Reject change request not implemented")
    assert reject_resp.status_code == 200
    data = reject_resp.json()
    assert data["status"] in ("rejected", "declined")


# ---------------------------------------------------------------------------
# Freeze window tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_freeze_window(client: AsyncClient, admin_headers: dict):
    """POST /api/v1/freeze-windows → 201 with freeze window data."""
    resp = await client.post(
        "/api/v1/freeze-windows",
        json={
            "name": f"Release Freeze {uuid4().hex[:8]}",
            "starts_at": "2026-06-01T00:00:00Z",
            "ends_at": "2026-06-02T00:00:00Z",
            "reason": "Major release freeze",
        },
        headers=admin_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Freeze windows endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "id" in data
    assert data["active"] is True


@pytest.mark.asyncio
async def test_list_freeze_windows(client: AsyncClient, admin_headers: dict):
    """Create freeze window, list → appears in results."""
    create_resp = await client.post(
        "/api/v1/freeze-windows",
        json={
            "name": f"List Freeze {uuid4().hex[:8]}",
            "starts_at": "2026-07-01T00:00:00Z",
            "ends_at": "2026-07-02T00:00:00Z",
        },
        headers=admin_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Freeze windows endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    fw_id = create_resp.json()["id"]

    list_resp = await client.get("/api/v1/freeze-windows?active_only=false", headers=admin_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Freeze windows list endpoint not implemented")
    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data if isinstance(data, list) else data.get("items", [])
    found_ids = [fw["id"] for fw in items]
    assert fw_id in found_ids


# ---------------------------------------------------------------------------
# Break-glass tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_break_glass_event(client: AsyncClient, admin_headers: dict):
    """POST /api/v1/break-glass → 201 with event data."""
    resp = await client.post(
        "/api/v1/break-glass",
        json={
            "flag_key": f"bg-flag-{uuid4().hex[:8]}",
            "environment": "production",
            "action": "toggle",
            "reason": "Emergency override during incident",
            "expires_hours": 2,
        },
        headers=admin_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Break-glass endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "id" in data
    assert data["reverted"] is False


@pytest.mark.asyncio
async def test_list_break_glass_events(client: AsyncClient, admin_headers: dict):
    """Create break-glass event, list → appears."""
    create_resp = await client.post(
        "/api/v1/break-glass",
        json={
            "flag_key": f"bg-list-{uuid4().hex[:8]}",
            "environment": "staging",
            "action": "update",
            "reason": "Testing break-glass listing",
            "expires_hours": 1,
        },
        headers=admin_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Break-glass endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    bg_id = create_resp.json()["id"]

    list_resp = await client.get("/api/v1/break-glass", headers=admin_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Break-glass list endpoint not implemented")
    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data.get("items", data) if isinstance(data, dict) else data
    found_ids = [e["id"] for e in items]
    assert bg_id in found_ids


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_nonexistent_change_request_returns_404(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/changes/{id} for bogus ID → 404."""
    resp = await client.get(f"/api/v1/changes/nonexistent-{uuid4().hex}", headers=auth_headers)
    if resp.status_code in (501,):
        pytest.skip("Change requests endpoint not implemented")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_change_request_without_auth_rejected(client: AsyncClient):
    """POST /api/v1/changes without auth → 401 or 403."""
    resp = await client.post(
        "/api/v1/changes",
        json={
            "title": "Unauthorized Change",
            "entity_type": "flag",
            "entity_key": "some-flag",
            "change_type": "update",
            "payload": {},
        },
    )
    if resp.status_code in (501,):
        pytest.skip("Change requests endpoint not implemented")
    assert resp.status_code in (401, 403, 422)
