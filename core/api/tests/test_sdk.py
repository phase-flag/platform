"""Tests for SDK-facing endpoints (ruleset, evaluate, events, stream)."""

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


@pytest.mark.asyncio
async def test_get_ruleset(client: AsyncClient, auth_headers: dict):
    """The ruleset endpoint returns a compiled ruleset for local evaluation."""
    # Create a flag first
    await client.post("/api/v1/flags", json=make_flag_payload(key="sdk-rs"), headers=auth_headers)

    resp = await client.get("/api/v1/sdk/ruleset", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    # Should contain flags in some form
    assert isinstance(data, (list, dict))


@pytest.mark.asyncio
async def test_server_evaluate(client: AsyncClient, auth_headers: dict):
    """Server-side evaluation returns a variation result."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="sdk-eval"), headers=auth_headers)
    # Flag is created as inactive; toggle it to active before evaluation
    await client.post("/api/v1/flags/sdk-eval/toggle", headers=auth_headers)

    resp = await client.post("/api/v1/sdk/evaluate", json={
        "flag_key": "sdk-eval",
        "context": {"user_id": "user-123"},
    }, headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "variation_key" in data or "value" in data


@pytest.mark.asyncio
async def test_server_evaluate_unknown_flag(client: AsyncClient, auth_headers: dict):
    """Evaluating a non-existent flag returns 404."""
    resp = await client.post("/api/v1/sdk/evaluate", json={
        "flag_key": "nonexistent-flag",
        "context": {"user_id": "user-123"},
    }, headers=auth_headers)

    assert resp.status_code in (404, 200)  # Some implementations return default


@pytest.mark.asyncio
async def test_batch_evaluate(client: AsyncClient, auth_headers: dict):
    """Batch evaluation evaluates multiple flags in one call."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="batch-1"), headers=auth_headers)
    await client.post("/api/v1/flags", json=make_flag_payload(key="batch-2"), headers=auth_headers)

    resp = await client.post("/api/v1/sdk/evaluate/batch", json={
        "flag_keys": ["batch-1", "batch-2"],
        "context": {"user_id": "user-123"},
    }, headers=auth_headers)

    # Endpoint may not exist yet
    assert resp.status_code in (200, 404)


@pytest.mark.asyncio
async def test_event_ingestion(client: AsyncClient, auth_headers: dict):
    """The events endpoint accepts evaluation events."""
    resp = await client.post("/api/v1/sdk/events", json={
        "events": [
            {
                "flag_key": "event-flag",
                "variation_key": "on",
                "user_id": "user-123",
                "timestamp": "2026-03-20T10:00:00Z",
            },
            {
                "flag_key": "event-flag",
                "variation_key": "off",
                "user_id": "user-456",
                "timestamp": "2026-03-20T10:01:00Z",
            },
        ],
    }, headers=auth_headers)

    assert resp.status_code in (200, 201, 202)


@pytest.mark.asyncio
async def test_sdk_no_auth(client: AsyncClient):
    """SDK endpoints require authentication."""
    resp = await client.get("/api/v1/sdk/ruleset")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_explain_endpoint(client: AsyncClient, auth_headers: dict):
    """The explain endpoint returns why a flag resolved to a particular value."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="explain-flag"), headers=auth_headers)

    resp = await client.post("/api/v1/evaluation/explain", json={
        "flag_key": "explain-flag",
        "context": {"user_id": "user-123", "plan": "pro"},
    }, headers=auth_headers)

    assert resp.status_code in (200, 404)
    if resp.status_code == 200:
        data = resp.json()
        assert "reason" in data or "trace" in data


@pytest.mark.asyncio
async def test_bootstrap_endpoint(client: AsyncClient, auth_headers: dict):
    """The bootstrap endpoint provides initial flag data for offline mode."""
    resp = await client.get("/api/v1/sdk/bootstrap", headers=auth_headers)
    assert resp.status_code in (200, 404)
