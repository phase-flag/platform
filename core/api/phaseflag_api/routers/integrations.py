"""Webhook marketplace integrations — CRUD + test endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.models.integrations import IntegrationConfigDB

router = APIRouter(prefix="/integrations", dependencies=[Depends(require_api_key)])

# ---------------------------------------------------------------------------
# Marketplace metadata — static list of available integration providers
# ---------------------------------------------------------------------------

_MARKETPLACE: list[dict[str, Any]] = [
    {
        "provider": "datadog",
        "name": "Datadog",
        "description": "Send Phase Flag events as Datadog custom events with tags and alert types.",
        "logo_url": "https://imgix.datadoghq.com/img/about/presskit/logo-v/dd_vertical_purple.png",
        "docs_url": "https://docs.datadoghq.com/api/latest/events/",
        "supported_events": [
            "flag.created",
            "flag.updated",
            "flag.toggled",
            "flag.archived",
            "flag.deleted",
            "flag.rollback",
        ],
        "config_schema": {
            "site": {"type": "string", "description": "Datadog site (default: datadoghq.com)", "required": False},
            "tags": {"type": "array", "description": "Extra tags to attach to events", "required": False},
        },
    },
    {
        "provider": "pagerduty",
        "name": "PagerDuty",
        "description": "Create PagerDuty incidents when rollbacks or critical flag changes occur.",
        "logo_url": "https://www.pagerduty.com/wp-content/uploads/2020/01/pd-logo-green.png",
        "docs_url": "https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview",
        "supported_events": [
            "flag.rollback",
            "flag.archived",
            "flag.deleted",
        ],
        "config_schema": {
            "component": {"type": "string", "description": "PagerDuty component name", "required": False},
            "group": {"type": "string", "description": "PagerDuty group name", "required": False},
            "dashboard_url": {"type": "string", "description": "Link to Phase Flag dashboard", "required": False},
        },
    },
    {
        "provider": "jira",
        "name": "Jira",
        "description": "Auto-create Jira tickets for stale feature flags requiring cleanup.",
        "logo_url": "https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon.png",
        "docs_url": "https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/",
        "supported_events": [
            "flag.stale",
            "flag.archived",
            "flag.lifecycle.stale",
        ],
        "config_schema": {
            "site": {"type": "string", "description": "Atlassian site (e.g. mycompany.atlassian.net)", "required": True},
            "email": {"type": "string", "description": "Atlassian account email", "required": True},
            "project_key": {"type": "string", "description": "Jira project key (e.g. TECH)", "required": True},
            "issue_type": {"type": "string", "description": "Issue type (default: Task)", "required": False},
            "priority": {"type": "string", "description": "Priority (default: Medium)", "required": False},
            "labels": {"type": "array", "description": "Labels to attach to the issue", "required": False},
            "assignee_account_id": {"type": "string", "description": "Jira accountId of assignee", "required": False},
        },
    },
]

_PROVIDER_SET = {p["provider"] for p in _MARKETPLACE}


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class IntegrationSetupInput(BaseModel):
    provider: str = Field(..., examples=["datadog"])
    api_key: str = Field(..., examples=["dd_api_key_xxx"])
    config: dict[str, Any] = Field(default={}, examples=[{"site": "datadoghq.com"}])
    events: list[str] = Field(default=[], examples=[["flag.created", "flag.toggled"]])
    project_id: str | None = Field(None, examples=["proj-uuid-123"])


class IntegrationOut(BaseModel):
    id: str
    project_id: str | None
    provider: str
    events: list[str]
    config: dict[str, Any]
    enabled: bool
    created_at: str
    updated_at: str


def _to_out(integration: IntegrationConfigDB) -> IntegrationOut:
    return IntegrationOut(
        id=integration.id,
        project_id=integration.project_id,
        provider=integration.provider,
        events=integration.get_events(),
        config=integration.get_config(),
        enabled=integration.enabled,
        created_at=integration.created_at.isoformat(),
        updated_at=integration.updated_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/marketplace", summary="List available integrations in the marketplace")
async def list_marketplace() -> list[dict[str, Any]]:
    """Return the static catalog of available integration providers with metadata."""
    return _MARKETPLACE


@router.post(
    "/setup",
    response_model=IntegrationOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role("editor")],
    summary="Configure a new integration",
)
async def setup_integration(
    body: IntegrationSetupInput,
    session: AsyncSession = Depends(get_session),
) -> IntegrationOut:
    """Configure an integration provider for a project.

    Validates the provider exists in the marketplace, then persists the
    encrypted API key and provider-specific config.
    """
    if body.provider not in _PROVIDER_SET:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown provider '{body.provider}'. Available: {sorted(_PROVIDER_SET)}",
        )

    integration = IntegrationConfigDB(
        project_id=body.project_id,
        provider=body.provider,
        enabled=True,
    )
    integration.api_key = body.api_key  # encrypted via property setter
    integration.set_config(body.config)
    integration.set_events(body.events)

    session.add(integration)
    await session.flush()
    await session.refresh(integration)
    return _to_out(integration)


@router.get(
    "",
    response_model=list[IntegrationOut],
    summary="List configured integrations",
)
async def list_integrations(
    project_id: str | None = Query(None),
    provider: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> list[IntegrationOut]:
    """List all configured integrations, optionally filtered by project or provider."""
    stmt = select(IntegrationConfigDB).order_by(IntegrationConfigDB.created_at.desc()).limit(limit).offset(offset)
    if project_id:
        stmt = stmt.where(IntegrationConfigDB.project_id == project_id)
    if provider:
        stmt = stmt.where(IntegrationConfigDB.provider == provider)

    result = await session.execute(stmt)
    integrations = list(result.scalars().all())
    return [_to_out(i) for i in integrations]


@router.delete(
    "/{integration_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[require_role("admin")],
    summary="Remove an integration",
)
async def delete_integration(
    integration_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Permanently remove an integration configuration."""
    result = await session.execute(
        select(IntegrationConfigDB).where(IntegrationConfigDB.id == integration_id)
    )
    integration = result.scalar_one_or_none()
    if integration is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")
    await session.delete(integration)
    await session.flush()


@router.post(
    "/{integration_id}/test",
    summary="Send a test event to verify the integration",
)
async def test_integration(
    integration_id: str,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """Fire a synthetic test event through the configured integration.

    Returns success/failure status and provider-specific details.
    """
    result = await session.execute(
        select(IntegrationConfigDB).where(IntegrationConfigDB.id == integration_id)
    )
    integration = result.scalar_one_or_none()
    if integration is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")

    api_key = integration.api_key
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Integration has no API key configured",
        )

    config = integration.get_config()
    provider = integration.provider
    success = False
    error: str | None = None

    try:
        if provider == "datadog":
            from phaseflag_api.services.integrations.datadog import send_test_event

            success = await send_test_event(api_key=api_key, config=config)
        elif provider == "pagerduty":
            from phaseflag_api.services.integrations.pagerduty import send_test_event

            success = await send_test_event(api_key=api_key, config=config)
        elif provider == "jira":
            from phaseflag_api.services.integrations.jira import send_test_event

            success = await send_test_event(api_key=api_key, config=config)
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"No test event handler for provider '{provider}'",
            )
    except HTTPException:
        raise
    except Exception as exc:
        error = str(exc)

    return {
        "integration_id": integration_id,
        "provider": provider,
        "success": success,
        "error": error,
        "tested_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }
