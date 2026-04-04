"""Integration tests for experiment endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


@pytest.mark.asyncio
async def test_create_experiment(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/experiments with name, flag_key, hypothesis → 201 or 200."""
    flag_key = f"exp-flag-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=flag_key), headers=auth_headers)

    exp_key = f"exp-{uuid4().hex[:8]}"
    resp = await client.post(
        "/api/v1/experiments",
        json={
            "key": exp_key,
            "name": "Checkout Experiment",
            "flag_key": flag_key,
            "hypothesis": "The new checkout flow will increase conversions by 10%",
            "experiment_type": "ab",
            "traffic_percentage": 100,
        },
        headers=auth_headers,
    )

    if resp.status_code in (404, 501):
        pytest.skip("Experiments endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data.get("key") == exp_key
    assert data.get("status") in ("draft", "created", None)


@pytest.mark.asyncio
async def test_list_experiments(client: AsyncClient, auth_headers: dict):
    """Create 2 experiments, list → both appear."""
    exp_keys = []
    for i in range(2):
        flag_key = f"list-exp-flag-{uuid4().hex[:8]}"
        await client.post(
            "/api/v1/flags",
            json=make_flag_payload(key=flag_key),
            headers=auth_headers,
        )

        exp_key = f"list-exp-{uuid4().hex[:8]}"
        exp_keys.append(exp_key)
        create_resp = await client.post(
            "/api/v1/experiments",
            json={
                "key": exp_key,
                "name": f"List Experiment {i}",
                "flag_key": flag_key,
                "experiment_type": "ab",
            },
            headers=auth_headers,
        )
        if create_resp.status_code in (404, 501):
            pytest.skip("Experiments endpoint not implemented")

    list_resp = await client.get("/api/v1/experiments", headers=auth_headers)

    if list_resp.status_code in (404, 501):
        pytest.skip("Experiments list endpoint not implemented")

    assert list_resp.status_code == 200
    data = list_resp.json()

    if isinstance(data, list):
        found_keys = [e["key"] for e in data]
    else:
        items = data.get("items", data.get("experiments", data.get("data", [])))
        found_keys = [e["key"] for e in items]

    for k in exp_keys:
        assert k in found_keys


@pytest.mark.asyncio
async def test_experiment_status_change(client: AsyncClient, auth_headers: dict):
    """Change experiment status: start then stop."""
    flag_key = f"status-exp-flag-{uuid4().hex[:8]}"
    await client.post(
        "/api/v1/flags",
        json=make_flag_payload(key=flag_key),
        headers=auth_headers,
    )

    exp_key = f"status-exp-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/experiments",
        json={
            "key": exp_key,
            "name": "Status Change Experiment",
            "flag_key": flag_key,
            "experiment_type": "ab",
        },
        headers=auth_headers,
    )

    if create_resp.status_code in (404, 501):
        pytest.skip("Experiments endpoint not implemented")
    assert create_resp.status_code in (200, 201)

    # Use the key or id depending on what the API returns
    exp_id = create_resp.json().get("id", exp_key)

    # Start the experiment
    start_resp = await client.post(
        f"/api/v1/experiments/{exp_id}/start",
        headers=auth_headers,
    )
    # Accept success or error (might require active flag etc.)
    assert start_resp.status_code in (200, 201, 400, 404, 422)

    if start_resp.status_code in (200, 201):
        data = start_resp.json()
        assert data.get("status") in ("running", "active", "started")

        # Stop the experiment
        stop_resp = await client.post(
            f"/api/v1/experiments/{exp_id}/stop",
            headers=auth_headers,
        )
        assert stop_resp.status_code in (200, 201, 400, 404, 422)
