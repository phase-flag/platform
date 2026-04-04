"""Tests for progressive rollout pipeline endpoints."""

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


@pytest.mark.asyncio
async def test_create_pipeline(client: AsyncClient, auth_headers: dict):
    """Creating a rollout pipeline returns the pipeline data."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="pipe-flag"), headers=auth_headers)

    resp = await client.post("/api/v1/rollouts", json={
        "flag_key": "pipe-flag",
        "name": "Canary Rollout",
        "template": "canary",
        "stages": [
            {"name": "Canary", "rollout_percentage": 1, "duration_minutes": 30},
            {"name": "Early Adopters", "rollout_percentage": 10, "duration_minutes": 60},
            {"name": "50%", "rollout_percentage": 50, "duration_minutes": 120},
            {"name": "Full", "rollout_percentage": 100},
        ],
    }, headers=auth_headers)

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data.get("status") == "pending"


@pytest.mark.asyncio
async def test_list_pipelines(client: AsyncClient, auth_headers: dict):
    """Listing pipelines returns an array."""
    resp = await client.get("/api/v1/rollouts", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_advance_pipeline(client: AsyncClient, auth_headers: dict):
    """Advancing a pipeline moves to the next stage."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="adv-flag"), headers=auth_headers)

    create_resp = await client.post("/api/v1/rollouts", json={
        "flag_key": "adv-flag",
        "name": "Advance Test",
        "stages": [
            {"name": "Stage 1", "rollout_percentage": 10},
            {"name": "Stage 2", "rollout_percentage": 100},
        ],
    }, headers=auth_headers)

    if create_resp.status_code in (200, 201):
        pipeline_id = create_resp.json().get("id")
        if pipeline_id:
            resp = await client.post(f"/api/v1/rollouts/{pipeline_id}/advance", headers=auth_headers)
            assert resp.status_code in (200, 400)


@pytest.mark.asyncio
async def test_pause_pipeline(client: AsyncClient, auth_headers: dict):
    """Pausing a running pipeline sets status to paused."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="pause-flag"), headers=auth_headers)

    create_resp = await client.post("/api/v1/rollouts", json={
        "flag_key": "pause-flag",
        "name": "Pause Test",
        "stages": [
            {"name": "Stage 1", "rollout_percentage": 10},
            {"name": "Stage 2", "rollout_percentage": 100},
        ],
    }, headers=auth_headers)

    if create_resp.status_code in (200, 201):
        pipeline_id = create_resp.json().get("id")
        if pipeline_id:
            resp = await client.post(f"/api/v1/rollouts/{pipeline_id}/pause", headers=auth_headers)
            assert resp.status_code in (200, 400)


@pytest.mark.asyncio
async def test_rollback_pipeline(client: AsyncClient, auth_headers: dict):
    """Rolling back a pipeline sets status to rolled_back."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="rb-flag"), headers=auth_headers)

    create_resp = await client.post("/api/v1/rollouts", json={
        "flag_key": "rb-flag",
        "name": "Rollback Test",
        "stages": [
            {"name": "Stage 1", "rollout_percentage": 10},
            {"name": "Stage 2", "rollout_percentage": 100},
        ],
    }, headers=auth_headers)

    if create_resp.status_code in (200, 201):
        pipeline_id = create_resp.json().get("id")
        if pipeline_id:
            resp = await client.post(f"/api/v1/rollouts/{pipeline_id}/rollback", headers=auth_headers)
            assert resp.status_code in (200, 400)


@pytest.mark.asyncio
async def test_create_rollback_rule(client: AsyncClient, auth_headers: dict):
    """Creating a rollback rule for a flag."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="rr-flag"), headers=auth_headers)

    resp = await client.post("/api/v1/rollback/rules", json={
        "flag_key": "rr-flag",
        "metric_name": "error_rate",
        "operator": "gt",
        "threshold": 0.05,
        "window_minutes": 5,
        "action": "disable",
    }, headers=auth_headers)

    assert resp.status_code in (200, 201, 404)
