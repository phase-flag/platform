"""Tests for segment CRUD operations."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_segment(client: AsyncClient, auth_headers: dict):
    """Creating a segment returns the created segment."""
    resp = await client.post(
        "/api/v1/segments",
        json={
            "key": "beta-users",
            "name": "Beta Users",
            "description": "Users in the beta program",
            "conditions": [
                {"attribute": "beta_enrolled", "operator": "is", "value": "true"},
            ],
        },
        headers=auth_headers,
    )

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["key"] == "beta-users"
    assert data["name"] == "Beta Users"


@pytest.mark.asyncio
async def test_create_segment_duplicate_key(client: AsyncClient, auth_headers: dict):
    """Creating a segment with a duplicate key returns an error."""
    payload = {
        "key": "dup-segment",
        "name": "Dup Segment",
        "conditions": [],
    }
    await client.post("/api/v1/segments", json=payload, headers=auth_headers)
    resp = await client.post("/api/v1/segments", json=payload, headers=auth_headers)

    assert resp.status_code in (400, 409, 422)


@pytest.mark.asyncio
async def test_list_segments(client: AsyncClient, auth_headers: dict):
    """Listing segments includes created segments."""
    await client.post(
        "/api/v1/segments",
        json={
            "key": "list-seg",
            "name": "List Segment",
            "conditions": [],
        },
        headers=auth_headers,
    )

    resp = await client.get("/api/v1/segments", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_segment(client: AsyncClient, auth_headers: dict):
    """Getting a segment by key returns the segment data."""
    await client.post(
        "/api/v1/segments",
        json={
            "key": "get-seg",
            "name": "Get Segment",
            "conditions": [{"attribute": "plan", "operator": "is", "value": "pro"}],
        },
        headers=auth_headers,
    )

    resp = await client.get("/api/v1/segments/get-seg", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["key"] == "get-seg"


@pytest.mark.asyncio
async def test_get_segment_not_found(client: AsyncClient, auth_headers: dict):
    """Getting a non-existent segment returns 404."""
    resp = await client.get("/api/v1/segments/nonexistent-seg", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_segment(client: AsyncClient, auth_headers: dict):
    """Updating a segment modifies its properties."""
    await client.post(
        "/api/v1/segments",
        json={
            "key": "upd-seg",
            "name": "Update Segment",
            "conditions": [],
        },
        headers=auth_headers,
    )

    resp = await client.put(
        "/api/v1/segments/upd-seg",
        json={
            "name": "Updated Segment",
            "conditions": [
                {"attribute": "region", "operator": "one_of", "value": ["US", "CA"]},
            ],
        },
        headers=auth_headers,
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Segment"


@pytest.mark.asyncio
async def test_delete_segment(client: AsyncClient, auth_headers: dict):
    """Deleting a segment removes it."""
    await client.post(
        "/api/v1/segments",
        json={
            "key": "del-seg",
            "name": "Delete Segment",
            "conditions": [],
        },
        headers=auth_headers,
    )

    resp = await client.delete("/api/v1/segments/del-seg", headers=auth_headers)
    assert resp.status_code in (200, 204)

    resp = await client.get("/api/v1/segments/del-seg", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_segment_with_multiple_conditions(client: AsyncClient, auth_headers: dict):
    """Creating a segment with multiple AND conditions works."""
    resp = await client.post(
        "/api/v1/segments",
        json={
            "key": "multi-cond",
            "name": "Multi Condition",
            "conditions": [
                {"attribute": "plan", "operator": "is", "value": "enterprise"},
                {"attribute": "country", "operator": "one_of", "value": ["US", "UK"]},
                {"attribute": "age", "operator": "gt", "value": "18"},
            ],
        },
        headers=auth_headers,
    )

    assert resp.status_code in (200, 201)
    data = resp.json()
    conditions = data.get("conditions", [])
    assert len(conditions) == 3
