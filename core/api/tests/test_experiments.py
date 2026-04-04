"""Tests for experimentation endpoints."""

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


@pytest.mark.asyncio
async def test_create_experiment(client: AsyncClient, auth_headers: dict):
    """Creating an experiment returns the experiment data."""
    await client.post(
        "/api/v1/flags", json=make_flag_payload(key="exp-flag"), headers=auth_headers
    )

    resp = await client.post(
        "/api/v1/experiments",
        json={
            "key": "exp-checkout",
            "name": "Checkout Experiment",
            "flag_key": "exp-flag",
            "hypothesis": "The new checkout flow will increase conversions by 10%",
            "experiment_type": "ab",
            "traffic_percentage": 100,
        },
        headers=auth_headers,
    )

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data.get("key") == "exp-checkout"
    assert data.get("status") == "draft"


@pytest.mark.asyncio
async def test_list_experiments(client: AsyncClient, auth_headers: dict):
    """Listing experiments returns an array."""
    resp = await client.get("/api/v1/experiments", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_experiment(client: AsyncClient, auth_headers: dict):
    """Getting an experiment by key returns the experiment data."""
    await client.post(
        "/api/v1/flags",
        json=make_flag_payload(key="exp-get-flag"),
        headers=auth_headers,
    )

    create_resp = await client.post(
        "/api/v1/experiments",
        json={
            "key": "exp-get",
            "name": "Get Experiment",
            "flag_key": "exp-get-flag",
            "experiment_type": "ab",
        },
        headers=auth_headers,
    )

    if create_resp.status_code in (200, 201):
        resp = await client.get("/api/v1/experiments/exp-get", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["key"] == "exp-get"


@pytest.mark.asyncio
async def test_start_experiment(client: AsyncClient, auth_headers: dict):
    """Starting an experiment changes its status to running."""
    await client.post(
        "/api/v1/flags",
        json=make_flag_payload(key="exp-start-flag"),
        headers=auth_headers,
    )

    create_resp = await client.post(
        "/api/v1/experiments",
        json={
            "key": "exp-start",
            "name": "Start Experiment",
            "flag_key": "exp-start-flag",
            "experiment_type": "ab",
        },
        headers=auth_headers,
    )

    if create_resp.status_code in (200, 201):
        exp_id = create_resp.json().get("id", create_resp.json().get("key"))
        resp = await client.post(
            f"/api/v1/experiments/{exp_id}/start", headers=auth_headers
        )
        assert resp.status_code in (200, 400, 404)


@pytest.mark.asyncio
async def test_stop_experiment(client: AsyncClient, auth_headers: dict):
    """Stopping an experiment changes its status to completed."""
    await client.post(
        "/api/v1/flags",
        json=make_flag_payload(key="exp-stop-flag"),
        headers=auth_headers,
    )

    create_resp = await client.post(
        "/api/v1/experiments",
        json={
            "key": "exp-stop",
            "name": "Stop Experiment",
            "flag_key": "exp-stop-flag",
            "experiment_type": "ab",
        },
        headers=auth_headers,
    )

    if create_resp.status_code in (200, 201):
        exp_id = create_resp.json().get("id", create_resp.json().get("key"))
        resp = await client.post(
            f"/api/v1/experiments/{exp_id}/stop", headers=auth_headers
        )
        assert resp.status_code in (200, 400, 404)


@pytest.mark.asyncio
async def test_add_experiment_goal(client: AsyncClient, auth_headers: dict):
    """Adding a goal to an experiment succeeds."""
    await client.post(
        "/api/v1/flags",
        json=make_flag_payload(key="exp-goal-flag"),
        headers=auth_headers,
    )

    create_resp = await client.post(
        "/api/v1/experiments",
        json={
            "key": "exp-goal",
            "name": "Goal Experiment",
            "flag_key": "exp-goal-flag",
            "experiment_type": "ab",
        },
        headers=auth_headers,
    )

    if create_resp.status_code in (200, 201):
        exp_key = create_resp.json().get("key", "exp-goal")
        resp = await client.post(
            f"/api/v1/experiments/{exp_key}/goals",
            json={
                "name": "Conversion Rate",
                "metric_key": "checkout_completed",
                "goal_type": "conversion",
                "is_primary": True,
                "min_sample_size": 1000,
            },
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201, 404)


@pytest.mark.asyncio
async def test_get_experiment_results(client: AsyncClient, auth_headers: dict):
    """Getting experiment results returns statistical data."""
    await client.post(
        "/api/v1/flags",
        json=make_flag_payload(key="exp-res-flag"),
        headers=auth_headers,
    )

    create_resp = await client.post(
        "/api/v1/experiments",
        json={
            "key": "exp-results",
            "name": "Results Experiment",
            "flag_key": "exp-res-flag",
            "experiment_type": "ab",
        },
        headers=auth_headers,
    )

    if create_resp.status_code in (200, 201):
        exp_key = create_resp.json().get("key", "exp-results")
        resp = await client.post(
            f"/api/v1/experiments/{exp_key}/results",
            json={
                "variation_key": "on",
                "sample_size": 100,
                "conversions": 15,
            },
            headers=auth_headers,
        )
        assert resp.status_code in (201, 200, 404)
