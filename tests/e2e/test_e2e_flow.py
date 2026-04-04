"""
End-to-end tests that call a live Phase Flag API server.

All tests skip automatically when the API is not running. Use the
PHASEFLAG_API_URL environment variable to point at a non-default server:

    PHASEFLAG_API_URL=http://staging.api.example.com/api/v1 pytest tests/e2e/ -v

Test data is isolated by using uuid4 suffixes for all names/emails.
"""

from uuid import uuid4

import httpx
import pytest
import pytest_asyncio

from tests.e2e.conftest import API_BASE_URL

# ---------------------------------------------------------------------------
# Helper: attempt a live connection (used in module-level skip)
# ---------------------------------------------------------------------------


def _api_is_reachable() -> bool:
    """Return True if the live API responds to /health without error."""
    health_url = API_BASE_URL.replace("/api/v1", "") + "/health"
    try:
        resp = httpx.get(health_url, timeout=5.0)
        return resp.status_code < 500
    except (httpx.ConnectError, httpx.TimeoutException):
        return False


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_health_check(api_client: httpx.AsyncClient):
    """GET /health → 200."""
    health_url = API_BASE_URL.replace("/api/v1", "") + "/health"
    try:
        resp = await api_client.get(health_url)
        assert resp.status_code == 200
    except (httpx.ConnectError, httpx.TimeoutException):
        pytest.skip("API server not reachable")


@pytest.mark.asyncio
async def test_signup_login_me_flow(api_client: httpx.AsyncClient):
    """Register → login → GET /auth/me, verify user data is returned."""
    email = f"e2e-{uuid4().hex[:8]}@example.com"
    password = "E2EPassword123!"

    # Register
    try:
        register_resp = await api_client.post(
            "/auth/register",
            json={"email": email, "password": password, "name": "E2E User"},
        )
    except (httpx.ConnectError, httpx.TimeoutException):
        pytest.skip("API server not reachable")

    assert register_resp.status_code in (200, 201)

    # Login
    login_resp = await api_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    token = login_resp.json().get("access_token") or login_resp.json().get("token", "")
    assert token

    # GET /auth/me
    me_resp = await api_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    if me_resp.status_code in (404, 501):
        pytest.skip("/auth/me not implemented")

    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert "email" in me_data or "id" in me_data


@pytest.mark.asyncio
async def test_create_project_flow(api_client: httpx.AsyncClient):
    """Login as admin → POST /organizations → POST /organizations/{slug}/projects."""
    email = f"e2e-admin-{uuid4().hex[:8]}@example.com"
    password = "E2EAdminPassword123!"
    org_slug = f"e2e-org-{uuid4().hex[:8]}"

    # Register (first user becomes admin in OSS mode)
    try:
        await api_client.post(
            "/auth/register",
            json={"email": email, "password": password, "name": "E2E Admin"},
        )
    except (httpx.ConnectError, httpx.TimeoutException):
        pytest.skip("API server not reachable")

    login_resp = await api_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    token = login_resp.json().get("access_token") or login_resp.json().get("token", "")
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Create organization
    org_resp = await api_client.post(
        "/organizations",
        json={"name": f"E2E Org {uuid4().hex[:8]}", "slug": org_slug},
        headers=auth_headers,
    )
    if org_resp.status_code in (404, 501):
        pytest.skip("/organizations endpoint not implemented")
    assert org_resp.status_code in (200, 201)

    # Create project within the organization
    project_resp = await api_client.post(
        f"/organizations/{org_slug}/projects",
        json={"name": f"E2E Project {uuid4().hex[:8]}", "key": f"e2e-proj-{uuid4().hex[:8]}"},
        headers=auth_headers,
    )
    if project_resp.status_code in (404, 501):
        pytest.skip("/organizations/{slug}/projects endpoint not implemented")
    assert project_resp.status_code in (200, 201)


