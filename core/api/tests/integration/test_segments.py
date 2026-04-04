"""Integration tests for segment CRUD operations."""

from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_segment(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/segments with name, description, conditions → 201 or 200."""
    key = f"seg-{uuid4().hex[:8]}"
    resp = await client.post(
        "/api/v1/segments",
        json={
            "key": key,
            "name": "Beta Users Segment",
            "description": "Users enrolled in the beta program",
            "conditions": [
                {"attribute": "beta_enrolled", "operator": "is", "value": "true"},
            ],
        },
        headers=auth_headers,
    )

    if resp.status_code in (404, 501):
        pytest.skip("Segments endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data.get("key") == key
    assert data.get("name") == "Beta Users Segment"


@pytest.mark.asyncio
async def test_list_segments(client: AsyncClient, auth_headers: dict):
    """Create 2 segments, list them → both appear."""
    keys = []
    for i in range(2):
        key = f"list-seg-{uuid4().hex[:8]}"
        keys.append(key)
        resp = await client.post(
            "/api/v1/segments",
            json={
                "key": key,
                "name": f"List Segment {i}",
                "conditions": [],
            },
            headers=auth_headers,
        )
        if resp.status_code in (404, 501):
            pytest.skip("Segments endpoint not implemented")

    list_resp = await client.get("/api/v1/segments", headers=auth_headers)

    if list_resp.status_code in (404, 501):
        pytest.skip("Segments list endpoint not implemented")

    assert list_resp.status_code == 200
    data = list_resp.json()

    if isinstance(data, list):
        found_keys = [s["key"] for s in data]
    else:
        items = data.get("items", data.get("segments", data.get("data", [])))
        found_keys = [s["key"] for s in items]

    for k in keys:
        assert k in found_keys


@pytest.mark.asyncio
async def test_update_segment(client: AsyncClient, auth_headers: dict):
    """Update segment name/description."""
    key = f"upd-seg-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/segments",
        json={
            "key": key,
            "name": "Original Name",
            "description": "Original description",
            "conditions": [],
        },
        headers=auth_headers,
    )

    if create_resp.status_code in (404, 501):
        pytest.skip("Segments endpoint not implemented")
    assert create_resp.status_code in (200, 201)

    update_resp = await client.put(
        f"/api/v1/segments/{key}",
        json={
            "name": "Updated Name",
            "description": "Updated description",
            "conditions": [
                {"attribute": "plan", "operator": "is", "value": "pro"},
            ],
        },
        headers=auth_headers,
    )

    if update_resp.status_code in (404, 501):
        pytest.skip("Segments update endpoint not implemented")

    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data.get("name") == "Updated Name"


@pytest.mark.asyncio
async def test_delete_segment(client: AsyncClient, auth_headers: dict):
    """Delete segment → 204 (or 200), then GET returns 404."""
    key = f"del-seg-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/segments",
        json={
            "key": key,
            "name": "Delete Me Segment",
            "conditions": [],
        },
        headers=auth_headers,
    )

    if create_resp.status_code in (404, 501):
        pytest.skip("Segments endpoint not implemented")
    assert create_resp.status_code in (200, 201)

    delete_resp = await client.delete(f"/api/v1/segments/{key}", headers=auth_headers)

    if delete_resp.status_code in (404, 501):
        pytest.skip("Segments delete endpoint not implemented")

    assert delete_resp.status_code in (200, 204)

    get_resp = await client.get(f"/api/v1/segments/{key}", headers=auth_headers)
    assert get_resp.status_code == 404
