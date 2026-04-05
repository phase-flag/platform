"""Notification configuration endpoints (Slack / Teams)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.models.notifications import NotificationConfigDB
from phaseflag_api.services import notification_service

router = APIRouter(prefix="/notifications", dependencies=[Depends(require_api_key)])

_VALID_PROVIDERS = {"slack", "teams"}
_VALID_EVENTS = list(notification_service.VALID_EVENTS)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class NotificationConfigIn(BaseModel):
    project_id: str = Field(..., examples=["default"])
    webhook_url: str = Field(..., examples=["https://hooks.slack.com/services/xxx/yyy/zzz"])
    events: list[str] = Field(
        default_factory=lambda: list(notification_service.VALID_EVENTS),
        examples=[["flag.created", "flag.toggled", "flag.archived"]],
    )

    @field_validator("events")
    @classmethod
    def validate_events(cls, v: list[str]) -> list[str]:
        invalid = set(v) - notification_service.VALID_EVENTS
        if invalid:
            raise ValueError(f"Invalid event types: {sorted(invalid)}. Valid: {sorted(notification_service.VALID_EVENTS)}")
        return v


class NotificationConfigOut(BaseModel):
    id: str
    project_id: str
    provider: str
    webhook_url: str
    events: list[str]
    created_at: str


class TestNotificationIn(BaseModel):
    notification_config_id: str | None = None
    provider: str | None = None
    webhook_url: str | None = None
    event_type: str = Field(default="flag.toggled")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_out(cfg: NotificationConfigDB) -> NotificationConfigOut:
    return NotificationConfigOut(
        id=cfg.id,
        project_id=cfg.project_id,
        provider=cfg.provider,
        webhook_url=cfg.webhook_url,
        events=cfg.get_events(),
        created_at=cfg.created_at.isoformat(),
    )


async def _get_or_404(session: AsyncSession, config_id: str) -> NotificationConfigDB:
    result = await session.execute(
        select(NotificationConfigDB).where(NotificationConfigDB.id == config_id)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification config not found")
    return cfg


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/slack",
    response_model=NotificationConfigOut,
    status_code=status.HTTP_201_CREATED,
    summary="Configure Slack webhook",
    tags=["notifications"],
    dependencies=[require_role("editor")],
)
async def configure_slack(
    body: NotificationConfigIn,
    session: AsyncSession = Depends(get_session),
) -> NotificationConfigOut:
    """Register a Slack incoming webhook URL for a project.

    Events will be delivered as Slack Block Kit messages to the provided URL.
    """
    cfg = NotificationConfigDB(
        project_id=body.project_id,
        provider="slack",
        webhook_url=body.webhook_url,
    )
    cfg.set_events(body.events)
    session.add(cfg)
    await session.flush()
    return _to_out(cfg)


@router.post(
    "/teams",
    response_model=NotificationConfigOut,
    status_code=status.HTTP_201_CREATED,
    summary="Configure Microsoft Teams webhook",
    tags=["notifications"],
    dependencies=[require_role("editor")],
)
async def configure_teams(
    body: NotificationConfigIn,
    session: AsyncSession = Depends(get_session),
) -> NotificationConfigOut:
    """Register a Microsoft Teams incoming webhook URL for a project.

    Events will be delivered as Teams Adaptive Card messages.
    """
    cfg = NotificationConfigDB(
        project_id=body.project_id,
        provider="teams",
        webhook_url=body.webhook_url,
    )
    cfg.set_events(body.events)
    session.add(cfg)
    await session.flush()
    return _to_out(cfg)


@router.get(
    "/config",
    response_model=list[NotificationConfigOut],
    summary="Get notification configs",
    tags=["notifications"],
)
async def get_notification_config(
    project_id: str = Query("default"),
    session: AsyncSession = Depends(get_session),
) -> list[NotificationConfigOut]:
    """Return all notification channel configs for a project."""
    result = await session.execute(
        select(NotificationConfigDB)
        .where(NotificationConfigDB.project_id == project_id)
        .order_by(NotificationConfigDB.created_at.desc())
    )
    return [_to_out(cfg) for cfg in result.scalars().all()]


@router.post(
    "/test",
    status_code=status.HTTP_200_OK,
    summary="Send test notification",
    tags=["notifications"],
    dependencies=[require_role("editor")],
)
async def test_notification(
    body: TestNotificationIn,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Send a test notification to verify webhook connectivity.

    Either supply an existing `notification_config_id` to test a saved config,
    or provide `provider` + `webhook_url` to test an ad-hoc URL.
    """
    _test_flag_data = {
        "key": "test-flag",
        "name": "Test Feature Flag",
        "status": "active",
        "environment": "production",
        "flag_type": "boolean",
    }
    actor = "test-user"
    event_type = body.event_type

    if body.notification_config_id:
        cfg = await _get_or_404(session, body.notification_config_id)
        provider = cfg.provider
        webhook_url = cfg.webhook_url
    elif body.provider and body.webhook_url:
        if body.provider not in _VALID_PROVIDERS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid provider '{body.provider}'. Valid: {sorted(_VALID_PROVIDERS)}",
            )
        provider = body.provider
        webhook_url = body.webhook_url
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either 'notification_config_id' or both 'provider' and 'webhook_url'.",
        )

    if provider == "slack":
        await notification_service.send_slack_notification(webhook_url, event_type, _test_flag_data, actor)
    elif provider == "teams":
        await notification_service.send_teams_notification(webhook_url, event_type, _test_flag_data, actor)

    return {"status": "ok", "message": f"Test {provider} notification sent for event '{event_type}'."}


@router.delete(
    "/{config_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove notification config",
    tags=["notifications"],
    dependencies=[require_role("admin")],
)
async def delete_notification_config(
    config_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Remove a notification channel config by ID."""
    cfg = await _get_or_404(session, config_id)
    await session.delete(cfg)
    await session.flush()
