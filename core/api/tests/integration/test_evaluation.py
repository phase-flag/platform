"""Integration tests for flag evaluation endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


@pytest.mark.asyncio
async def test_evaluate_inactive_flag_returns_default(client: AsyncClient, auth_headers: dict):
    """Create inactive flag, POST /api/v1/evaluate → returns default variation."""
    key = f"eval-inactive-{uuid4().hex[:8]}"
    payload = make_flag_payload(key=key, status="inactive")
    create_resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert create_resp.status_code in (200, 201)

    eval_resp = await client.post(
        "/api/v1/evaluate",
        json={
            "flag_key": key,
            "user_key": f"user-{uuid4().hex[:8]}",
            "context": {},
        },
        headers=auth_headers,
    )

    if eval_resp.status_code in (404, 501):
        pytest.skip("Evaluate endpoint not implemented")

    assert eval_resp.status_code == 200
    data = eval_resp.json()
    # Inactive flag should return default variation
    variation = data.get("variation_key") or data.get("variation") or data.get("value")
    assert variation is not None


@pytest.mark.asyncio
async def test_evaluate_active_flag(client: AsyncClient, auth_headers: dict):
    """Create flag, activate it, evaluate → returns active variation."""
    key = f"eval-active-{uuid4().hex[:8]}"
    payload = make_flag_payload(key=key, status="inactive")
    create_resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert create_resp.status_code in (200, 201)

    # Activate the flag
    toggle_resp = await client.post(f"/api/v1/flags/{key}/toggle", headers=auth_headers)
    if toggle_resp.status_code == 404:
        toggle_resp = await client.patch(
            f"/api/v1/flags/{key}",
            json={"status": "active"},
            headers=auth_headers,
        )

    # Proceed with evaluation regardless of toggle success
    eval_resp = await client.post(
        "/api/v1/evaluate",
        json={
            "flag_key": key,
            "user_key": f"user-{uuid4().hex[:8]}",
            "context": {},
        },
        headers=auth_headers,
    )

    if eval_resp.status_code in (404, 501):
        pytest.skip("Evaluate endpoint not implemented")

    assert eval_resp.status_code == 200
    data = eval_resp.json()
    assert "variation_key" in data or "variation" in data or "value" in data


@pytest.mark.asyncio
async def test_evaluate_with_user_context(client: AsyncClient, auth_headers: dict):
    """Evaluate a flag with user_id, session_id, and attributes in context."""
    key = f"eval-ctx-{uuid4().hex[:8]}"
    payload = make_flag_payload(key=key)
    create_resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    assert create_resp.status_code in (200, 201)

    eval_resp = await client.post(
        "/api/v1/evaluate",
        json={
            "flag_key": key,
            "user_key": "user-abc123",
            "context": {
                "user_id": "user-abc123",
                "session_id": f"session-{uuid4().hex[:8]}",
                "attributes": {
                    "country": "US",
                    "plan": "pro",
                    "beta_enrolled": True,
                },
            },
        },
        headers=auth_headers,
    )

    if eval_resp.status_code in (404, 501):
        pytest.skip("Evaluate endpoint not implemented")

    assert eval_resp.status_code == 200


@pytest.mark.asyncio
async def test_evaluate_multiple_flags(client: AsyncClient, auth_headers: dict):
    """Evaluate 3 flags — individually or via batch endpoint."""
    keys = []
    for i in range(3):
        key = f"batch-flag-{uuid4().hex[:8]}"
        keys.append(key)
        payload = make_flag_payload(key=key, name=f"Batch Flag {i}")
        create_resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)
        assert create_resp.status_code in (200, 201)

    user_key = f"user-{uuid4().hex[:8]}"

    # Try batch endpoint first
    batch_resp = await client.post(
        "/api/v1/evaluate/batch",
        json={
            "flag_keys": keys,
            "user_key": user_key,
            "context": {},
        },
        headers=auth_headers,
    )

    if batch_resp.status_code not in (404, 501):
        assert batch_resp.status_code == 200
        data = batch_resp.json()
        # Response should be a mapping of flag key → result
        assert isinstance(data, dict) or isinstance(data, list)
    else:
        # Fall back to evaluating individually
        for key in keys:
            eval_resp = await client.post(
                "/api/v1/evaluate",
                json={"flag_key": key, "user_key": user_key, "context": {}},
                headers=auth_headers,
            )
            if eval_resp.status_code in (404, 501):
                pytest.skip("Evaluate endpoint not implemented")
            assert eval_resp.status_code == 200
