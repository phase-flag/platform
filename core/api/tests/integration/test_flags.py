"""Integration tests for flag CRUD operations."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


@pytest.mark.asyncio
async def test_create_boolean_flag(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/flags with boolean type returns 201 with flag data."""
    key = f"bool-flag-{uuid4().hex[:8]}"
    payload = make_flag_payload(key=key, name="Boolean Feature Flag", flag_type="boolean")

    resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["key"] == key
    assert data["flag_type"] == "boolean"
    assert "variations" in data or "id" in data


@pytest.mark.asyncio
async def test_create_multivariate_flag(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/flags with string type and 3 variations returns 201."""
    key = f"mv-flag-{uuid4().hex[:8]}"
    payload = {
        "key": key,
        "name": "Multivariate Flag",
        "flag_type": "string",
        "environment": "development",
        "variations": [
            {"key": "control", "name": "Control", "value": "control"},
            {"key": "treatment-a", "name": "Treatment A", "value": "treatment_a"},
            {"key": "treatment-b", "name": "Treatment B", "value": "treatment_b"},
        ],
        "default_variation_key": "control",
    }

    resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["key"] == key
    assert data["flag_type"] == "string"
    variations = data.get("variations", [])
    assert len(variations) >= 3


@pytest.mark.asyncio
async def test_list_flags_pagination(client: AsyncClient, auth_headers: dict):
    """Create 5 flags, list with limit=2 offset=0, verify pagination."""
    created_keys = []
    for i in range(5):
        key = f"page-flag-{uuid4().hex[:8]}"
        created_keys.append(key)
        payload = make_flag_payload(key=key, name=f"Pagination Flag {i}")
        await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    resp = await client.get("/api/v1/flags?limit=2&offset=0", headers=auth_headers)
    assert resp.status_code == 200

    data = resp.json()
    # Handle both list and paginated dict response shapes
    if isinstance(data, list):
        items = data
    else:
        items = data.get("items", data.get("flags", data.get("data", [])))

    # With limit=2, at most 2 items should be returned
    assert len(items) <= 2

    # List all to verify all flags exist
    resp_all = await client.get("/api/v1/flags?limit=100&offset=0", headers=auth_headers)
    assert resp_all.status_code == 200
    all_data = resp_all.json()
    if isinstance(all_data, list):
        all_keys = [f["key"] for f in all_data]
    else:
        all_items = all_data.get("items", all_data.get("flags", all_data.get("data", [])))
        all_keys = [f["key"] for f in all_items]

    for k in created_keys:
        assert k in all_keys


@pytest.mark.asyncio
async def test_toggle_flag_active(client: AsyncClient, auth_headers: dict):
    """Create inactive flag, toggle it → flag becomes active."""
    key = f"toggle-flag-{uuid4().hex[:8]}"
    payload = make_flag_payload(key=key, status="inactive")
    create_resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert create_resp.status_code in (200, 201)

    # Try POST .../toggle endpoint first
    toggle_resp = await client.post(f"/api/v1/flags/{key}/toggle", headers=auth_headers)

    if toggle_resp.status_code == 404:
        # Try PATCH with status field
        toggle_resp = await client.patch(
            f"/api/v1/flags/{key}",
            json={"status": "active"},
            headers=auth_headers,
        )

    if toggle_resp.status_code == 404:
        # Try PUT with status field
        toggle_resp = await client.put(
            f"/api/v1/flags/{key}",
            json={"name": payload["name"], "status": "active"},
            headers=auth_headers,
        )

    assert toggle_resp.status_code == 200
    data = toggle_resp.json()
    assert data.get("status") in ("active", "enabled", True)


@pytest.mark.asyncio
async def test_update_flag_targeting_rules(client: AsyncClient, auth_headers: dict):
    """Add a targeting rule to an existing flag via PUT."""
    key = f"target-flag-{uuid4().hex[:8]}"
    payload = make_flag_payload(key=key, name="Targeting Flag")
    create_resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert create_resp.status_code in (200, 201)

    update_resp = await client.put(
        f"/api/v1/flags/{key}",
        json={
            "name": "Targeting Flag",
            "description": "Flag with targeting rules",
            "targeting_rules": [
                {
                    "attribute": "country",
                    "operator": "one_of",
                    "value": ["US", "CA"],
                    "variation_key": "on",
                }
            ],
        },
        headers=auth_headers,
    )

    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["key"] == key


@pytest.mark.asyncio
async def test_delete_flag(client: AsyncClient, auth_headers: dict):
    """Archive then delete a flag → 204 (or 200), then GET returns 404."""
    key = f"del-flag-{uuid4().hex[:8]}"
    payload = make_flag_payload(key=key, name="Delete Me Flag")
    create_resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert create_resp.status_code in (200, 201)

    # Flags must be archived before they can be deleted
    archive_resp = await client.post(f"/api/v1/flags/{key}/archive", headers=auth_headers)
    assert archive_resp.status_code == 200

    delete_resp = await client.delete(f"/api/v1/flags/{key}", headers=auth_headers)
    assert delete_resp.status_code in (200, 204)

    get_resp = await client.get(f"/api/v1/flags/{key}", headers=auth_headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_flag_rollout_percentage(client: AsyncClient, auth_headers: dict):
    """Create a flag with percentage_rollout in variations."""
    key = f"rollout-flag-{uuid4().hex[:8]}"
    payload = {
        "key": key,
        "name": "Rollout Flag",
        "flag_type": "boolean",
        "environment": "development",
        "variations": [
            {"key": "on", "name": "Enabled", "value": True, "rollout_percentage": 20},
            {"key": "off", "name": "Disabled", "value": False, "rollout_percentage": 80},
        ],
        "default_variation_key": "off",
    }

    resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["key"] == key


@pytest.mark.asyncio
async def test_flag_sql_injection_key(client: AsyncClient, auth_headers: dict):
    """Flag key with SQL injection characters → 422 or 400 (validation rejects)."""
    payload = make_flag_payload(key="'; DROP TABLE flags;--", name="SQL Injection Flag")

    resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    # Should be rejected at validation layer
    assert resp.status_code in (400, 422)
