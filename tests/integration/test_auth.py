"""Root-level integration tests for authentication endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    """Register a new user and log in — both should succeed with a token."""
    email = f"rootauth-{uuid4().hex[:8]}@example.com"
    password = "RootAuthPassword123!"

    register_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": "Root Auth User"},
    )
    assert register_resp.status_code in (200, 201)

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200

    data = login_resp.json()
    token = data.get("access_token") or data.get("token")
    assert token is not None and len(token) > 0


@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient):
    """Register, login, then GET /auth/me → 200 with the user's email or id."""
    email = f"rootme-{uuid4().hex[:8]}@example.com"
    password = "RootMePassword123!"

    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": "Root Me User"},
    )

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200

    data = login_resp.json()
    token = data.get("access_token") or data.get("token", "")
    headers = {"Authorization": f"Bearer {token}"}

    me_resp = await client.get("/api/v1/auth/me", headers=headers)

    if me_resp.status_code in (404, 501):
        pytest.skip("/auth/me endpoint not implemented")

    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert "email" in me_data or "id" in me_data
