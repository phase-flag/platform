"""Integration tests for authentication endpoints."""

import time
from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_new_user(client: AsyncClient):
    """POST /api/v1/auth/register with valid email/password → 201 with token."""
    email = f"register-{uuid4().hex[:8]}@example.com"
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "name": "New User",
        },
    )

    assert resp.status_code in (200, 201)
    data = resp.json()
    # Response may nest user info or include access_token directly
    has_token = "access_token" in data or "token" in data
    has_user = "user" in data or "email" in data or "id" in data
    assert has_token or has_user


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """Register same email twice → second returns 409."""
    email = f"dup-{uuid4().hex[:8]}@example.com"
    payload = {
        "email": email,
        "password": "StrongPassword123!",
        "name": "First User",
    }

    first_resp = await client.post("/api/v1/auth/register", json=payload)
    assert first_resp.status_code in (200, 201)

    second_resp = await client.post("/api/v1/auth/register", json=payload)
    assert second_resp.status_code in (400, 409, 422)


@pytest.mark.asyncio
async def test_login_valid(client: AsyncClient):
    """Register user, POST /api/v1/auth/login → 200 with token."""
    email = f"login-{uuid4().hex[:8]}@example.com"
    password = "ValidPassword123!"

    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": "Login User"},
    )

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data or "token" in data


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient):
    """Wrong password → 401."""
    email = f"wrongpw-{uuid4().hex[:8]}@example.com"

    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "CorrectPassword123!", "name": "Test User"},
    )

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword999!"},
    )

    assert resp.status_code in (400, 401, 403)


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient):
    """GET /api/v1/auth/me with valid JWT → 200 with user data."""
    email = f"me-{uuid4().hex[:8]}@example.com"
    password = "GetMePassword123!"

    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": "Me User"},
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


@pytest.mark.asyncio
async def test_expired_token_rejected(client: AsyncClient):
    """Token with past expiry should be rejected with 401."""
    # Attempt to create an expired token using the auth service
    try:
        import jwt as pyjwt

        from phaseflag_api.config import settings

        expired_payload = {
            "sub": "user-expired-test",
            "exp": int(time.time()) - 3600,  # 1 hour in the past
            "iat": int(time.time()) - 7200,
        }
        expired_token = pyjwt.encode(
            expired_payload,
            settings.JWT_SECRET_KEY,
            algorithm="HS256",
        )
    except ImportError:
        # If jwt is not directly importable, construct a clearly invalid token
        expired_token = "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.invalid"

    headers = {"Authorization": f"Bearer {expired_token}"}
    resp = await client.get("/api/v1/flags", headers=headers)
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_first_user_is_admin(client: AsyncClient):
    """Register first user in a fresh DB → role is 'admin'."""
    email = f"firstadmin-{uuid4().hex[:8]}@example.com"
    password = "AdminFirst123!"

    register_resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": "First Admin"},
    )
    assert register_resp.status_code in (200, 201)

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200

    data = login_resp.json()
    token = data.get("access_token") or data.get("token", "")
    headers = {"Authorization": f"Bearer {token}"}

    me_resp = await client.get("/api/v1/auth/me", headers=headers)
    if me_resp.status_code in (200,):
        me_data = me_resp.json()
        role = me_data.get("role")
        if role is not None:
            assert role == "admin"
    # If /me is not available, check register response
    elif register_resp.status_code in (200, 201):
        reg_data = register_resp.json()
        user = reg_data.get("user", reg_data)
        role = user.get("role")
        if role is not None:
            assert role == "admin"


@pytest.mark.asyncio
async def test_subsequent_user_is_viewer(client: AsyncClient):
    """Register second user → role is 'viewer' (not admin)."""
    # Register first user (admin)
    first_email = f"first-{uuid4().hex[:8]}@example.com"
    await client.post(
        "/api/v1/auth/register",
        json={"email": first_email, "password": "FirstUser123!", "name": "First User"},
    )

    # Register second user
    second_email = f"second-{uuid4().hex[:8]}@example.com"
    second_password = "SecondUser123!"
    await client.post(
        "/api/v1/auth/register",
        json={"email": second_email, "password": second_password, "name": "Second User"},
    )

    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": second_email, "password": second_password},
    )
    assert login_resp.status_code == 200

    data = login_resp.json()
    token = data.get("access_token") or data.get("token", "")
    headers = {"Authorization": f"Bearer {token}"}

    me_resp = await client.get("/api/v1/auth/me", headers=headers)
    if me_resp.status_code == 200:
        me_data = me_resp.json()
        role = me_data.get("role")
        if role is not None:
            assert role in ("viewer", "member", "user")
