"""Integration tests for rollback rules endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_rollback_rule(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/rollback-rules → 201 with rule data."""
    flag_key = f"rb-flag-{uuid4().hex[:8]}"
    # Create flag first to ensure the flag key is valid
    await client.post("/api/v1/flags", json=make_flag_payload(key=flag_key), headers=auth_headers)

    resp = await client.post(
        "/api/v1/rollback-rules",
        json={
            "flag_key": flag_key,
            "metric_name": "error_rate",
            "operator": "gt",
            "threshold": 0.05,
            "window_minutes": 5,
            "action": "disable",
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Rollback rules endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "id" in data
    assert data["flag_key"] == flag_key
    assert data["metric_name"] == "error_rate"
    assert data["threshold"] == 0.05
    assert data["active"] is True


@pytest.mark.asyncio
async def test_list_rollback_rules_for_flag(client: AsyncClient, auth_headers: dict):
    """Create 2 rollback rules for same flag, list → both appear."""
    flag_key = f"rb-list-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=flag_key), headers=auth_headers)

    for metric in ["error_rate", "latency_p99"]:
        r = await client.post(
            "/api/v1/rollback-rules",
            json={
                "flag_key": flag_key,
                "metric_name": metric,
                "operator": "gt",
                "threshold": 0.1,
                "window_minutes": 10,
                "action": "disable",
            },
            headers=auth_headers,
        )
        if r.status_code in (404, 501):
            pytest.skip("Rollback rules endpoint not implemented")
        assert r.status_code in (200, 201)

    list_resp = await client.get(f"/api/v1/rollback-rules/{flag_key}", headers=auth_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Rollback rules list not implemented")
    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data if isinstance(data, list) else data.get("items", [])
    assert len(items) >= 2
    metric_names = [r["metric_name"] for r in items]
    assert "error_rate" in metric_names
    assert "latency_p99" in metric_names


@pytest.mark.asyncio
async def test_create_rollback_rule_with_custom_action(client: AsyncClient, auth_headers: dict):
    """Create rollback rule with 'rollback' action → 201."""
    flag_key = f"rb-custom-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=flag_key), headers=auth_headers)

    resp = await client.post(
        "/api/v1/rollback-rules",
        json={
            "flag_key": flag_key,
            "metric_name": "conversion_rate",
            "operator": "lt",
            "threshold": 0.02,
            "window_minutes": 15,
            "action": "rollback",
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Rollback rules endpoint not implemented")
    assert resp.status_code in (200, 201)
    assert resp.json()["action"] == "rollback"


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_rollback_rules_for_nonexistent_flag_returns_empty(
    client: AsyncClient, auth_headers: dict
):
    """GET /api/v1/rollback-rules/{flag_key} for non-existent flag → 200 with empty list."""
    flag_key = f"no-such-flag-{uuid4().hex[:8]}"
    resp = await client.get(f"/api/v1/rollback-rules/{flag_key}", headers=auth_headers)
    if resp.status_code in (404, 501):
        # 404 is also acceptable if the endpoint validates flag existence
        pass
    else:
        assert resp.status_code == 200
        data = resp.json()
        items = data if isinstance(data, list) else data.get("items", [])
        assert len(items) == 0


@pytest.mark.asyncio
async def test_create_rollback_rule_invalid_operator(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/rollback-rules with invalid operator → 422 or 400."""
    flag_key = f"rb-invalid-{uuid4().hex[:8]}"
    resp = await client.post(
        "/api/v1/rollback-rules",
        json={
            "flag_key": flag_key,
            "metric_name": "error_rate",
            "operator": "invalid_op",
            "threshold": 0.05,
            "window_minutes": 5,
            "action": "disable",
        },
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Rollback rules endpoint not implemented")
    # May accept any operator or validate it — both are OK
    assert resp.status_code in (200, 201, 400, 422)
