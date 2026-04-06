"""PagerDuty integration — create incidents when a Phase Flag rollback is triggered.

Reference: https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview
POST https://events.pagerduty.com/v2/enqueue
"""

from __future__ import annotations

import logging
import socket
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

PAGERDUTY_EVENTS_URL = "https://events.pagerduty.com/v2/enqueue"

SUPPORTED_EVENTS = [
    "flag.rollback",
    "flag.archived",
    "flag.deleted",
]

_SEVERITY_MAP = {
    "flag.rollback": "critical",
    "flag.archived": "warning",
    "flag.deleted": "error",
}


def build_pagerduty_payload(
    routing_key: str,
    event_type: str,
    flag_key: str,
    flag_data: dict[str, Any],
    config: dict[str, Any],
) -> dict[str, Any]:
    """Build a PagerDuty Events API v2 payload.

    Args:
        routing_key: PagerDuty integration/routing key (service's events key).
        event_type: Phase Flag event type (e.g. "flag.rollback").
        flag_key: The flag key involved.
        flag_data: Flag metadata dictionary.
        config: Provider-specific config (component, group, class, etc.).

    Returns:
        Dict matching the PagerDuty Events v2 trigger body.
    """
    severity = _SEVERITY_MAP.get(event_type, "warning")
    environment = flag_data.get("environment", "unknown")
    status = flag_data.get("status", "unknown")

    dedup_key = f"phaseflag-{flag_key}-{event_type}"

    return {
        "routing_key": routing_key,
        "event_action": "trigger",
        "dedup_key": dedup_key,
        "payload": {
            "summary": f"[Phase Flag] {event_type}: flag '{flag_key}' in {environment}",
            "timestamp": datetime.utcnow().isoformat(),
            "severity": severity,
            "source": config.get("source", socket.gethostname()),
            "component": config.get("component", "feature-flags"),
            "group": config.get("group", environment),
            "class": config.get("class", event_type),
            "custom_details": {
                "flag_key": flag_key,
                "event_type": event_type,
                "status": status,
                "environment": environment,
                "owner": flag_data.get("owner", "system"),
                "flag_type": flag_data.get("flag_type", "unknown"),
            },
        },
        "links": [
            {
                "href": config.get("dashboard_url", f"https://app.phaseflag.com/flags/{flag_key}"),
                "text": "View Flag in Phase Flag Dashboard",
            }
        ],
    }


async def send_event(
    api_key: str,
    event_type: str,
    flag_key: str,
    flag_data: dict[str, Any],
    config: dict[str, Any] | None = None,
) -> bool:
    """Enqueue a PagerDuty incident via the Events API v2.

    Args:
        api_key: PagerDuty routing/integration key.
        event_type: Phase Flag event type (should be "flag.rollback" for incidents).
        flag_key: Flag key that triggered the event.
        flag_data: Flag metadata.
        config: Optional provider config.

    Returns:
        True on HTTP 202, False otherwise.
    """
    cfg = config or {}
    payload = build_pagerduty_payload(api_key, event_type, flag_key, flag_data, cfg)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                PAGERDUTY_EVENTS_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code == 202:
                logger.info("PagerDuty incident enqueued for %s/%s", event_type, flag_key)
                return True
            logger.warning(
                "PagerDuty rejected event: status=%s body=%s",
                resp.status_code,
                resp.text[:200],
            )
            return False
    except Exception:
        logger.exception("Failed to enqueue PagerDuty incident for %s/%s", event_type, flag_key)
        return False


async def send_test_event(api_key: str, config: dict[str, Any] | None = None) -> bool:
    """Send a synthetic test incident to verify the PagerDuty integration."""
    return await send_event(
        api_key=api_key,
        event_type="flag.rollback",
        flag_key="test-flag",
        flag_data={"status": "inactive", "environment": "development", "owner": "system"},
        config=config,
    )
