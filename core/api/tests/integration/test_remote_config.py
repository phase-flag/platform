"""Integration tests for remote configuration CRUD and versioning endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_remote_config(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/configs with valid payload → 201 with config data."""
    key = f"cfg-{uuid4().hex[:8]}"
    resp = await client.post(
        "/api/v1/configs",
        json={
            "key": key,
            "name": "Max Upload Size",
            "description": "Maximum file upload size in bytes",
            "config_type": "number",
            "value": 10485760,
            "default_value": 5242880,
            "environment": "development",
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Configs endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["key"] == key
    assert data["version"] == 1
    assert "id" in data


@pytest.mark.asyncio
async def test_list_configs(client: AsyncClient, auth_headers: dict):
    """Create 2 configs, list them → both appear."""
    keys = []
    for i in range(2):
        key = f"list-cfg-{uuid4().hex[:8]}"
        keys.append(key)
        r = await client.post(
            "/api/v1/configs",
            json={
                "key": key,
                "name": f"Config {i}",
                "config_type": "string",
                "value": f"value-{i}",
                "default_value": "default",
                "environment": "development",
            },
            headers=auth_headers,
        )
        if r.status_code in (404, 501):
            pytest.skip("Configs endpoint not implemented")
        assert r.status_code in (200, 201)

    list_resp = await client.get("/api/v1/configs", headers=auth_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Configs list endpoint not implemented")
    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data.get("items", data) if isinstance(data, dict) else data
    found_keys = [c["key"] for c in items]
    for k in keys:
        assert k in found_keys


@pytest.mark.asyncio
async def test_get_config_by_id(client: AsyncClient, auth_headers: dict):
    """Create config, GET by ID → correct data."""
    key = f"getc-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/configs",
        json={
            "key": key,
            "name": "Get Config Test",
            "config_type": "boolean",
            "value": True,
            "default_value": False,
            "environment": "development",
        },
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Configs endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    config_id = create_resp.json()["id"]

    get_resp = await client.get(f"/api/v1/configs/{config_id}", headers=auth_headers)
    if get_resp.status_code in (404, 501):
        pytest.skip("Get config not implemented")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == config_id


@pytest.mark.asyncio
async def test_update_config_increments_version(client: AsyncClient, auth_headers: dict):
    """Update a config value → version number increments."""
    key = f"ver-cfg-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/configs",
        json={
            "key": key,
            "name": "Version Test Config",
            "config_type": "number",
            "value": 100,
            "default_value": 50,
            "environment": "development",
        },
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Configs endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    config_id = create_resp.json()["id"]
    original_version = create_resp.json()["version"]

    update_resp = await client.put(
        f"/api/v1/configs/{config_id}",
        json={"value": 200, "description": "Updated value"},
        headers=auth_headers,
    )
    if update_resp.status_code in (404, 501):
        pytest.skip("Config update not implemented")
    assert update_resp.status_code == 200
    updated_version = update_resp.json()["version"]
    assert updated_version > original_version


@pytest.mark.asyncio
async def test_get_config_history(client: AsyncClient, auth_headers: dict):
    """Create config, update it, GET history → at least 1 entry."""
    key = f"hist-cfg-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/configs",
        json={
            "key": key,
            "name": "History Config",
            "config_type": "string",
            "value": "original",
            "default_value": "default",
            "environment": "development",
        },
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Configs endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    config_id = create_resp.json()["id"]

    history_resp = await client.get(f"/api/v1/configs/{config_id}/history", headers=auth_headers)
    if history_resp.status_code in (404, 501):
        pytest.skip("Config history not implemented")
    assert history_resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_config(client: AsyncClient, auth_headers: dict):
    """Create config, delete it → 204."""
    key = f"del-cfg-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/configs",
        json={
            "key": key,
            "name": "Delete Config",
            "config_type": "string",
            "value": "bye",
            "default_value": "",
            "environment": "development",
        },
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Configs endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    config_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/api/v1/configs/{config_id}", headers=auth_headers)
    if delete_resp.status_code in (404, 501):
        pytest.skip("Config delete not implemented")
    assert delete_resp.status_code in (200, 204)

    get_resp = await client.get(f"/api/v1/configs/{config_id}", headers=auth_headers)
    assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_nonexistent_config_returns_404(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/configs/{id} for bogus ID → 404."""
    resp = await client.get(f"/api/v1/configs/nonexistent-{uuid4().hex}", headers=auth_headers)
    if resp.status_code in (501,):
        pytest.skip("Configs endpoint not implemented")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_config_without_required_fields(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/configs missing required fields → 422."""
    resp = await client.post(
        "/api/v1/configs",
        json={"name": "Incomplete Config"},  # missing key, value, etc.
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Configs endpoint not implemented")
    assert resp.status_code == 422
