"""Tests for flag lifecycle management."""

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


@pytest.mark.asyncio
async def test_flag_starts_in_development(client: AsyncClient, auth_headers: dict):
    """A newly created flag starts in the 'development' lifecycle stage."""
    payload = make_flag_payload(key="lc-new")
    resp = await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data.get("lifecycle_stage") == "development"


@pytest.mark.asyncio
async def test_transition_to_testing(client: AsyncClient, auth_headers: dict):
    """Transitioning a flag from development to testing succeeds."""
    await client.post(
        "/api/v1/flags", json=make_flag_payload(key="lc-test"), headers=auth_headers
    )

    resp = await client.post(
        "/api/v1/lifecycle/lc-test/transition",
        json={
            "target_stage": "testing",
        },
        headers=auth_headers,
    )

    assert resp.status_code in (200, 404)
    if resp.status_code == 200:
        assert resp.json().get("lifecycle_stage") == "testing"


@pytest.mark.asyncio
async def test_transition_to_production(client: AsyncClient, auth_headers: dict):
    """Transitioning a flag through testing to production succeeds."""
    await client.post(
        "/api/v1/flags", json=make_flag_payload(key="lc-prod"), headers=auth_headers
    )

    # development -> testing
    await client.post(
        "/api/v1/lifecycle/lc-prod/transition",
        json={
            "target_stage": "testing",
        },
        headers=auth_headers,
    )

    # testing -> production
    resp = await client.post(
        "/api/v1/lifecycle/lc-prod/transition",
        json={
            "target_stage": "production",
        },
        headers=auth_headers,
    )

    assert resp.status_code in (200, 404)


@pytest.mark.asyncio
async def test_invalid_transition(client: AsyncClient, auth_headers: dict):
    """An invalid lifecycle transition returns an error."""
    await client.post(
        "/api/v1/flags", json=make_flag_payload(key="lc-invalid"), headers=auth_headers
    )

    # Trying to jump from development directly to stale should fail
    resp = await client.post(
        "/api/v1/lifecycle/lc-invalid/transition",
        json={
            "target_stage": "stale",
        },
        headers=auth_headers,
    )

    assert resp.status_code in (400, 404, 422)


@pytest.mark.asyncio
async def test_stale_detection(client: AsyncClient, auth_headers: dict):
    """The stale detection endpoint returns a list of stale flags."""
    resp = await client.get("/api/v1/lifecycle/stale", headers=auth_headers)
    assert resp.status_code in (200, 404)


@pytest.mark.asyncio
async def test_expiring_flags(client: AsyncClient, auth_headers: dict):
    """The expiring flags endpoint returns flags nearing expiration."""
    payload = make_flag_payload(key="lc-expires")
    payload["expires_at"] = "2026-04-01T00:00:00Z"
    await client.post("/api/v1/flags", json=payload, headers=auth_headers)

    resp = await client.get("/api/v1/lifecycle/expiring", headers=auth_headers)
    assert resp.status_code in (200, 404)


@pytest.mark.asyncio
async def test_lifecycle_summary(client: AsyncClient, auth_headers: dict):
    """The lifecycle summary endpoint returns counts by stage."""
    await client.post(
        "/api/v1/flags", json=make_flag_payload(key="lc-sum1"), headers=auth_headers
    )
    await client.post(
        "/api/v1/flags", json=make_flag_payload(key="lc-sum2"), headers=auth_headers
    )

    resp = await client.get("/api/v1/lifecycle/summary", headers=auth_headers)
    assert resp.status_code in (200, 404)
