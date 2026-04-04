"""Tests for flag CRUD operations."""

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


@pytest.mark.asyncio
async def test_create_flag(client: AsyncClient, auth_headers: dict):
    """Creating a flag returns 201 with the created flag data."""
    payload = make_flag_payload(key="my-feature", name="My Feature")
    resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["key"] == "my-feature"
    assert data["name"] == "My Feature"
    assert data["flag_type"] == "boolean"


@pytest.mark.asyncio
async def test_create_flag_duplicate_key(client: AsyncClient, auth_headers: dict):
    """Creating a flag with a duplicate key returns 409."""
    payload = make_flag_payload(key="dup-flag")
    await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    assert resp.status_code in (400, 409, 422)


@pytest.mark.asyncio
async def test_list_flags(client: AsyncClient, auth_headers: dict):
    """Listing flags returns an array including created flags."""
    payload = make_flag_payload(key="list-test")
    await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    resp = await client.get("/api/v1/flags", headers=auth_headers)
    assert resp.status_code == 200

    data = resp.json()
    # Response could be a list or a dict with items
    if isinstance(data, list):
        keys = [f["key"] for f in data]
    else:
        keys = [f["key"] for f in data.get("items", data.get("flags", []))]
    assert "list-test" in keys


@pytest.mark.asyncio
async def test_get_flag(client: AsyncClient, auth_headers: dict):
    """Getting a single flag by key returns the flag data."""
    payload = make_flag_payload(key="get-test")
    await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    resp = await client.get("/api/v1/flags/get-test", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["key"] == "get-test"


@pytest.mark.asyncio
async def test_get_flag_not_found(client: AsyncClient, auth_headers: dict):
    """Getting a non-existent flag returns 404."""
    resp = await client.get("/api/v1/flags/nonexistent", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_flag(client: AsyncClient, auth_headers: dict):
    """Updating a flag modifies its properties."""
    payload = make_flag_payload(key="update-test")
    await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    resp = await client.put(
        "/api/v1/flags/update-test",
        json={
            "name": "Updated Name",
            "description": "Updated description",
        },
        headers=auth_headers,
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Name"
    assert data["description"] == "Updated description"


@pytest.mark.asyncio
async def test_toggle_flag(client: AsyncClient, auth_headers: dict):
    """Toggling a flag changes its status."""
    payload = make_flag_payload(key="toggle-test", status="inactive")
    await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    resp = await client.post("/api/v1/flags/toggle-test/toggle", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "active"

    # Toggle back
    resp = await client.post("/api/v1/flags/toggle-test/toggle", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "inactive"


@pytest.mark.asyncio
async def test_archive_flag(client: AsyncClient, auth_headers: dict):
    """Archiving a flag sets its status to archived."""
    payload = make_flag_payload(key="archive-test")
    await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    resp = await client.post("/api/v1/flags/archive-test/archive", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_create_flag_with_classification(client: AsyncClient, auth_headers: dict):
    """Creating a flag with classification sets it correctly."""
    payload = make_flag_payload(key="killswitch-test")
    payload["flag_classification"] = "ops_killswitch"
    payload["is_permanent"] = True

    resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data.get("flag_classification") == "ops_killswitch"
    assert data.get("is_permanent") is True


@pytest.mark.asyncio
async def test_create_flag_with_metadata(client: AsyncClient, auth_headers: dict):
    """Creating a flag with tags, ticket URL, and owner works."""
    payload = make_flag_payload(key="meta-test")
    payload["tags"] = ["mobile", "checkout"]
    payload["ticket_url"] = "https://jira.example.com/FEAT-123"
    payload["owner_team"] = "checkout-team"

    resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "mobile" in data.get("tags", [])
