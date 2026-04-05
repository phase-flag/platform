"""Jira integration — create Jira issues for stale Phase Flag flags.

Reference: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post
POST https://<site>.atlassian.net/rest/api/3/issue
"""

from __future__ import annotations

import base64
import logging
from datetime import UTC, datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

SUPPORTED_EVENTS = [
    "flag.stale",
    "flag.archived",
    "flag.lifecycle.stale",
]


def _jira_base_url(config: dict[str, Any]) -> str:
    """Build the Jira cloud base URL from config."""
    site = config.get("site", "")
    if not site:
        raise ValueError("Jira config must include 'site' (e.g. 'mycompany.atlassian.net')")
    return f"https://{site}/rest/api/3"


def _auth_header(config: dict[str, Any]) -> str:
    """Build HTTP Basic auth header value for Jira.

    Jira Cloud uses email:api_token encoded in Base64.
    """
    email = config.get("email", "")
    # api_token passed separately as api_key argument
    return ""  # populated in send_event where api_key is available


def _make_adf_paragraph(text: str) -> dict[str, Any]:
    """Wrap plain text into Atlassian Document Format (ADF) paragraph."""
    return {
        "type": "paragraph",
        "content": [{"type": "text", "text": text}],
    }


def build_jira_issue(
    event_type: str,
    flag_key: str,
    flag_data: dict[str, Any],
    config: dict[str, Any],
) -> dict[str, Any]:
    """Build a Jira issue creation body.

    Args:
        event_type: Phase Flag event type (e.g. "flag.stale").
        flag_key: The stale flag's key.
        flag_data: Flag metadata.
        config: Provider config — must include 'project_key', optionally 'issue_type',
                'priority', 'labels', 'assignee_account_id'.

    Returns:
        Dict matching the Jira REST API v3 issue creation body.
    """
    project_key = config.get("project_key", "TECH")
    issue_type = config.get("issue_type", "Task")
    priority = config.get("priority", "Medium")
    labels = config.get("labels", ["tech-debt", "feature-flag", "cleanup"])
    assignee_account_id = config.get("assignee_account_id")

    environment = flag_data.get("environment", "unknown")
    owner = flag_data.get("owner", "unknown")
    lifecycle_stage = flag_data.get("lifecycle_stage", "unknown")
    created_at = flag_data.get("created_at", "unknown")

    summary = f"[Phase Flag] Stale flag cleanup: {flag_key}"

    description_content = [
        _make_adf_paragraph(
            f"The feature flag '{flag_key}' has been detected as stale and should be cleaned up."
        ),
        _make_adf_paragraph(f"Flag Key: {flag_key}"),
        _make_adf_paragraph(f"Event: {event_type}"),
        _make_adf_paragraph(f"Environment: {environment}"),
        _make_adf_paragraph(f"Owner: {owner}"),
        _make_adf_paragraph(f"Lifecycle Stage: {lifecycle_stage}"),
        _make_adf_paragraph(f"Created At: {created_at}"),
        _make_adf_paragraph(f"Detected At: {datetime.now(UTC).isoformat()}"),
        _make_adf_paragraph(
            "Action Required: Review this flag in the Phase Flag dashboard and remove it "
            "from all codebases before archiving and deleting it."
        ),
    ]

    fields: dict[str, Any] = {
        "project": {"key": project_key},
        "summary": summary,
        "description": {
            "version": 1,
            "type": "doc",
            "content": description_content,
        },
        "issuetype": {"name": issue_type},
        "priority": {"name": priority},
        "labels": labels,
    }

    if assignee_account_id:
        fields["assignee"] = {"accountId": assignee_account_id}

    return {"fields": fields}


async def send_event(
    api_key: str,
    event_type: str,
    flag_key: str,
    flag_data: dict[str, Any],
    config: dict[str, Any] | None = None,
) -> bool:
    """Create a Jira issue via REST API v3.

    Args:
        api_key: Jira API token.
        event_type: Phase Flag event type (should be "flag.stale").
        flag_key: The stale flag's key.
        flag_data: Flag metadata.
        config: Provider config — must include 'site' and 'email'.

    Returns:
        True on successful issue creation (HTTP 201), False otherwise.
    """
    cfg = config or {}

    try:
        base_url = _jira_base_url(cfg)
    except ValueError as exc:
        logger.error("Jira config error: %s", exc)
        return False

    email = cfg.get("email", "")
    if not email:
        logger.error("Jira config must include 'email'")
        return False

    # Basic auth: base64(email:api_token)
    credentials = base64.b64encode(f"{email}:{api_key}".encode()).decode()
    issue_body = build_jira_issue(event_type, flag_key, flag_data, cfg)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{base_url}/issue",
                json=issue_body,
                headers={
                    "Authorization": f"Basic {credentials}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
            if resp.status_code == 201:
                data = resp.json()
                logger.info(
                    "Jira issue created for stale flag %s: %s",
                    flag_key,
                    data.get("key", "unknown"),
                )
                return True
            logger.warning(
                "Jira rejected issue creation: status=%s body=%s",
                resp.status_code,
                resp.text[:300],
            )
            return False
    except Exception:
        logger.exception("Failed to create Jira issue for flag %s", flag_key)
        return False


async def send_test_event(api_key: str, config: dict[str, Any] | None = None) -> bool:
    """Send a synthetic test Jira issue to verify the integration."""
    return await send_event(
        api_key=api_key,
        event_type="flag.stale",
        flag_key="test-flag",
        flag_data={
            "status": "inactive",
            "environment": "development",
            "owner": "system",
            "lifecycle_stage": "stale",
            "created_at": datetime.now(UTC).isoformat(),
        },
        config=config,
    )
