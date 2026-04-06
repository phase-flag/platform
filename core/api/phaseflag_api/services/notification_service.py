"""Slack and Microsoft Teams notification service.

Sends rich-formatted messages to incoming webhook URLs when flag lifecycle
events occur.  Formatting follows:
  - Slack: Block Kit JSON (https://api.slack.com/block-kit)
  - Teams: Adaptive Card 1.4 JSON (https://adaptivecards.io)
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.notifications import NotificationConfigDB

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supported event types
# ---------------------------------------------------------------------------

VALID_EVENTS = frozenset(
    {
        "flag.created",
        "flag.toggled",
        "flag.archived",
        "approval.requested",
        "freeze.activated",
    }
)

# ---------------------------------------------------------------------------
# Message builders
# ---------------------------------------------------------------------------

_EVENT_EMOJI: dict[str, str] = {
    "flag.created": ":white_check_mark:",
    "flag.toggled": ":arrows_counterclockwise:",
    "flag.archived": ":file_cabinet:",
    "approval.requested": ":writing_hand:",
    "freeze.activated": ":snowflake:",
}

_EVENT_COLOR: dict[str, str] = {
    "flag.created": "#36a64f",
    "flag.toggled": "#2196F3",
    "flag.archived": "#9E9E9E",
    "approval.requested": "#FF9800",
    "freeze.activated": "#00BCD4",
}

DASHBOARD_URL = "https://app.phaseflag.com"


def _event_label(event_type: str) -> str:
    return event_type.replace(".", " ").title()


def _build_slack_blocks(
    event_type: str,
    flag_data: dict[str, Any],
    actor: str,
    timestamp: str,
) -> dict[str, Any]:
    """Build a Slack Block Kit message payload."""
    emoji = _EVENT_EMOJI.get(event_type, ":triangular_flag_on_post:")
    color = _EVENT_COLOR.get(event_type, "#607D8B")
    flag_key = flag_data.get("key", "unknown")
    flag_name = flag_data.get("name", flag_key)
    flag_env = flag_data.get("environment", "")
    flag_status = flag_data.get("status", "")
    dashboard_link = f"{DASHBOARD_URL}/flags/{flag_key}"
    label = _event_label(event_type)

    blocks: list[dict[str, Any]] = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{emoji}  Phase Flag — {label}",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Flag:*\n<{dashboard_link}|{flag_name}>"},
                {"type": "mrkdwn", "text": f"*Key:*\n`{flag_key}`"},
                {"type": "mrkdwn", "text": f"*Actor:*\n{actor}"},
                {"type": "mrkdwn", "text": f"*Environment:*\n{flag_env or 'N/A'}"},
            ],
        },
    ]

    if flag_status:
        blocks.append(
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Status:*\n`{flag_status}`"},
                    {"type": "mrkdwn", "text": f"*Timestamp:*\n{timestamp}"},
                ],
            }
        )

    blocks.append(
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "View in Dashboard", "emoji": True},
                    "url": dashboard_link,
                    "action_id": "view_flag",
                }
            ],
        }
    )

    blocks.append({"type": "divider"})

    return {
        "attachments": [
            {
                "color": color,
                "blocks": blocks,
            }
        ]
    }


def _build_teams_card(
    event_type: str,
    flag_data: dict[str, Any],
    actor: str,
    timestamp: str,
) -> dict[str, Any]:
    """Build a Microsoft Teams Adaptive Card payload."""
    color = _EVENT_COLOR.get(event_type, "#607D8B").lstrip("#")
    flag_key = flag_data.get("key", "unknown")
    flag_name = flag_data.get("name", flag_key)
    flag_env = flag_data.get("environment", "N/A")
    flag_status = flag_data.get("status", "N/A")
    dashboard_link = f"{DASHBOARD_URL}/flags/{flag_key}"
    label = _event_label(event_type)

    card = {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.4",
        "body": [
            {
                "type": "Container",
                "style": "emphasis",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": f"Phase Flag — {label}",
                        "weight": "Bolder",
                        "size": "Medium",
                        "color": "Accent",
                    }
                ],
            },
            {
                "type": "ColumnSet",
                "columns": [
                    {
                        "type": "Column",
                        "width": "stretch",
                        "items": [
                            {"type": "TextBlock", "text": "Flag", "weight": "Bolder", "size": "Small"},
                            {"type": "TextBlock", "text": flag_name, "spacing": "None"},
                            {"type": "TextBlock", "text": "Key", "weight": "Bolder", "size": "Small", "spacing": "Medium"},
                            {"type": "TextBlock", "text": flag_key, "spacing": "None", "fontType": "Monospace"},
                        ],
                    },
                    {
                        "type": "Column",
                        "width": "stretch",
                        "items": [
                            {"type": "TextBlock", "text": "Actor", "weight": "Bolder", "size": "Small"},
                            {"type": "TextBlock", "text": actor, "spacing": "None"},
                            {"type": "TextBlock", "text": "Environment", "weight": "Bolder", "size": "Small", "spacing": "Medium"},
                            {"type": "TextBlock", "text": flag_env, "spacing": "None"},
                        ],
                    },
                ],
            },
            {
                "type": "FactSet",
                "facts": [
                    {"title": "Status", "value": flag_status},
                    {"title": "Timestamp", "value": timestamp},
                ],
            },
        ],
        "actions": [
            {
                "type": "Action.OpenUrl",
                "title": "View in Dashboard",
                "url": dashboard_link,
            }
        ],
        "msteams": {"width": "Full"},
    }

    # Teams incoming webhooks expect a MessageCard or AdaptiveCard wrapper
    return {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "contentUrl": None,
                "content": card,
            }
        ],
    }


# ---------------------------------------------------------------------------
# Delivery helpers
# ---------------------------------------------------------------------------


async def _post_json(url: str, payload: dict[str, Any]) -> None:
    """POST a JSON payload to a webhook URL."""
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()


async def send_slack_notification(
    webhook_url: str,
    event_type: str,
    flag_data: dict[str, Any],
    actor: str,
) -> None:
    """Send a Slack Block Kit notification to the given incoming webhook URL."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    payload = _build_slack_blocks(event_type, flag_data, actor, timestamp)
    try:
        await _post_json(webhook_url, payload)
        logger.info("Slack notification sent for event '%s'", event_type)
    except Exception:
        logger.warning("Failed to send Slack notification for event '%s'", event_type, exc_info=True)


