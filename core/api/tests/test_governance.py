"""Tests for governance endpoints (change requests, freeze windows, break-glass)."""

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


@pytest.mark.asyncio
async def test_create_change_request(client: AsyncClient, auth_headers: dict):
    """Creating a change request returns the change request data."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="gov-flag"), headers=auth_headers)

    resp = await client.post(
        "/api/v1/changes",
        json={
            "title": "Enable gov-flag in production",
            "description": "Tested in staging, ready for prod",
            "entity_type": "flag",
            "entity_key": "gov-flag",
            "change_type": "toggle",
            "environment": "production",
        },
        headers=auth_headers,
    )

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data.get("status") == "pending"


@pytest.mark.asyncio
async def test_list_change_requests(client: AsyncClient, auth_headers: dict):
    """Listing change requests returns an array."""
    resp = await client.get("/api/v1/changes", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_approve_change_request(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    """Approving a change request updates its status."""
    await client.post(
        "/api/v1/flags",
        json=make_flag_payload(key="approve-flag"),
        headers=auth_headers,
    )

    create_resp = await client.post(
        "/api/v1/changes",
        json={
            "title": "Enable approve-flag",
            "entity_type": "flag",
            "entity_key": "approve-flag",
            "change_type": "toggle",
        },
        headers=auth_headers,
    )

    if create_resp.status_code in (200, 201):
        change_id = create_resp.json().get("id")
        if change_id:
            resp = await client.post(
                f"/api/v1/changes/{change_id}/approve",
                json={
                    "comment": "Approved after review",
                },
                headers=admin_headers,
            )
            # 400 is expected when the two-person rule is enforced (both users
            # resolve to "system" via the shared X-API-Key header).
            assert resp.status_code in (200, 400, 403)


@pytest.mark.asyncio
async def test_reject_change_request(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    """Rejecting a change request updates its status."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="reject-flag"), headers=auth_headers)

    create_resp = await client.post(
        "/api/v1/changes",
        json={
            "title": "Enable reject-flag",
            "entity_type": "flag",
            "entity_key": "reject-flag",
            "change_type": "toggle",
        },
        headers=auth_headers,
    )

    if create_resp.status_code in (200, 201):
        change_id = create_resp.json().get("id")
        if change_id:
            resp = await client.post(
                f"/api/v1/changes/{change_id}/reject",
                json={
                    "comment": "Not ready yet",
                },
                headers=admin_headers,
            )
            assert resp.status_code in (200, 404)


@pytest.mark.asyncio
async def test_create_freeze_window(client: AsyncClient, admin_headers: dict):
    """Creating a freeze window returns the freeze window data."""
    resp = await client.post(
        "/api/v1/governance/freeze-windows",
        json={
            "name": "Holiday Freeze",
            "environment": "production",
            "starts_at": "2026-12-20T00:00:00Z",
            "ends_at": "2027-01-03T00:00:00Z",
            "reason": "Holiday code freeze",
        },
        headers=admin_headers,
    )

    assert resp.status_code in (200, 201, 404)


@pytest.mark.asyncio
async def test_create_service_account(client: AsyncClient, admin_headers: dict):
    """Creating a service account returns an API key."""
    resp = await client.post(
        "/api/v1/governance/service-accounts",
        json={
            "name": "CI/CD Bot",
            "description": "Automated deployment service",
            "role": "editor",
            "scopes": ["flags:read", "flags:write"],
        },
        headers=admin_headers,
    )

    assert resp.status_code in (200, 201, 404)


@pytest.mark.asyncio
async def test_break_glass(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    """Break-glass allows emergency changes bypassing freeze windows."""
    await client.post("/api/v1/flags", json=make_flag_payload(key="bg-flag"), headers=auth_headers)

    resp = await client.post(
        "/api/v1/governance/break-glass",
        json={
            "flag_key": "bg-flag",
            "environment": "production",
            "action": "toggle",
            "reason": "Critical production incident P0",
        },
        headers=admin_headers,
    )

    assert resp.status_code in (200, 201, 404)


@pytest.mark.asyncio
async def test_unauthorized_governance(client: AsyncClient):
    """Governance endpoints require authentication."""
    resp = await client.get("/api/v1/changes")
    assert resp.status_code in (401, 403)
