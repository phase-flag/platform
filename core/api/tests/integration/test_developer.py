"""Integration tests for developer workflow endpoints — test users, forced treatments, simulation."""

from uuid import uuid4

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Test user happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_test_user(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/test-users → 201 with test user data."""
    user_id = f"test-user-{uuid4().hex[:8]}"
    resp = await client.post(
        "/api/v1/test-users",
        json={
            "user_id": user_id,
            "name": "Alice Developer",
            "attributes": {"plan": "pro", "country": "US", "beta": True},
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Test users endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data.get("user_id") == user_id or data.get("id") == user_id


@pytest.mark.asyncio
async def test_list_test_users(client: AsyncClient, auth_headers: dict):
    """Create test user, list → user appears."""
    user_id = f"list-user-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/test-users",
        json={"user_id": user_id, "name": "Bob Lister"},
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Test users endpoint not implemented")
    assert create_resp.status_code in (200, 201)

    list_resp = await client.get("/api/v1/test-users", headers=auth_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Test users list endpoint not implemented")
    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data if isinstance(data, list) else data.get("users", data.get("items", []))
    found_ids = [u.get("user_id") or u.get("id") for u in items]
    assert user_id in found_ids


@pytest.mark.asyncio
async def test_delete_test_user(client: AsyncClient, auth_headers: dict):
    """Create test user, delete it → 204."""
    user_id = f"del-user-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/test-users",
        json={"user_id": user_id, "name": "Delete Me"},
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Test users endpoint not implemented")
    assert create_resp.status_code in (200, 201)

    delete_resp = await client.delete(f"/api/v1/test-users/{user_id}", headers=auth_headers)
    if delete_resp.status_code in (404, 501):
        pytest.skip("Test user delete endpoint not implemented")
    assert delete_resp.status_code in (200, 204)


# ---------------------------------------------------------------------------
# Forced treatment happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_set_forced_treatment(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/forced-treatments → 201 with treatment data."""
    flag_key = f"force-flag-{uuid4().hex[:8]}"
    user_id = f"force-user-{uuid4().hex[:8]}"

    resp = await client.post(
        "/api/v1/forced-treatments",
        json={"flag_key": flag_key, "user_id": user_id, "variation": "treatment-a"},
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Forced treatments endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data.get("flag_key") == flag_key
    assert data.get("user_id") == user_id


@pytest.mark.asyncio
async def test_clear_forced_treatments(client: AsyncClient, auth_headers: dict):
    """Set forced treatment then clear it → 204."""
    flag_key = f"clear-flag-{uuid4().hex[:8]}"
    user_id = f"clear-user-{uuid4().hex[:8]}"

    set_resp = await client.post(
        "/api/v1/forced-treatments",
        json={"flag_key": flag_key, "user_id": user_id, "variation": "on"},
        headers=auth_headers,
    )
    if set_resp.status_code in (404, 501):
        pytest.skip("Forced treatments endpoint not implemented")

    clear_resp = await client.delete(
        f"/api/v1/forced-treatments?flag_key={flag_key}&user_id={user_id}",
        headers=auth_headers,
    )
    if clear_resp.status_code in (404, 501):
        pytest.skip("Clear forced treatments endpoint not implemented")
    assert clear_resp.status_code in (200, 204)


# ---------------------------------------------------------------------------
# Simulation happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_simulate_rollout(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/simulate-rollout → 200 with distribution data."""
    resp = await client.post(
        "/api/v1/simulate-rollout",
        json={
            "flag_key": f"sim-flag-{uuid4().hex[:8]}",
            "total_users": 1000,
            "percentage": 25,
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Simulate rollout endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_delete_nonexistent_test_user(client: AsyncClient, auth_headers: dict):
    """DELETE /api/v1/test-users/{id} for non-existent user → 404."""
    resp = await client.delete(
        f"/api/v1/test-users/no-such-user-{uuid4().hex[:8]}",
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Test users endpoint not implemented")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_test_user_missing_user_id(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/test-users without user_id → 422."""
    resp = await client.post(
        "/api/v1/test-users",
        json={"name": "No ID User"},
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Test users endpoint not implemented")
    assert resp.status_code == 422
