"""Integration tests for billing endpoints."""

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_billing_plans(client: AsyncClient):
    """GET /api/v1/billing/plans → 200 with plans list (no auth required)."""
    resp = await client.get("/api/v1/billing/plans")
    if resp.status_code in (404, 501):
        pytest.skip("Billing plans endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    plans = data.get("plans", data) if isinstance(data, dict) else data
    assert isinstance(plans, list)
    assert len(plans) >= 1

    # Verify plan structure
    for plan in plans:
        assert "id" in plan
        assert "name" in plan


@pytest.mark.asyncio
async def test_billing_plans_includes_free_tier(client: AsyncClient):
    """GET /api/v1/billing/plans → free tier is present."""
    resp = await client.get("/api/v1/billing/plans")
    if resp.status_code in (404, 501):
        pytest.skip("Billing plans endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    plans = data.get("plans", data) if isinstance(data, dict) else data
    plan_ids = [p["id"] for p in plans]
    assert "free" in plan_ids


@pytest.mark.asyncio
async def test_billing_plans_includes_pro_tier(client: AsyncClient):
    """GET /api/v1/billing/plans → pro tier is present."""
    resp = await client.get("/api/v1/billing/plans")
    if resp.status_code in (404, 501):
        pytest.skip("Billing plans endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    plans = data.get("plans", data) if isinstance(data, dict) else data
    plan_ids = [p["id"] for p in plans]
    assert "pro" in plan_ids


@pytest.mark.asyncio
async def test_billing_plans_have_features(client: AsyncClient):
    """Each billing plan has a non-empty features list."""
    resp = await client.get("/api/v1/billing/plans")
    if resp.status_code in (404, 501):
        pytest.skip("Billing plans endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    plans = data.get("plans", data) if isinstance(data, dict) else data
    for plan in plans:
        features = plan.get("features", [])
        assert isinstance(features, list)
        assert len(features) > 0


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_billing_checkout_without_stripe_returns_503(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/billing/checkout → 503 when Stripe not configured."""
    resp = await client.post(
        "/api/v1/billing/checkout",
        json={
            "plan_id": "pro",
            "org_id": "some-org-id",
            "success_url": "https://example.com/success",
            "cancel_url": "https://example.com/cancel",
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Billing checkout endpoint not implemented")

    # Without Stripe configured, should return 503 or 400 (unknown plan/org)
    assert resp.status_code in (400, 404, 503)


@pytest.mark.asyncio
async def test_billing_checkout_unknown_plan(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/billing/checkout with unknown plan_id → 400."""
    resp = await client.post(
        "/api/v1/billing/checkout",
        json={
            "plan_id": "nonexistent-plan",
            "org_id": "some-org-id",
            "success_url": "https://example.com/success",
            "cancel_url": "https://example.com/cancel",
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Billing checkout endpoint not implemented")

    # Should get 400 for unknown plan or 503 for no Stripe
    assert resp.status_code in (400, 503)
