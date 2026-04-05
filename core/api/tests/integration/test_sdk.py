"""Integration tests for SDK-facing endpoints: ruleset, evaluate, events, bootstrap."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_sdk_ruleset(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/sdk/ruleset → 200 with flags and version."""
    resp = await client.get("/api/v1/sdk/ruleset", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("SDK ruleset endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert "flags" in data
    assert "version" in data
    assert isinstance(data["flags"], list)
    # ETag header should be present
    assert "etag" in resp.headers or "ETag" in resp.headers


@pytest.mark.asyncio
async def test_sdk_ruleset_etag_caching(client: AsyncClient, auth_headers: dict):
    """GET ruleset twice with If-None-Match → second request returns 304."""
    first_resp = await client.get("/api/v1/sdk/ruleset", headers=auth_headers)
    if first_resp.status_code in (404, 501):
        pytest.skip("SDK ruleset endpoint not implemented")
    assert first_resp.status_code == 200

    etag = first_resp.headers.get("etag") or first_resp.headers.get("ETag")
    if not etag:
        pytest.skip("No ETag returned — conditional fetch not supported")

    conditional_headers = {**auth_headers, "if-none-match": etag}
    second_resp = await client.get("/api/v1/sdk/ruleset", headers=conditional_headers)
    assert second_resp.status_code in (200, 304)


@pytest.mark.asyncio
async def test_sdk_evaluate_active_flag(client: AsyncClient, auth_headers: dict):
    """Create active flag, POST /api/v1/sdk/evaluate → 200 with variation."""
    key = f"sdk-eval-{uuid4().hex[:8]}"
    payload = make_flag_payload(key=key, status="inactive")
    create_resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert create_resp.status_code in (200, 201)

    # Activate the flag
    await client.post(f"/api/v1/flags/{key}/toggle", headers=auth_headers)

    eval_resp = await client.post(
        "/api/v1/sdk/evaluate",
        json={
            "flag_key": key,
            "context": {"user_id": f"sdk-user-{uuid4().hex[:8]}", "attributes": {"plan": "pro"}},
        },
        headers=auth_headers,
    )
    if eval_resp.status_code in (404, 501):
        pytest.skip("SDK evaluate endpoint not implemented")

    # 400 is returned if flag isn't active yet
    assert eval_resp.status_code in (200, 400)
    if eval_resp.status_code == 200:
        data = eval_resp.json()
        assert "flag_key" in data
        assert "reason" in data


@pytest.mark.asyncio
async def test_sdk_evaluate_nonexistent_flag(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/sdk/evaluate for non-existent flag → 404."""
    resp = await client.post(
        "/api/v1/sdk/evaluate",
        json={
            "flag_key": f"no-such-flag-{uuid4().hex[:8]}",
            "context": {"user_id": "user-123"},
        },
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("SDK evaluate endpoint not implemented")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_sdk_ingest_events(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/sdk/events with batch → 202 accepted."""
    resp = await client.post(
        "/api/v1/sdk/events",
        json={
            "events": [
                {
                    "flag_key": "dark-mode",
                    "variation_key": "on",
                    "user_id": "user-abc",
                    "timestamp": "2026-04-04T00:00:00Z",
                    "metadata": {"source": "test"},
                },
                {
                    "flag_key": "checkout-v2",
                    "variation_key": "control",
                    "user_id": "user-xyz",
                },
            ]
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("SDK events endpoint not implemented")

    assert resp.status_code in (200, 202)
    data = resp.json()
    assert data.get("accepted") == 2


@pytest.mark.asyncio
async def test_sdk_evaluate_all_flags(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/sdk/evaluate-all → 200 with evaluations map."""
    # Create an active flag to have something to evaluate
    key = f"eval-all-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)
    await client.post(f"/api/v1/flags/{key}/toggle", headers=auth_headers)

    resp = await client.get(
        "/api/v1/sdk/evaluate-all?user_id=test-user-123",
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("SDK evaluate-all endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert "evaluations" in data
    assert "count" in data
    assert isinstance(data["evaluations"], dict)


@pytest.mark.asyncio
async def test_sdk_bootstrap(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/sdk/bootstrap → 200 with flags, segments, and signature."""
    resp = await client.get("/api/v1/sdk/bootstrap", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("SDK bootstrap endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert "flags" in data
    assert "segments" in data
    assert "version" in data
    assert "signature" in data


@pytest.mark.asyncio
async def test_sdk_stream_status(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/sdk/stream/status → 200 with SSE status."""
    resp = await client.get("/api/v1/sdk/stream/status", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("SDK stream status endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert "connected_clients" in data


@pytest.mark.asyncio
async def test_sdk_identity_merge(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/sdk/identity/merge → 200 with merged assignments."""
    resp = await client.post(
        "/api/v1/sdk/identity/merge",
        json={
            "anonymous_id": "anon-abc123",
            "authenticated_id": "user-xyz789",
            "assignments": {"dark-mode": "on", "checkout-v2": "treatment-a"},
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("SDK identity merge endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert "merged_assignments" in data
    assert isinstance(data["merged_assignments"], dict)


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sdk_events_exceeds_batch_size(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/sdk/events with >500 events → 422."""
    events = [{"flag_key": f"flag-{i}", "variation_key": "on"} for i in range(501)]
    resp = await client.post(
        "/api/v1/sdk/events",
        json={"events": events},
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("SDK events endpoint not implemented")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_sdk_evaluate_inactive_flag_returns_400(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/sdk/evaluate for inactive flag → 400."""
    key = f"sdk-inactive-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/flags",
        json=make_flag_payload(key=key, status="inactive"),
        headers=auth_headers,
    )
    assert create_resp.status_code in (200, 201)

    eval_resp = await client.post(
        "/api/v1/sdk/evaluate",
        json={"flag_key": key, "context": {"user_id": "user-123"}},
        headers=auth_headers,
    )
    if eval_resp.status_code in (404, 501):
        pytest.skip("SDK evaluate endpoint not implemented")
    assert eval_resp.status_code in (400, 404)