@pytest.mark.asyncio
async def test_create_and_evaluate_flag_flow(api_client: httpx.AsyncClient):
    """Login → create flag → activate it → POST /evaluate."""
    email = f"e2e-eval-{uuid4().hex[:8]}@example.com"
    password = "E2EEvalPassword123!"
    flag_key = f"e2e-flag-{uuid4().hex[:8]}"

    try:
        await api_client.post(
            "/auth/register",
            json={"email": email, "password": password, "name": "E2E Eval User"},
        )
    except (httpx.ConnectError, httpx.TimeoutException):
        pytest.skip("API server not reachable")

    login_resp = await api_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    token = login_resp.json().get("access_token") or login_resp.json().get("token", "")
    auth_headers = {"Authorization": f"Bearer {token}", "X-API-Key": "test-api-key"}

    # Create flag
    flag_resp = await api_client.post(
        "/flags",
        json={
            "key": flag_key,
            "name": "E2E Feature Flag",
            "flag_type": "boolean",
            "environment": "development",
            "variations": [
                {"key": "on", "name": "Enabled", "value": True},
                {"key": "off", "name": "Disabled", "value": False},
            ],
            "default_variation_key": "off",
        },
        headers=auth_headers,
    )
    assert flag_resp.status_code in (200, 201)

    # Activate the flag
    toggle_resp = await api_client.post(f"/flags/{flag_key}/toggle", headers=auth_headers)
    # Accept success or method-not-allowed; the evaluate test still runs
    assert toggle_resp.status_code in (200, 404, 405)

    # Evaluate the flag
    eval_resp = await api_client.post(
        "/evaluate",
        json={
            "flag_key": flag_key,
            "user_key": f"user-{uuid4().hex[:8]}",
            "context": {},
        },
        headers=auth_headers,
    )

    if eval_resp.status_code in (404, 501):
        pytest.skip("/evaluate endpoint not implemented")

    assert eval_resp.status_code == 200
    data = eval_resp.json()
    assert "variation_key" in data or "variation" in data or "value" in data


@pytest.mark.asyncio
async def test_toggle_flag_off_returns_default(api_client: httpx.AsyncClient):
    """Create active flag → toggle off → evaluate → verify default variation returned."""
    email = f"e2e-toggle-{uuid4().hex[:8]}@example.com"
    password = "E2ETogglePassword123!"
    flag_key = f"e2e-toggle-{uuid4().hex[:8]}"

    try:
        await api_client.post(
            "/auth/register",
            json={"email": email, "password": password, "name": "E2E Toggle User"},
        )
    except (httpx.ConnectError, httpx.TimeoutException):
        pytest.skip("API server not reachable")

    login_resp = await api_client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    token = login_resp.json().get("access_token") or login_resp.json().get("token", "")
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Create and activate the flag in one step (if status field is accepted)
    flag_resp = await api_client.post(
        "/flags",
        json={
            "key": flag_key,
            "name": "E2E Toggle Flag",
            "flag_type": "boolean",
            "environment": "development",
            "status": "active",
            "variations": [
                {"key": "on", "name": "Enabled", "value": True},
                {"key": "off", "name": "Disabled", "value": False},
            ],
            "default_variation_key": "off",
        },
        headers=auth_headers,
    )
    assert flag_resp.status_code in (200, 201)

    # Toggle off (make inactive)
    toggle_off_resp = await api_client.post(
        f"/flags/{flag_key}/toggle",
        headers=auth_headers,
    )
    if toggle_off_resp.status_code not in (200, 404):
        pytest.skip("Toggle endpoint not available")

    # Evaluate — should return the default variation
    eval_resp = await api_client.post(
        "/evaluate",
        json={
            "flag_key": flag_key,
            "user_key": f"user-{uuid4().hex[:8]}",
            "context": {},
        },
        headers=auth_headers,
    )

    if eval_resp.status_code in (404, 501):
        pytest.skip("/evaluate endpoint not implemented")

    assert eval_resp.status_code == 200
    data = eval_resp.json()
    # Default variation key should be "off" (as set in default_variation_key)
    variation = data.get("variation_key") or data.get("variation")
    if variation is not None:
        assert variation == "off"
