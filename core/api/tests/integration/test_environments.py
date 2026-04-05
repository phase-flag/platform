"""Integration tests for environment CRUD, API key rotation, and cloning."""

from uuid import uuid4

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------


async def _create_org_and_project(client: AsyncClient, headers: dict) -> str:
    """Create an org and project; return the project_id."""
    org_slug = f"env-org-{uuid4().hex[:8]}"
    org_r = await client.post(
        "/api/v1/organizations",
        json={"slug": org_slug, "name": "Env Test Org"},
        headers=headers,
    )
    if org_r.status_code in (404, 501):
        pytest.skip("Organizations endpoint not implemented")
    assert org_r.status_code in (200, 201), f"Org creation failed: {org_r.text}"

    proj_slug = f"env-proj-{uuid4().hex[:8]}"
    proj_r = await client.post(
        f"/api/v1/organizations/{org_slug}/projects",
        json={"slug": proj_slug, "name": "Env Test Project"},
        headers=headers,
    )
    if proj_r.status_code in (404, 501):
        pytest.skip("Projects endpoint not implemented")
    assert proj_r.status_code in (200, 201), f"Project creation failed: {proj_r.text}"
    return proj_r.json()["id"]


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_environment(client: AsyncClient, admin_headers: dict):
    """POST /api/v1/projects/{id}/environments → 201 with env data."""
    project_id = await _create_org_and_project(client, admin_headers)

    env_slug = f"env-{uuid4().hex[:8]}"
    resp = await client.post(
        f"/api/v1/projects/{project_id}/environments",
        json={"slug": env_slug, "name": "Staging", "color": "#F59E0B"},
        headers=admin_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Environments endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["slug"] == env_slug
    assert "api_key" in data
    assert "id" in data


@pytest.mark.asyncio
async def test_list_environments(client: AsyncClient, admin_headers: dict):
    """Create 2 environments, list them → both appear."""
    project_id = await _create_org_and_project(client, admin_headers)

    slugs = []
    for i in range(2):
        slug = f"env-list-{uuid4().hex[:8]}"
        slugs.append(slug)
        r = await client.post(
            f"/api/v1/projects/{project_id}/environments",
            json={"slug": slug, "name": f"Env {i}"},
            headers=admin_headers,
        )
        if r.status_code in (404, 501):
            pytest.skip("Environments endpoint not implemented")

    list_resp = await client.get(f"/api/v1/projects/{project_id}/environments", headers=admin_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Environments list endpoint not implemented")
    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data.get("items", data) if isinstance(data, dict) else data
    found_slugs = [e["slug"] for e in items]
    for s in slugs:
        assert s in found_slugs


@pytest.mark.asyncio
async def test_update_environment(client: AsyncClient, admin_headers: dict):
    """Update environment name and color → changes reflected."""
    project_id = await _create_org_and_project(client, admin_headers)
    env_slug = f"env-upd-{uuid4().hex[:8]}"
    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/environments",
        json={"slug": env_slug, "name": "Old Name"},
        headers=admin_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Environments endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    env_id = create_resp.json()["id"]

    update_resp = await client.put(
        f"/api/v1/environments/{env_id}",
        json={"name": "New Name", "color": "#10B981"},
        headers=admin_headers,
    )
    if update_resp.status_code in (404, 501):
        pytest.skip("Environments update endpoint not implemented")
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["name"] == "New Name"
    assert data["color"] == "#10B981"


@pytest.mark.asyncio
async def test_rotate_api_key(client: AsyncClient, admin_headers: dict):
    """Rotate environment API key → new key differs from old key."""
    project_id = await _create_org_and_project(client, admin_headers)
    env_slug = f"env-rot-{uuid4().hex[:8]}"
    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/environments",
        json={"slug": env_slug, "name": "Rotate Env"},
        headers=admin_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Environments endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    env_id = create_resp.json()["id"]
    old_key = create_resp.json()["api_key"]

    rotate_resp = await client.post(f"/api/v1/environments/{env_id}/rotate-key", headers=admin_headers)
    if rotate_resp.status_code in (404, 501):
        pytest.skip("rotate-key endpoint not implemented")
    assert rotate_resp.status_code == 200
    new_key = rotate_resp.json()["api_key"]
    assert new_key != old_key


@pytest.mark.asyncio
async def test_clone_environment(client: AsyncClient, admin_headers: dict):
    """Clone an environment → cloned env has different id but same project."""
    project_id = await _create_org_and_project(client, admin_headers)
    env_slug = f"env-src-{uuid4().hex[:8]}"
    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/environments",
        json={"slug": env_slug, "name": "Source Env"},
        headers=admin_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Environments endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    env_id = create_resp.json()["id"]

    clone_slug = f"env-clone-{uuid4().hex[:8]}"
    clone_resp = await client.post(
        f"/api/v1/environments/{env_id}/clone",
        json={"new_slug": clone_slug, "new_name": "Cloned Env"},
        headers=admin_headers,
    )
    if clone_resp.status_code in (404, 501):
        pytest.skip("Clone environment endpoint not implemented")
    assert clone_resp.status_code in (200, 201)
    cloned = clone_resp.json()
    assert cloned["slug"] == clone_slug
    assert cloned["id"] != env_id


@pytest.mark.asyncio
async def test_freeze_and_unfreeze_environment(client: AsyncClient, admin_headers: dict):
    """Freeze an env then unfreeze → frozen field reflects state."""
    project_id = await _create_org_and_project(client, admin_headers)
    env_slug = f"env-freeze-{uuid4().hex[:8]}"
    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/environments",
        json={"slug": env_slug, "name": "Freeze Env"},
        headers=admin_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Environments endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    env_id = create_resp.json()["id"]

    freeze_resp = await client.post(
        f"/api/v1/environments/{env_id}/freeze",
        json={"reason": "Release freeze for v2.0"},
        headers=admin_headers,
    )
    if freeze_resp.status_code in (404, 501):
        pytest.skip("Freeze endpoint not implemented")
    assert freeze_resp.status_code == 200
    assert freeze_resp.json()["frozen"] is True

    unfreeze_resp = await client.post(f"/api/v1/environments/{env_id}/unfreeze", headers=admin_headers)
    if unfreeze_resp.status_code in (404, 501):
        pytest.skip("Unfreeze endpoint not implemented")
    assert unfreeze_resp.status_code == 200
    assert unfreeze_resp.json()["frozen"] is False


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_nonexistent_environment_returns_404(client: AsyncClient, admin_headers: dict):
    """GET /api/v1/environments/{id} for bogus ID → 404."""
    resp = await client.get(f"/api/v1/environments/nonexistent-{uuid4().hex}", headers=admin_headers)
    if resp.status_code in (501,):
        pytest.skip("Environments endpoint not implemented")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_duplicate_env_slug_rejected(client: AsyncClient, admin_headers: dict):
    """Creating two environments with the same slug in same project → 409."""
    project_id = await _create_org_and_project(client, admin_headers)
    slug = f"dup-env-{uuid4().hex[:8]}"

    r1 = await client.post(
        f"/api/v1/projects/{project_id}/environments",
        json={"slug": slug, "name": "First"},
        headers=admin_headers,
    )
    if r1.status_code in (404, 501):
        pytest.skip("Environments endpoint not implemented")
    assert r1.status_code in (200, 201)

    r2 = await client.post(
        f"/api/v1/projects/{project_id}/environments",
        json={"slug": slug, "name": "Duplicate"},
        headers=admin_headers,
    )
    assert r2.status_code in (400, 409, 422)
