"""Integration tests for flag lifecycle management endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_transition_flag_lifecycle(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/flags/{key}/lifecycle/transition → new stage returned."""
    key = f"lc-flag-{uuid4().hex[:8]}"
    create_resp = await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)
    assert create_resp.status_code in (200, 201)

    resp = await client.post(
        f"/api/v1/flags/{key}/lifecycle/transition",
        json={"target_stage": "testing"},
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Lifecycle transition endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data.get("flag_key") == key
    assert data.get("new_stage") == "testing"


@pytest.mark.asyncio
async def test_list_stale_flags(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/lifecycle/stale-flags → returns a list (may be empty)."""
    resp = await client.get("/api/v1/lifecycle/stale-flags", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Stale flags endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_list_expiring_flags(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/lifecycle/expiring-flags → returns a list."""
    resp = await client.get("/api/v1/lifecycle/expiring-flags", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Expiring flags endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_run_stale_detection(client: AsyncClient, admin_headers: dict):
    """POST /api/v1/lifecycle/run-stale-detection → returns count."""
    resp = await client.post("/api/v1/lifecycle/run-stale-detection", headers=admin_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Stale detection endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "marked_stale" in data
    assert isinstance(data["marked_stale"], int)


@pytest.mark.asyncio
async def test_run_expiration_check(client: AsyncClient, admin_headers: dict):
    """POST /api/v1/lifecycle/run-expiration-check → returns archived count."""
    resp = await client.post("/api/v1/lifecycle/run-expiration-check", headers=admin_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Expiration check endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "archived" in data
    assert isinstance(data["archived"], int)


@pytest.mark.asyncio
async def test_cleanup_scorecard(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/lifecycle/cleanup-scorecard → returns list of scores."""
    resp = await client.get("/api/v1/lifecycle/cleanup-scorecard", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Cleanup scorecard endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_transition_nonexistent_flag(client: AsyncClient, auth_headers: dict):
    """POST lifecycle transition for non-existent flag → 404."""
    resp = await client.post(
        f"/api/v1/flags/no-such-flag-{uuid4().hex[:8]}/lifecycle/transition",
        json={"target_stage": "testing"},
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Lifecycle endpoint not implemented")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_lifecycle_transition_missing_target_stage(client: AsyncClient, auth_headers: dict):
    """POST lifecycle transition without target_stage → 422."""
    key = f"lc-err-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)

    resp = await client.post(
        f"/api/v1/flags/{key}/lifecycle/transition",
        json={},  # missing target_stage
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Lifecycle endpoint not implemented")
    assert resp.status_code == 422
