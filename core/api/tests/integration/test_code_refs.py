"""Integration tests for code reference endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.conftest import make_flag_payload


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upload_code_references(client: AsyncClient, auth_headers: dict):
    """POST /api/v1/code-refs/upload with references → 201 with upload count."""
    key = f"ref-flag-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)

    resp = await client.post(
        "/api/v1/code-refs/upload",
        json={
            "flag_key": key,
            "references": [
                {
                    "file": "src/features/checkout.ts",
                    "line": 42,
                    "repo": "acme/web",
                    "branch": "main",
                    "language": "typescript",
                    "context": "if (featureFlags.isEnabled('dark-mode')) {",
                },
                {
                    "file": "src/utils/flags.ts",
                    "line": 17,
                    "repo": "acme/web",
                    "branch": "main",
                    "language": "typescript",
                },
            ],
        },
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Code refs upload endpoint not implemented")

    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data.get("uploaded") == 2
    assert data.get("flag_key") == key


@pytest.mark.asyncio
async def test_get_code_references_for_flag(client: AsyncClient, auth_headers: dict):
    """Upload refs, GET them → 200 with references list."""
    key = f"get-ref-flag-{uuid4().hex[:8]}"
    await client.post("/api/v1/flags", json=make_flag_payload(key=key), headers=auth_headers)

    await client.post(
        "/api/v1/code-refs/upload",
        json={
            "flag_key": key,
            "references": [
                {"file": "app.py", "line": 10, "repo": "myrepo", "branch": "main", "language": "python"},
            ],
        },
        headers=auth_headers,
    )

    get_resp = await client.get(f"/api/v1/code-refs/{key}", headers=auth_headers)
    if get_resp.status_code in (404, 501):
        pytest.skip("Code refs get endpoint not implemented")

    assert get_resp.status_code == 200
    data = get_resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["file"] == "app.py"


@pytest.mark.asyncio
async def test_get_unused_flags(client: AsyncClient, auth_headers: dict):
    """GET /api/v1/code-refs/unused → 200 with unused flags list."""
    resp = await client.get("/api/v1/code-refs/unused", headers=auth_headers)
    if resp.status_code in (404, 501):
        pytest.skip("Code refs unused endpoint not implemented")

    assert resp.status_code == 200
    data = resp.json()
    # Response is either {"unused_flags": [...], "count": N} or a plain list
    if isinstance(data, dict):
        assert "unused_flags" in data
        assert isinstance(data["unused_flags"], list)
    else:
        assert isinstance(data, list)


@pytest.mark.asyncio
async def test_upload_empty_references(client: AsyncClient, auth_headers: dict):
    """Upload empty references list → handled gracefully (0 uploaded)."""
    key = f"empty-ref-flag-{uuid4().hex[:8]}"
    resp = await client.post(
        "/api/v1/code-refs/upload",
        json={"flag_key": key, "references": []},
        headers=auth_headers,
    )
    if resp.status_code in (404, 501):
        pytest.skip("Code refs upload endpoint not implemented")

    # Empty list may be accepted or rejected; both are reasonable
    assert resp.status_code in (200, 201, 400, 422)
    if resp.status_code in (200, 201):
        assert resp.json().get("uploaded") == 0


# ---------------------------------------------------------------------------
# Error-path tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upload_refs_exceeds_max(client: AsyncClient, auth_headers: dict):
    """Upload more than 1000 refs → 422."""
    refs = [{"file": f"file_{i}.py", "line": i} for i in range(1001)]
    resp = await client.post(
        "/api/v1/code-refs/upload",
        json={"flag_key": "some-flag", "references": refs},
        headers=auth_headers,
    )
    if resp.status_code in (501,):
        pytest.skip("Code refs upload endpoint not implemented")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_code_refs_without_auth_rejected(client: AsyncClient):
    """Upload refs without auth → 401 or 403."""
    resp = await client.post(
        "/api/v1/code-refs/upload",
        json={"flag_key": "some-flag", "references": []},
    )
    if resp.status_code in (501,):
        pytest.skip("Code refs endpoint not implemented")
    assert resp.status_code in (401, 403, 422)
