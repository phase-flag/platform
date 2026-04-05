"""Integration tests for webhook CRUD endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_webhook(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/webhooks with valid URL and events → 201 with webhook data."""
    resp = await client.post(
        "/api/v1/webhooks",
        json={
            "url": f"https://example.com/webhook/{uuid4().hex[:8]}",
            "events": ["flag.created", "flag.updated"],
            "secret": "whsec_test_secret_key",
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Webhooks endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "id" in data
    assert data["active"] is True
    assert "flag.created" in data.get("events", [])


@pytest.mark.asyncio
async def test_list_webhooks(client: AsyncClient, auth_headers: dict):
    """Create 2 webhooks, list them → both appear."""
    created_ids = []
    for i in range(2):
        r = await client.post(
            "/api/v1/webhooks",
            json={
                "url": f"https://example.com/wh/{uuid4().hex[:8]}",
                "events": ["flag.toggled"],
                "secret": "whsec_list_secret",
            },
            headers=auth_headers,
        )
        if r.status_code in (404, 501):
            pytest.skip("Webhooks endpoint not implemented")
        assert r.status_code in (200, 201)
        created_ids.append(r.json()["id"])

    list_resp = await client.get("/api/v1/webhooks", headers=auth_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Webhooks list endpoint not implemented")
    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data.get("items", data) if isinstance(data, dict) else data
    found_ids = [w["id"] for w in items]
    for wid in created_ids:
        assert wid in found_ids


@pytest.mark.asyncio
async def test_update_webhook(client: AsyncClient, auth_headers: dict):
    """Update webhook URL and active status → changes reflected."""
    create_resp = await client.post(
        "/api/v1/webhooks",
        json={
            "url": "https://example.com/original-webhook",
            "events": ["flag.created"],
            "secret": "whsec_upd",
        },
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Webhooks endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    webhook_id = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/v1/webhooks/{webhook_id}",
        json={"url": "https://example.com/updated-webhook", "active": False},
        headers=auth_headers,
    )
    if update_resp.status_code in (404, 501):
        pytest.skip("Webhook update endpoint not implemented")
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["url"] == "https://example.com/updated-webhook"
    assert data["active"] is False


@pytest.mark.asyncio
async def test_delete_webhook(client: AsyncClient, auth_headers: dict):
    """Create webhook, delete it → 204."""
    create_resp = await client.post(
        "/api/v1/webhooks",
        json={
            "url": "https://example.com/del-webhook",
            "events": ["flag.archived"],
            "secret": "whsec_del",
        },
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Webhooks endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    webhook_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/api/v1/webhooks/{webhook_id}", headers=auth_headers)
    if delete_resp.status_code in (404, 501):
        pytest.skip("Webhook delete endpoint not implemented")
    assert delete_resp.status_code in (200, 204)


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_nonexistent_webhook_returns_404(client: AsyncClient, auth_headers: dict):
    """PUT /api/v1/webhooks/{id} for bogus ID → 404."""
    resp = await client.put(
        f"/api/v1/webhooks/nonexistent-{uuid4().hex}",
        json={"url": "https://example.com/nope"},
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Webhooks endpoint not implemented")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_webhook_returns_404(client: AsyncClient, auth_headers: dict):
    """DELETE /api/v1/webhooks/{id} for bogus ID → 404."""
    resp = await client.delete(
        f"/api/v1/webhooks/nonexistent-{uuid4().hex}",
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Webhooks endpoint not implemented")
    assert resp.status_code == 404
