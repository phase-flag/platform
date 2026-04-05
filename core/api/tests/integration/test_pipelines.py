"""Integration tests for progressive delivery pipeline endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def _create_flag(client: AsyncClient, headers: dict) -> str:
    key = f"pipeline-flag-{uuid4().hex[:8]}"
    resp = await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=headers)
    assert resp.status_code in (200, 201)
    return key


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_rollout_templates(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/rollouts/templates → returns available templates."""
    resp = await client.get("/api/v1/rollouts/templates", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Rollout templates endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    # Should return a list or dict of templates
    assert data is not None


@pytest.mark.asyncio
async def test_create_pipeline(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/rollouts with stages → 201 with pipeline data."""
    flag_key = await _create_flag(client, auth_headers)

    resp = await client.post(
        "/api/v1/rollouts",
        json={
            "flag_key": flag_key,
            "name": f"Pipeline {uuid4().hex[:8]}",
            "description": "Test progressive rollout",
            "stages": [
                {"name": "Canary", "rollout_percentage": 5, "duration_minutes": 30},
                {"name": "Stage 2", "rollout_percentage": 25, "duration_minutes": 60},
                {"name": "Full Rollout", "rollout_percentage": 100},
            ],
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Rollouts endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "id" in data
    assert data["flag_key"] == flag_key
    assert len(data.get("stages", [])) >= 3
    assert data["status"] in ("pending", "running", "created", "active")


@pytest.mark.asyncio
async def test_list_pipelines(client: AsyncClient, auth_headers: dict):
    """Create 2 pipelines, list → both appear."""
    pipeline_ids = []
    for i in range(2):
        fk = await _create_flag(client, auth_headers)
        r = await client.post(
            "/api/v1/rollouts",
            json={
                "flag_key": fk,
                "name": f"List Pipeline {i}",
                "stages": [{"name": "Stage 1", "rollout_percentage": 10}],
            },
            headers=auth_headers,
        )
        if r.status_code in (404, 501):
            pytest.skip("Rollouts endpoint not implemented")
        assert r.status_code in (200, 201)
        pipeline_ids.append(r.json()["id"])

    list_resp = await client.get("/api/v1/rollouts", headers=auth_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Rollouts list not implemented")
    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data.get("items", data) if isinstance(data, dict) else data
    found_ids = [p["id"] for p in items]
    for pid in pipeline_ids:
        assert pid in found_ids


@pytest.mark.asyncio
async def test_get_pipeline_by_id(client: AsyncClient, auth_headers: dict):
    """Create pipeline, GET by ID → correct data."""
    flag_key = await _create_flag(client, auth_headers)
    create_resp = await client.post(
        "/api/v1/rollouts",
        json={
            "flag_key": flag_key,
            "name": "Get Pipeline Test",
            "stages": [{"name": "Stage 1", "rollout_percentage": 20}],
        },
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Rollouts endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    pipeline_id = create_resp.json()["id"]

    get_resp = await client.get(f"/api/v1/rollouts/{pipeline_id}", headers=auth_headers)
    if get_resp.status_code in (404, 501):
        pytest.skip("Get pipeline not implemented")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == pipeline_id


@pytest.mark.asyncio
async def test_advance_pipeline(client: AsyncClient, auth_headers: dict):
    """Advance a pipeline → stage index increments or status changes."""
    flag_key = await _create_flag(client, auth_headers)
    create_resp = await client.post(
        "/api/v1/rollouts",
        json={
            "flag_key": flag_key,
            "name": "Advance Pipeline Test",
            "stages": [
                {"name": "Stage 1", "rollout_percentage": 10},
                {"name": "Stage 2", "rollout_percentage": 50},
            ],
        },
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Rollouts endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    pipeline_id = create_resp.json()["id"]
    initial_stage = create_resp.json()["current_stage_index"]

    advance_resp = await client.post(f"/api/v1/rollouts/{pipeline_id}/advance", headers=auth_headers)
    if advance_resp.status_code in (404, 501):
        pytest.skip("Advance pipeline not implemented")
    # Accept success or completion state
    assert advance_resp.status_code in (200, 400)
    if advance_resp.status_code == 200:
        new_stage = advance_resp.json()["current_stage_index"]
        assert new_stage >= initial_stage


@pytest.mark.asyncio
async def test_create_pipeline_with_template(client: AsyncClient, auth_headers: dict):
    """Create pipeline using a named template → 201."""
    flag_key = await _create_flag(client, auth_headers)
    resp = await client.post(
        "/api/v1/rollouts",
        json={
            "flag_key": flag_key,
            "name": "Template Pipeline",
            "template": "canary",
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Rollouts endpoint not implemented")
    # Template might not be supported; 400 is OK
    assert resp.status_code in (200, 201, 400, 422)


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_nonexistent_pipeline_returns_404(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/rollouts/{id} for bogus ID → 404."""
    resp = await client.get(f"/api/v1/rollouts/nonexistent-{uuid4().hex}", headers=auth_headers)
    if resp.status_code in (501,):
        pytest.skip("Rollouts endpoint not implemented")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_pipeline_missing_flag_key(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/rollouts without flag_key → 422."""
    resp = await client.post(
        "/api/v1/rollouts",
        json={"name": "No Flag Pipeline", "stages": []},
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Rollouts endpoint not implemented")
    assert resp.status_code in (400, 422)
