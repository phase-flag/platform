"""Datadog integration — transform Phase Flag events into Datadog custom events.

Reference: https://docs.datadoghq.com/api/latest/events/#post-an-event
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DATADOG_EVENTS_URL = "https://api.datadoghq.com/api/v1/events"

# Event types this integration handles
SUPPORTED_EVENTS = [
    "flag.created",
    "flag.updated",
    "flag.toggled",
    "flag.archived",
    "flag.deleted",
    "flag.rollback",
]


def build_datadog_event(event_type: str, flag_key: str, flag_data: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    """Transform a Phase Flag event payload into a Datadog event body.

    Args:
        event_type: The Phase Flag event type (e.g. "flag.toggled").
        flag_key: The flag's unique key.
        flag_data: Additional flag metadata dict.
        config: Provider-specific config (site, tags, etc.).

    Returns:
        A dict matching the Datadog POST /api/v1/events body schema.
    """
    status = flag_data.get("status", "unknown")
    environment = flag_data.get("environment", "unknown")
    owner = flag_data.get("owner", "system")

    # Map event type to Datadog alert type
    alert_type_map = {
        "flag.created": "info",
        "flag.updated": "info",
        "flag.toggled": "info",
        "flag.archived": "warning",
        "flag.deleted": "warning",
        "flag.rollback": "error",
    }
    alert_type = alert_type_map.get(event_type, "info")

    base_tags = [
        f"flag:{flag_key}",
        f"environment:{environment}",
        f"event_type:{event_type}",
        f"owner:{owner}",
        "source:phaseflag",
    ]
    extra_tags = config.get("tags", [])
    all_tags = base_tags + extra_tags

    return {
        "title": f"[Phase Flag] {event_type}: {flag_key}",
        "text": (
            f"%%% \n"
            f"**Flag**: `{flag_key}`  \n"
            f"**Event**: `{event_type}`  \n"
            f"**Status**: `{status}`  \n"
            f"**Environment**: `{environment}`  \n"
            f"**Owner**: `{owner}`  \n"
            f"**Timestamp**: `{datetime.utcnow().isoformat()}`  \n"
            f"\n %%%"
        ),
        "alert_type": alert_type,
        "source_type_name": "phaseflag",
        "tags": all_tags,
    }


async def send_event(
    api_key: str,
    event_type: str,
    flag_key: str,
    flag_data: dict[str, Any],
    config: dict[str, Any] | None = None,
) -> bool:
    """POST a custom event to the Datadog Events API.

    Args:
        api_key: Datadog API key (DD-API-KEY header).
        event_type: Phase Flag event type string.
        flag_key: The flag key that triggered the event.
        flag_data: Flag metadata.
        config: Optional provider config (site override, extra tags, etc.).

    Returns:
        True on success (HTTP 202), False otherwise.
    """
    cfg = config or {}
    site = cfg.get("site", "datadoghq.com")
    url = DATADOG_EVENTS_URL.replace("datadoghq.com", site)

    payload = build_datadog_event(event_type, flag_key, flag_data, cfg)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={
                    "DD-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
            )
            if resp.status_code in (200, 202):
                logger.info("Datadog event sent for %s/%s", event_type, flag_key)
                return True
            logger.warning(
                "Datadog event rejected: status=%s body=%s",
                resp.status_code,
                resp.text[:200],
            )
            return False
    except Exception:
        logger.exception("Failed to send Datadog event for %s/%s", event_type, flag_key)
        return False


async def send_test_event(api_key: str, config: dict[str, Any] | None = None) -> bool:
    """Send a synthetic test event to verify the Datadog integration."""
    return await send_event(
        api_key=api_key,
        event_type="flag.updated",
        flag_key="test-flag",
        flag_data={"status": "active", "environment": "development", "owner": "system"},
        config=config,
    )
