"""Root-level integration tests for flag CRUD operations."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.integration.conftest import make_flag_payload


@pytest.mark.asyncio
async def test_create_flag(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/flags → 200 or 201 with created flag data."""
    key = f"root-flag-{uuid4().hex[:8]}"
    payload = make_flag_payload(key=key, name="Root Integration Flag")

    resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["key"] == key
    assert data["name"] == "Root Integration Flag"


@pytest.mark.asyncio
async def test_list_flags(client: AsyncClient, auth_headers: dict):
    """Create 2 flags, list → both appear."""
    keys = []
    for i in range(2):
        key = f"root-list-{uuid4().hex[:8]}"
        keys.append(key)
        payload = make_flag_payload(key=key, name=f"Root List Flag {i}")
        resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
        assert resp.status_code in (200, 201)

    list_resp = await client.get("/api/v1/flags", headers=auth_headers)
    assert list_resp.status_code == 200

    data = list_resp.json()
    if isinstance(data, list):
        found_keys = [f["key"] for f in data]
    else:
        items = data.get("items", data.get("flags", data.get("data", [])))
        found_keys = [f["key"] for f in items]

    for k in keys:
        assert k in found_keys


@pytest.mark.asyncio
async def test_get_flag(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/flags/{key} → 200 with the flag data."""
    key = f"root-get-{uuid4().hex[:8]}"
    payload = make_flag_payload(key=key, name="Root Get Flag")
    create_resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert create_resp.status_code in (200, 201)

    get_resp = await client.get(f"/api/v1/flags/{key}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["key"] == key


@pytest.mark.asyncio
async def test_delete_flag(client: AsyncClient, auth_headers: dict):
    """DELETE /api/v1/flags/{key} → 200 or 204, then GET returns 404."""
    key = f"root-del-{uuid4().hex[:8]}"
    payload = make_flag_payload(key=key, name="Root Delete Flag")
    create_resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert create_resp.status_code in (200, 201)

    delete_resp = await client.delete(f"/api/v1/flags/{key}", headers=auth_headers)
    assert delete_resp.status_code in (200, 204)

    get_resp = await client.get(f"/api/v1/flags/{key}", headers=auth_headers)
    assert get_resp.status_code == 404
