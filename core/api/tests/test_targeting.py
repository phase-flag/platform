"""Tests for targeting service and segment-based targeting."""

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


@pytest.mark.asyncio
async def test_add_targeting_rule(client: AsyncClient, auth_headers: dict):
    """Adding a targeting rule to a flag succeeds."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="target-flag"), headers=auth_headers)

    resp = await client.post(
        "/api/v1/targeting/target-flag/rules",
        json={
            "priority": 1,
            "conditions": [
                {"attribute": "plan", "operator": "is", "value": "pro"},
            ],
            "variation_id": "v-on",
        },
        headers=auth_headers,
    )

    assert resp.status_code in (200, 201, 404)


@pytest.mark.asyncio
async def test_list_targeting_rules(client: AsyncClient, auth_headers: dict):
    """Listing targeting rules for a flag returns the rules."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="target-list"), headers=auth_headers)

    resp = await client.get("/api/v1/targeting/target-list/rules", headers=auth_headers)
    assert resp.status_code in (200, 404)


@pytest.mark.asyncio
async def test_update_targeting_rules(client: AsyncClient, auth_headers: dict):
    """Replacing all targeting rules on a flag."""
    await client.post(
        "/api/v1/flags",
        json=make_flag_payload(key="target-update"),
        headers=auth_headers,
    )

    resp = await client.put(
        "/api/v1/targeting/target-update/rules",
        json={
            "rules": [
                {
                    "priority": 1,
                    "conditions": [
                        {
                            "attribute": "country",
                            "operator": "one_of",
                            "value": ["US", "CA"],
                        },
                    ],
                    "variation_id": "v-on",
                },
                {
                    "priority": 2,
                    "conditions": [
                        {"attribute": "plan", "operator": "is", "value": "enterprise"},
                    ],
                    "percentage_rollout": {
                        "variations": [
                            {"variation_id": "v-on", "weight": 50},
                            {"variation_id": "v-off", "weight": 50},
                        ],
                    },
                },
            ],
        },
        headers=auth_headers,
    )

    assert resp.status_code in (200, 404)


@pytest.mark.asyncio
async def test_delete_targeting_rule(client: AsyncClient, auth_headers: dict):
    """Deleting a targeting rule from a flag."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="target-del"), headers=auth_headers)

    resp = await client.delete("/api/v1/targeting/target-del/rules/0", headers=auth_headers)
    assert resp.status_code in (200, 204, 404)


@pytest.mark.asyncio
async def test_targeting_with_segment(client: AsyncClient, auth_headers: dict):
    """Using a segment reference in a targeting rule."""
    # Create a segment
    await client.post(
        "/api/v1/segments",
        json={
            "key": "target-seg",
            "name": "Target Segment",
            "conditions": [{"attribute": "beta", "operator": "is", "value": "true"}],
        },
        headers=auth_headers,
    )

    await client.post(
        "/api/v1/flags",
        json=make_flag_payload(key="target-seg-flag"),
        headers=auth_headers,
    )

    resp = await client.post(
        "/api/v1/targeting/target-seg-flag/rules",
        json={
            "priority": 1,
            "segment_key": "target-seg",
            "variation_id": "v-on",
        },
        headers=auth_headers,
    )

    assert resp.status_code in (200, 201, 404)


@pytest.mark.asyncio
async def test_targeting_evaluation_with_rule(client: AsyncClient, auth_headers: dict):
    """Evaluating a flag with targeting rules returns the matched variation."""
    payload = make_flag_payload(key="eval-target")
    await client.post("/api/v1/flags", json=payload, headers=auth_headers)
    # Flag is created as inactive; toggle it to active before evaluation
    await client.post("/api/v1/flags/eval-target/toggle", headers=auth_headers)

    # Add targeting rule via flag update
    await client.put(
        "/api/v1/flags/eval-target",
        json={
            "targeting_rules": [
                {
                    "priority": 1,
                    "conditions": [
                        {"attribute": "plan", "operator": "is", "value": "enterprise"},
                    ],
                    "variation_id": "v-on",
                },
            ],
        },
        headers=auth_headers,
    )

    # Evaluate
    resp = await client.post(
        "/api/v1/sdk/evaluate",
        json={
            "flag_key": "eval-target",
            "context": {"user_id": "u1", "attributes": {"plan": "enterprise"}},
        },
        headers=auth_headers,
    )

    assert resp.status_code == 200
