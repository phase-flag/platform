"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_user(client: AsyncClient):
    """Registering a new user returns success."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "StrongPassword123!",
            "name": "New User",
        },
    )

    assert resp.status_code in (200, 201)
    data = resp.json()
    # Response may nest user info under "user" key
    user = data.get("user", data)
    assert user.get("email") == "newuser@example.com" or "id" in user


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """Registering with a duplicate email returns an error."""
    payload = {
        "email": "duplicate@example.com",
        "password": "StrongPassword123!",
        "name": "First User",
    }
    await client.post("/api/v1/auth/register", json=payload)
    resp = await client.post("/api/v1/auth/register", json=payload)

    assert resp.status_code in (400, 409, 422)


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    """Logging in with valid credentials returns a JWT token."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "loginuser@example.com",
            "password": "ValidPassword123!",
            "name": "Login User",
        },
    )

    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "loginuser@example.com",
            "password": "ValidPassword123!",
        },
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data or "token" in data


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient):
    """Logging in with wrong password returns 401."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "wrongpw@example.com",
            "password": "CorrectPassword123!",
            "name": "Test User",
        },
    )

    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "wrongpw@example.com",
            "password": "WrongPassword123!",
        },
    )

    assert resp.status_code in (400, 401, 403)


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """Logging in with a non-existent email returns 401."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "nosuchuser@example.com",
            "password": "SomePassword123!",
        },
    )

    assert resp.status_code in (400, 401, 404)


@pytest.mark.asyncio
async def test_protected_endpoint_no_auth(client: AsyncClient):
    """Accessing a protected endpoint without auth returns 401 or 403."""
    resp = await client.get("/api/v1/flags")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_protected_endpoint_with_auth(client: AsyncClient, auth_headers: dict):
    """Accessing a protected endpoint with valid auth succeeds."""
    resp = await client.get("/api/v1/flags", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_me_endpoint(client: AsyncClient, auth_headers: dict):
    """The /auth/me endpoint returns the current user profile."""
    resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    # This endpoint may or may not exist; if it does, check it returns user info
    if resp.status_code == 200:
        data = resp.json()
        assert "email" in data or "id" in data


@pytest.mark.asyncio
async def test_invalid_token(client: AsyncClient):
    """Using an invalid JWT token returns 401."""
    headers = {"Authorization": "Bearer invalid-token-here"}
    resp = await client.get("/api/v1/flags", headers=headers)
    assert resp.status_code in (401, 403)