async def send_teams_notification(
    webhook_url: str,
    event_type: str,
    flag_data: dict[str, Any],
    actor: str,
) -> None:
    """Send a Teams Adaptive Card notification to the given incoming webhook URL."""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    payload = _build_teams_card(event_type, flag_data, actor, timestamp)
    try:
        await _post_json(webhook_url, payload)
        logger.info("Teams notification sent for event '%s'", event_type)
    except Exception:
        logger.warning("Failed to send Teams notification for event '%s'", event_type, exc_info=True)


# ---------------------------------------------------------------------------
# Fan-out: notify all matching configs for a given event
# ---------------------------------------------------------------------------


async def dispatch_notifications(
    session: AsyncSession,
    event_type: str,
    flag_data: dict[str, Any],
    actor: str,
    project_id: str = "default",
) -> None:
    """Look up notification configs for the project and fire matching ones."""
    result = await session.execute(
        select(NotificationConfigDB).where(NotificationConfigDB.project_id == project_id)
    )
    configs = list(result.scalars().all())

    for config in configs:
        if event_type not in config.get_events():
            continue

        if config.provider == "slack":
            await send_slack_notification(config.webhook_url, event_type, flag_data, actor)
        elif config.provider == "teams":
            await send_teams_notification(config.webhook_url, event_type, flag_data, actor)
        else:
            logger.warning("Unknown notification provider '%s' — skipping", config.provider)
