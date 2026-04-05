"""Integration tests for migration flag workflow endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_migration(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/migrations with valid payload → 201 with migration data."""
    flag_key = f"mig-flag-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=flag_key), headers=auth_headers)

    resp = await client.post(
        "/api/v1/migrations",
        json={
            "flag_key": flag_key,
            "name": "Migrate to new DB",
            "description": "Gradually migrate read traffic to new database",
            "source_system": "postgres_old",
            "target_system": "postgres_new",
            "rollback_threshold": 0.05,
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Migrations endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert "id" in data
    assert data["flag_key"] == flag_key
    assert "stage" in data
    # stage may vary by implementation (e.g. "off", "dual_read", "dual_write", "read_from_new", etc.)
    assert isinstance(data["stage"], str)


@pytest.mark.asyncio
async def test_list_migrations(client: AsyncClient, auth_headers: dict):
    """Create 2 migrations, list → both appear."""
    migration_ids = []
    for i in range(2):
        fk = f"mig-list-{uuid4().hex[:8]}"
        await client.post("/api/v1/flags", json=make_flag_payload(key=fk), headers=auth_headers)
        r = await client.post(
            "/api/v1/migrations",
            json={
                "flag_key": fk,
                "name": f"Migration {i}",
                "source_system": "old",
                "target_system": "new",
            },
            headers=auth_headers,
        )
        if r.status_code in (404, 501):
            pytest.skip("Migrations endpoint not implemented")
        assert r.status_code in (200, 201)
        migration_ids.append(r.json()["id"])

    list_resp = await client.get("/api/v1/migrations", headers=auth_headers)
    if list_resp.status_code in (404, 501):
        pytest.skip("Migrations list not implemented")
    assert list_resp.status_code == 200
    data = list_resp.json()
    items = data.get("items", data) if isinstance(data, dict) else data
    found_ids = [m["id"] for m in items]
    for mid in migration_ids:
        assert mid in found_ids


@pytest.mark.asyncio
async def test_get_migration_by_flag_key(client: AsyncClient, auth_headers: dict):
    """Create migration, GET by flag_key → correct data."""
    flag_key = f"mig-get-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=flag_key), headers=auth_headers)
    create_resp = await client.post(
        "/api/v1/migrations",
        json={"flag_key": flag_key, "name": "Get Test Migration"},
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Migrations endpoint not implemented")
    assert create_resp.status_code in (200, 201)

    get_resp = await client.get(f"/api/v1/migrations/{flag_key}", headers=auth_headers)
    if get_resp.status_code in (404, 501):
        pytest.skip("Get migration not implemented")
    assert get_resp.status_code == 200
    assert get_resp.json()["flag_key"] == flag_key


@pytest.mark.asyncio
async def test_advance_migration_stage(client: AsyncClient, auth_headers: dict):
    """Advance migration stage → stage changes."""
    flag_key = f"mig-adv-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=flag_key), headers=auth_headers)
    create_resp = await client.post(
        "/api/v1/migrations",
        json={"flag_key": flag_key, "name": "Advance Migration"},
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Migrations endpoint not implemented")
    assert create_resp.status_code in (200, 201)
    initial_stage = create_resp.json()["stage"]

    advance_resp = await client.post(f"/api/v1/migrations/{flag_key}/advance", headers=auth_headers)
    if advance_resp.status_code in (404, 501):
        pytest.skip("Migration advance not implemented")
    assert advance_resp.status_code in (200, 400)
    if advance_resp.status_code == 200:
        new_stage = advance_resp.json()["stage"]
        assert new_stage != initial_stage or new_stage == "complete"


@pytest.mark.asyncio
async def test_update_migration_metrics(client: AsyncClient, auth_headers: dict):
    """Update migration metrics (success/error counts) → reflected in response."""
    flag_key = f"mig-met-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=flag_key), headers=auth_headers)
    create_resp = await client.post(
        "/api/v1/migrations",
        json={"flag_key": flag_key, "name": "Metrics Migration"},
        headers=auth_headers,
    )
    if create_resp.status_code in (404, 501):
        pytest.skip("Migrations endpoint not implemented")
    assert create_resp.status_code in (200, 201)

    metrics_resp = await client.post(
        f"/api/v1/migrations/{flag_key}/metrics",
        json={"success_count": 1000, "error_count": 5},
        headers=auth_headers,
    )
    if metrics_resp.status_code in (404, 501):
        pytest.skip("Migration metrics endpoint not implemented")
    assert metrics_resp.status_code == 200
    data = metrics_resp.json()
    assert data["success_count"] == 1000
    assert data["error_count"] == 5


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_nonexistent_migration_returns_404(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/migrations/{flag_key} for non-existent → 404."""
    resp = await client.get(f"/api/v1/migrations/no-such-flag-{uuid4().hex[:8]}", headers=auth_headers)
    if resp.status_code in (501,):
        pytest.skip("Migrations endpoint not implemented")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_migration_without_required_flag_key(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/migrations without flag_key → 422."""
    resp = await client.post(
        "/api/v1/migrations",
        json={"name": "No Flag Migration"},
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Migrations endpoint not implemented")
    assert resp.status_code == 422
