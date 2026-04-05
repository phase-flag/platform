"""Usage metering service — tracks Monthly Tracked Users (MTU) per organization.

Stores unique user keys seen during flag evaluations in a JSON set per org per month.
Enforces tier limits: free=1000 MTU, pro=50000, enterprise=unlimited.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.usage import UsageRecordDB

logger = logging.getLogger(__name__)

# Tier limits: number of unique users (MTU) allowed per calendar month.
# -1 means unlimited.
TIER_LIMITS: dict[str, int] = {
    "free": 1_000,
    "pro": 50_000,
    "enterprise": -1,
}

_DEFAULT_TIER = "free"


def _current_month() -> str:
    """Return the current month as a string key, e.g. '2026-04'."""
    now = datetime.now(UTC)
    return f"{now.year:04d}-{now.month:02d}"


async def _get_or_create_record(session: AsyncSession, org_id: str, month: str) -> UsageRecordDB:
    """Fetch or create the usage record for (org_id, month)."""
    stmt = select(UsageRecordDB).where(
        UsageRecordDB.org_id == org_id,
        UsageRecordDB.month == month,
    )
    result = await session.execute(stmt)
    record = result.scalar_one_or_none()
    if record is None:
        record = UsageRecordDB(org_id=org_id, month=month, unique_users="[]", count=0)
        session.add(record)
        await session.flush()
    return record


async def track_user(session: AsyncSession, org_id: str, user_key: str) -> None:
    """Record a unique user key for the current month.

    If the user key was already seen this month, this is a no-op (idempotent).
    Does NOT raise when a tier limit is exceeded — call check_limit separately
    if enforcement is needed before the evaluation.
    """
    if not user_key or not org_id:
        return

    month = _current_month()
    record = await _get_or_create_record(session, org_id, month)

    try:
        users: list[str] = json.loads(record.unique_users or "[]")
    except (json.JSONDecodeError, TypeError):
        users = []

    if user_key not in users:
        users.append(user_key)
        record.unique_users = json.dumps(users)
        record.count = len(users)


async def get_usage(session: AsyncSession, org_id: str) -> dict:
    """Return current MTU count and limit for an organization.

    Returns a dict with keys: org_id, month, mtu_count, mtu_limit, tier.
    """
    from phaseflag_api.models.projects import OrganizationDB

    org = await session.get(OrganizationDB, org_id)
    tier = (org.subscription_tier if org else None) or _DEFAULT_TIER

    month = _current_month()
    stmt = select(UsageRecordDB).where(
        UsageRecordDB.org_id == org_id,
        UsageRecordDB.month == month,
    )
    result = await session.execute(stmt)
    record = result.scalar_one_or_none()
    count = record.count if record else 0

    limit = TIER_LIMITS.get(tier, TIER_LIMITS[_DEFAULT_TIER])
    return {
        "org_id": org_id,
        "month": month,
        "tier": tier,
        "mtu_count": count,
        "mtu_limit": limit,
        "unlimited": limit == -1,
    }


async def check_limit(session: AsyncSession, org_id: str) -> bool:
    """Return True if the organization is within its MTU limit for the current month.

    Returns True for enterprise (unlimited) orgs.
    Returns True if org is not found (fail open — do not block evaluations on config errors).
    """
    from phaseflag_api.models.projects import OrganizationDB

    org = await session.get(OrganizationDB, org_id)
    tier = (org.subscription_tier if org else None) or _DEFAULT_TIER

    limit = TIER_LIMITS.get(tier, TIER_LIMITS[_DEFAULT_TIER])
    if limit == -1:
        return True  # unlimited

    month = _current_month()
    stmt = select(UsageRecordDB).where(
        UsageRecordDB.org_id == org_id,
        UsageRecordDB.month == month,
    )
    result = await session.execute(stmt)
    record = result.scalar_one_or_none()
    count = record.count if record else 0

    return count < limit
