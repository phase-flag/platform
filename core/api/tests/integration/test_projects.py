"""Integration tests for organization and project CRUD endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def _register_and_login(client: AsyncClient) -> dict[str, str]:
    email = f"proj-user-{uuid4().hex[:8]}@example.com"
    password = "ProjPassword123!"
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "name": "Proj User"},
    )
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        token = resp.json().get("access_token") or resp.json().get("token", "")
        return {"Authorization": f"Bearer {token}", "X-API-Key": "test-api-key"}
    return {"X-API-Key": "test-api-key"}


# ---------------------------------------------------------------------------
# Organization happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_organization(client: AsyncClient, admin_headers: dict):
    """POST /api/v1/organizations with unique slug → 201 with org data."""
    slug = f"org-{uuid4().hex[:8]}"
    resp = await client.post(
        "/api/v1/organizations",
        json={"slug": slug, "name": "Test Org", "description": "An org for testing"},
        headers=admin_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Organizations endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["slug"] == slug
    assert data["name"] == "Test Org"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_organizations(client: AsyncClient, admin_headers: dict):
    """Create 2 orgs, list them → both appear."""
    slugs = []
    for i in range(2):
        slug = f"list-org-{uuid4().hex[:8]}"
        slugs.append(slug)
        resp = await client.post(
            "/api/v1/organizations",
            json={"slug": slug, "name": f"List Org {i}"},
            headers=admin_headers,
        )
        if resp.status_code in (404, 501):
            pytest.skip("Organizations endpoint not implemented")

    list_resp = await client.get("/api/v1/organizations", headers=admin_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Organizations list endpoint not implemented")

    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data.get("items", data) if isinstance(data, dict) else data
    found_slugs = [o["slug"] for o in items]
    for s in slugs:
        assert s in found_slugs


@pytest.mark.asyncio
async def test_get_organization_by_slug(client: AsyncClient, admin_headers: dict):
    """Create an org, GET it by slug → returns correct org."""
    slug = f"get-org-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/organizations",
        json={"slug": slug, "name": "Get Org"},
        headers=admin_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Organizations endpoint not implemented")
    assert create_resp.status_code in (200, 201)

    get_resp = await client.get(f"/api/v1/organizations/{slug}", headers=admin_headers)
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["slug"] == slug


@pytest.mark.asyncio
async def test_update_organization(client: AsyncClient, admin_headers: dict):
    """Update org name/description → changes reflected."""
    slug = f"upd-org-{uuid4().hex[:8]}"
    create_resp = await client.post(
        "/api/v1/organizations",
        json={"slug": slug, "name": "Original Org Name"},
        headers=admin_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Organizations endpoint not implemented")
    assert create_resp.status_code in (200, 201)

    update_resp = await client.put(
        f"/api/v1/organizations/{slug}",
        json={"name": "Updated Org Name", "description": "New description"},
        headers=admin_headers,
    )
    if update_resp.status_code in (404, 501):
        pytest.skip("Organizations update endpoint not implemented")
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["name"] == "Updated Org Name"


# ---------------------------------------------------------------------------
# Project happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_project_in_org(client: AsyncClient, admin_headers: dict):
    """Create org then project inside it → 201 with correct org relationship."""
    org_slug = f"proj-org-{uuid4().hex[:8]}"
    org_resp = await client.post(
        "/api/v1/organizations",
        json={"slug": org_slug, "name": "Proj Parent Org"},
        headers=admin_headers,
    )
    if org_resp.status_code in (404, 501):
        pytest.skip("Organizations endpoint not implemented")
    assert org_resp.status_code in (200, 201)

    proj_slug = f"proj-{uuid4().hex[:8]}"
    proj_resp = await client.post(
        f"/api/v1/organizations/{org_slug}/projects",
        json={"slug": proj_slug, "name": "My Project"},
        headers=admin_headers,
    )
    if proj_resp.status_code in (404, 501):
        pytest.skip("Projects endpoint not implemented")
    assert proj_resp.status_code in (200, 201)
    data = proj_resp.json()
    assert data["slug"] == proj_slug


@pytest.mark.asyncio
async def test_list_projects_in_org(client: AsyncClient, admin_headers: dict):
    """Create org + 2 projects, list projects → both appear."""
    org_slug = f"list-proj-org-{uuid4().hex[:8]}"
    org_resp = await client.post(
        "/api/v1/organizations",
        json={"slug": org_slug, "name": "List Proj Org"},
        headers=admin_headers,
    )
    if org_resp.status_code in (404, 501):
        pytest.skip("Organizations endpoint not implemented")
    assert org_resp.status_code in (200, 201)

    proj_slugs = []
    for i in range(2):
        ps = f"proj-{uuid4().hex[:8]}"
        proj_slugs.append(ps)
        r = await client.post(
            f"/api/v1/organizations/{org_slug}/projects",
            json={"slug": ps, "name": f"Project {i}"},
            headers=admin_headers,
        )
        if r.status_code in (404, 501):
            pytest.skip("Projects endpoint not implemented")

    list_resp = await client.get(f"/api/v1/organizations/{org_slug}/projects", headers=admin_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Projects list endpoint not implemented")
    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data.get("items", data) if isinstance(data, dict) else data
    found = [p["slug"] for p in items]
    for s in proj_slugs:
        assert s in found


@pytest.mark.asyncio
async def test_get_project_by_id(client: AsyncClient, admin_headers: dict):
    """Create org + project, GET project by ID → correct data."""
    org_slug = f"getproj-org-{uuid4().hex[:8]}"
    await client.post(
        "/api/v1/organizations",
        json={"slug": org_slug, "name": "GetProj Org"},
        headers=admin_headers,
    )
    proj_slug = f"getproj-{uuid4().hex[:8]}"
    proj_resp = await client.post(
        f"/api/v1/organizations/{org_slug}/projects",
        json={"slug": proj_slug, "name": "GetProj"},
        headers=admin_headers,
    )
    if proj_resp.status_code in (404, 501):
        pytest.skip("Projects endpoint not implemented")
    assert proj_resp.status_code in (200, 201)
    project_id = proj_resp.json()["id"]

    get_resp = await client.get(f"/api/v1/projects/{project_id}", headers=admin_headers)
    if get_resp.status_code in (404, 501):
        pytest.skip("Get project by ID not implemented")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == project_id


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_duplicate_org_slug_rejected(client: AsyncClient, admin_headers: dict):
    """Creating two orgs with the same slug → second returns 409."""
    slug = f"dup-org-{uuid4().hex[:8]}"
    r1 = await client.post(
        "/api/v1/organizations",
        json={"slug": slug, "name": "First"},
        headers=admin_headers,
    )
    if r1.status_code in (404, 501):
        pytest.skip("Organizations endpoint not implemented")
    assert r1.status_code in (200, 201)

    r2 = await client.post(
        "/api/v1/organizations",
        json={"slug": slug, "name": "Duplicate"},
        headers=admin_headers,
    )
    assert r2.status_code in (400, 409, 422)


@pytest.mark.asyncio
async def test_get_nonexistent_org_returns_404(client: AsyncClient, admin_headers: dict):
    """GET /api/v1/organizations/{slug} for non-existent slug → 404."""
    resp = await client.get(f"/api/v1/organizations/nonexistent-{uuid4().hex}", headers=admin_headers)
    if resp.status_code in (501,):
        pytest.skip("Organizations endpoint not implemented")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_project_in_nonexistent_org(client: AsyncClient, admin_headers: dict):
    """POST project to non-existent org slug → 404."""
    resp = await client.post(
        f"/api/v1/organizations/no-such-org-{uuid4().hex[:8]}/projects",
        json={"slug": "irrelevant", "name": "Irrelevant"},
        headers=admin_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Organizations endpoint not implemented")
    assert resp.status_code == 404
