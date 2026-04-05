"""Billing service — tier limits and Stripe webhook processing.

Tier definitions
----------------
FREE:       10 flags, 1 project, 1 000 monthly tracked users (MTU)
PRO:        unlimited flags, 10 projects, 50 000 MTU
ENTERPRISE: unlimited flags, unlimited projects, unlimited MTU
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.flags import FeatureFlagDB
from phaseflag_api.models.projects import OrganizationDB, ProjectDB

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tier limit definitions
# ---------------------------------------------------------------------------

UNLIMITED = -1  # sentinel: no limit enforced


@dataclass(frozen=True)
class TierLimits:
    max_flags: int     # -1 = unlimited
    max_projects: int  # -1 = unlimited
    max_mtu: int       # -1 = unlimited


TIER_LIMITS: dict[str, TierLimits] = {
    "free": TierLimits(
        max_flags=10,
        max_projects=1,
        max_mtu=1_000,
    ),
    "pro": TierLimits(
        max_flags=UNLIMITED,
        max_projects=10,
        max_mtu=50_000,
    ),
    "enterprise": TierLimits(
        max_flags=UNLIMITED,
        max_projects=UNLIMITED,
        max_mtu=UNLIMITED,
    ),
}

# Fallback for unknown/unrecognised tier strings — treat as free
_DEFAULT_LIMITS = TIER_LIMITS["free"]


def get_tier_limits(tier: str) -> TierLimits:
    """Return the TierLimits for a subscription tier slug."""
    return TIER_LIMITS.get(tier.lower(), _DEFAULT_LIMITS)


# ---------------------------------------------------------------------------
# Count helpers
# ---------------------------------------------------------------------------


async def _count_flags(session: AsyncSession) -> int:
    """Count non-archived flags across all environments."""
    result = await session.execute(
        select(func.count()).where(FeatureFlagDB.status != "archived")
    )
    return result.scalar() or 0


async def _count_projects(session: AsyncSession, org_id: str) -> int:
    """Count projects belonging to an organization."""
    result = await session.execute(
        select(func.count()).where(ProjectDB.organization_id == org_id)
    )
    return result.scalar() or 0


async def _get_org(session: AsyncSession, org_id: str | None) -> OrganizationDB | None:
    """Fetch an organization by ID.

    Returns None if org_id is None or the org does not exist (caller decides
    whether to raise or skip the limit check).
    """
    if not org_id:
        return None
    return await session.get(OrganizationDB, org_id)


# ---------------------------------------------------------------------------
# Public limit-checking API
# ---------------------------------------------------------------------------


async def check_flag_limit(session: AsyncSession, org_id: str | None = None) -> bool:
    """Return True if the organization (or default org) may create another flag.

    Raises HTTPException 402 if the tier limit is exceeded.
    If org_id is None or the org cannot be found, the check is skipped
    (permissive — appropriate for OSS single-tenant mode).
    """
    org = await _get_org(session, org_id)
    if org is None:
        return True  # no org context — skip limit enforcement

    limits = get_tier_limits(org.subscription_tier)

    if limits.max_flags == UNLIMITED:
        return True

    current_count = await _count_flags(session)
    if current_count >= limits.max_flags:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Flag limit reached for '{org.subscription_tier}' tier "
                f"({current_count}/{limits.max_flags}). "
                "Upgrade your plan to create more flags."
            ),
        )
    return True


async def check_project_limit(session: AsyncSession, org_id: str) -> bool:
    """Return True if the organization may create another project.

    Raises HTTPException 402 if the tier limit is exceeded.
    """
    org = await _get_org(session, org_id)
    if org is None:
        return True  # no org context — skip limit enforcement

    limits = get_tier_limits(org.subscription_tier)

    if limits.max_projects == UNLIMITED:
        return True

    current_count = await _count_projects(session, org_id)
    if current_count >= limits.max_projects:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Project limit reached for '{org.subscription_tier}' tier "
                f"({current_count}/{limits.max_projects}). "
                "Upgrade your plan to create more projects."
            ),
        )
    return True


# ---------------------------------------------------------------------------
# Stripe webhook processing
# ---------------------------------------------------------------------------

# Map Stripe subscription statuses that count as "active"
_ACTIVE_STATUSES = {"active", "trialing"}

# Map Stripe product/price metadata plan IDs to our internal tier slugs
# These are set via metadata on the Stripe Price/Subscription object.
_PLAN_ID_TO_TIER: dict[str, str] = {
    "free": "free",
    "pro": "pro",
    "enterprise": "enterprise",
}


async def handle_subscription_webhook(
    event: dict[str, Any],
    session: AsyncSession,
) -> dict[str, Any]:
    """Process a Stripe webhook event and update the org's subscription tier.

    Supported event types:
    - checkout.session.completed
    - customer.subscription.created
    - customer.subscription.updated
    - customer.subscription.deleted
    - invoice.payment_failed

    Returns a dict summarising what was done.
    """
    event_type: str = event.get("type", "")
    event_data: dict[str, Any] = event.get("data", {})
    obj: dict[str, Any] = event_data.get("object", {})
    metadata: dict[str, str] = obj.get("metadata", {})

    logger.info("Processing Stripe webhook: %s", event_type)

    if event_type == "checkout.session.completed":
        org_id = metadata.get("org_id")
        plan_id = metadata.get("plan_id")
        if not org_id or not plan_id:
            logger.warning("checkout.session.completed missing org_id/plan_id in metadata")
            return {"processed": False, "reason": "missing_metadata"}

        tier = _PLAN_ID_TO_TIER.get(plan_id, "free")
        await _update_org_tier(session, org_id, tier)
        logger.info("Org %s upgraded to tier '%s' via checkout", org_id, tier)
        return {"processed": True, "org_id": org_id, "tier": tier}

    if event_type in ("customer.subscription.created", "customer.subscription.updated"):
        org_id = metadata.get("org_id")
        if not org_id:
            logger.warning("%s missing org_id in subscription metadata", event_type)
            return {"processed": False, "reason": "missing_metadata"}

        sub_status: str = obj.get("status", "")
        plan_id = metadata.get("plan_id", "free")
        if sub_status in _ACTIVE_STATUSES:
            tier = _PLAN_ID_TO_TIER.get(plan_id, "free")
        else:
            # Unpaid, cancelled, incomplete, etc. → downgrade to free
            tier = "free"

        await _update_org_tier(session, org_id, tier)
        logger.info(
            "Org %s subscription %s → tier '%s' (status: %s)",
            org_id, event_type, tier, sub_status,
        )
        return {"processed": True, "org_id": org_id, "tier": tier}

    if event_type == "customer.subscription.deleted":
        org_id = metadata.get("org_id")
        if not org_id:
            return {"processed": False, "reason": "missing_metadata"}

        await _update_org_tier(session, org_id, "free")
        logger.info("Org %s subscription cancelled → downgraded to free", org_id)
        return {"processed": True, "org_id": org_id, "tier": "free"}

    if event_type == "invoice.payment_failed":
        # Optionally notify — do not immediately downgrade (Stripe retries first).
        org_id = metadata.get("org_id")
        logger.warning("Payment failed for org %s — Stripe will retry.", org_id)
        return {"processed": True, "action": "payment_failed_logged"}

    logger.debug("Unhandled Stripe event type: %s — ignoring", event_type)
    return {"processed": False, "reason": "unhandled_event_type"}


async def _update_org_tier(session: AsyncSession, org_id: str, tier: str) -> None:
    """Persist a subscription tier change on the organization row."""
    await session.execute(
        update(OrganizationDB)
        .where(OrganizationDB.id == org_id)
        .values(subscription_tier=tier)
    )
    await session.commit()
