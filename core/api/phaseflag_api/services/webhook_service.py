"""Webhook dispatch service: fires webhooks asynchronously on flag events."""

import asyncio
import hashlib
import hmac
import ipaddress
import json
import logging
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.webhooks import WebhookDB

MAX_RETRIES = 3
RETRY_DELAYS = [1, 5, 15]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SSRF protection: block requests to private/internal networks
# ---------------------------------------------------------------------------

_BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),  # Loopback
    ipaddress.ip_network("10.0.0.0/8"),  # Private A
    ipaddress.ip_network("172.16.0.0/12"),  # Private B
    ipaddress.ip_network("192.168.0.0/16"),  # Private C
    ipaddress.ip_network("169.254.0.0/16"),  # Link-local / cloud metadata
    ipaddress.ip_network("::1/128"),  # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),  # IPv6 unique-local
    ipaddress.ip_network("fe80::/10"),  # IPv6 link-local
]

_BLOCKED_HOSTNAMES = {"localhost", "metadata.google.internal"}


def _validate_webhook_url(url: str) -> None:
    """Validate a webhook URL is safe to request (not targeting internal services).

    Raises ValueError if the URL targets a private/internal network.
    """
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Webhook URL must use http or https scheme, got '{parsed.scheme}'")

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        raise ValueError("Webhook URL has no hostname")

    if hostname in _BLOCKED_HOSTNAMES:
        raise ValueError(f"Webhook URL hostname '{hostname}' is blocked")

    try:
        addr = ipaddress.ip_address(hostname)
        for net in _BLOCKED_NETWORKS:
            if addr in net:
                raise ValueError(f"Webhook URL resolves to blocked network {net}")
    except ValueError as exc:
        if "blocked" in str(exc):
            raise
        # hostname is not an IP literal — that's fine, DNS will resolve later


async def list_webhooks(
    session: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[WebhookDB], int]:
    base = select(WebhookDB)
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await session.execute(count_stmt)).scalar() or 0

    items_stmt = base.order_by(WebhookDB.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(items_stmt)
    return list(result.scalars().all()), total


async def create_webhook(session: AsyncSession, url: str, events: list[str], secret: str) -> WebhookDB:
    _validate_webhook_url(url)
    webhook = WebhookDB(url=url, secret=secret)
    webhook.set_events(events)
    session.add(webhook)
    await session.flush()
    return webhook


async def delete_webhook(session: AsyncSession, webhook: WebhookDB) -> None:
    await session.delete(webhook)
    await session.flush()


async def get_webhook(session: AsyncSession, webhook_id: str) -> WebhookDB | None:
    result = await session.execute(select(WebhookDB).where(WebhookDB.id == webhook_id))
    return result.scalar_one_or_none()


async def update_webhook(
    session: AsyncSession,
    webhook: WebhookDB,
    data: dict[str, Any],
) -> WebhookDB:
    if "url" in data:
        _validate_webhook_url(data["url"])
        webhook.url = data["url"]
    if "events" in data:
        webhook.set_events(data["events"])
    if "active" in data:
        webhook.active = data["active"]
    await session.flush()
    await session.refresh(webhook)
    return webhook


async def fire_webhooks(session: AsyncSession, event_type: str, flag_key: str, flag_data: dict[str, Any]) -> None:
    """Fire all matching active webhooks asynchronously."""
    result = await session.execute(
        select(WebhookDB).where(WebhookDB.active == True).order_by(WebhookDB.created_at.desc())  # noqa: E712
    )
    all_webhooks = list(result.scalars().all())
    active = [w for w in all_webhooks if event_type in w.get_events()]

    if not active:
        return

    payload = json.dumps(
        {
            "event_type": event_type,
            "flag_key": flag_key,
            "flag_data": flag_data,
            "timestamp": datetime.now(UTC).isoformat(),
        }
    )

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
        for webhook in active:
            try:
                _validate_webhook_url(webhook.url)
            except ValueError:
                logger.warning("Skipping webhook %s: blocked URL", webhook.url)
                continue
            signature = hmac.new(
                webhook.secret.encode(),
                payload.encode(),
                hashlib.sha256,
            ).hexdigest()

            delivered = False
            for attempt in range(MAX_RETRIES):
                try:
                    resp = await client.post(
                        webhook.url,
                        content=payload,
                        headers={
                            "Content-Type": "application/json",
                            "X-PhaseFlag-Signature": signature,
                            "X-PhaseFlag-Delivery-Attempt": str(attempt + 1),
                        },
                    )
                    if resp.status_code < 500:
                        delivered = True
                        break
                    logger.warning(
                        "Webhook %s returned %s (attempt %d/%d)",
                        webhook.url,
                        resp.status_code,
                        attempt + 1,
                        MAX_RETRIES,
                    )
                except Exception:
                    logger.warning(
                        "Webhook delivery failed to %s (attempt %d/%d)",
                        webhook.url,
                        attempt + 1,
                        MAX_RETRIES,
                        exc_info=True,
                    )

                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_DELAYS[attempt])

            if not delivered:
                logger.error(
                    "Webhook delivery permanently failed for %s after %d attempts",
                    webhook.url,
                    MAX_RETRIES,
                )
