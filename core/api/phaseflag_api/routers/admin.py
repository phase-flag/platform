"""Admin router — platform-wide visibility for SaaS operators.

All endpoints require the ``admin`` role.
"""

import os
import sys
import time
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, and_, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api import __version__
from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.models.audit import EvaluationEventDB
from phaseflag_api.models.flags import FeatureFlagDB
from phaseflag_api.models.projects import OrganizationDB, OrgMemberDB, ProjectDB
from phaseflag_api.models.users import UserDB
from phaseflag_api.services.sse_manager import sse_manager

router = APIRouter(dependencies=[Depends(require_api_key)])

# Track process start time for uptime calculation.
_PROCESS_START = time.monotonic()
_PROCESS_START_WALL = datetime.now(UTC)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class EvaluationsByDay(BaseModel):
    date: str
    count: int


class PlatformOverview(BaseModel):
    total_organizations: int
    total_users: int
    total_flags: int
    total_evaluations: int
    active_flags: int
    api_version: str
    database_status: str
    evaluations_by_day: list[EvaluationsByDay]


class TenantSummary(BaseModel):
    id: str
    name: str
    slug: str
    created_at: str
    project_count: int
    user_count: int
    flag_count: int
    status: str = "active"


class PaginatedTenants(BaseModel):
    items: list[TenantSummary]
    total: int
    limit: int
    offset: int


class TenantDetail(TenantSummary):
    description: str | None = None
    updated_at: str | None = None


class TenantStatusResponse(BaseModel):
    id: str
    name: str
    status: str
    note: str


class UserSummary(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: str


class PaginatedUsers(BaseModel):
    items: list[UserSummary]
    total: int
    limit: int
    offset: int


class RoleUpdate(BaseModel):
    role: str = Field(..., examples=["editor"])


class FlagUsage(BaseModel):
    flag_key: str
    flag_name: str
    evaluation_count: int
    last_evaluated_at: str | None


class UsageMetrics(BaseModel):
    evaluations_this_month: int
    evaluations_last_month: int
    evaluations_by_flag: list[FlagUsage]


class BillingTier(BaseModel):
    name: str
    eval_limit: int | str
    price_monthly: int


class BillingTenant(BaseModel):
    org_name: str
    plan: str
    usage: int
    limit: int


class BillingSummary(BaseModel):
    tiers: list[BillingTier]
    total_mrr: int
    total_customers: int
    tenants: list[BillingTenant]


class PlatformHealth(BaseModel):
    api_version: str
    uptime_seconds: float
    database: str
    active_sse_connections: int
    total_flags: int
    active_flags: int
    python_version: str
    memory_usage_mb: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/admin/overview",
    response_model=PlatformOverview,
    dependencies=[require_role("admin")],
)
async def admin_overview(session: AsyncSession = Depends(get_session)):
    """Platform-wide statistics dashboard."""
    total_orgs = (await session.execute(select(func.count(OrganizationDB.id)))).scalar_one()
    total_users = (await session.execute(select(func.count(UserDB.id)))).scalar_one()
    total_flags = (await session.execute(select(func.count(FeatureFlagDB.id)))).scalar_one()
    total_evals = (
        await session.execute(select(func.coalesce(func.sum(FeatureFlagDB.evaluation_count), 0)))
    ).scalar_one()
    active_flags = (
        await session.execute(select(func.count(FeatureFlagDB.id)).where(FeatureFlagDB.status == "active"))
    ).scalar_one()

    # Evaluations by day for the last 30 days.
    thirty_days_ago = datetime.now(UTC) - timedelta(days=30)
    stmt = (
        select(
            cast(EvaluationEventDB.timestamp, Date).label("day"),
            func.count(EvaluationEventDB.id).label("cnt"),
        )
        .where(EvaluationEventDB.timestamp >= thirty_days_ago)
        .group_by(cast(EvaluationEventDB.timestamp, Date))
        .order_by(cast(EvaluationEventDB.timestamp, Date))
    )
    rows = (await session.execute(stmt)).all()
    evals_by_day = [EvaluationsByDay(date=str(row.day), count=row.cnt) for row in rows]

    return PlatformOverview(
        total_organizations=total_orgs,
        total_users=total_users,
        total_flags=total_flags,
        total_evaluations=total_evals,
        active_flags=active_flags,
        api_version=__version__,
        database_status="connected",
        evaluations_by_day=evals_by_day,
    )


@router.get(
    "/admin/tenants",
    response_model=PaginatedTenants,
    dependencies=[require_role("admin")],
)
async def list_tenants(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """List all organizations with enriched data."""
    # Build base query.
    where_clauses = []
    if search:
        where_clauses.append(OrganizationDB.name.ilike(f"%{search}%"))

    # Total count.
    count_stmt = select(func.count(OrganizationDB.id))
    if where_clauses:
        count_stmt = count_stmt.where(*where_clauses)
    total = (await session.execute(count_stmt)).scalar_one()

    # Fetch orgs.
    org_stmt = select(OrganizationDB).order_by(OrganizationDB.created_at.desc()).limit(limit).offset(offset)
    if where_clauses:
        org_stmt = org_stmt.where(*where_clauses)
    orgs = (await session.execute(org_stmt)).scalars().all()

    # Total flag count (flags don't have org_id yet, so we share the global total).
    total_flags = (await session.execute(select(func.count(FeatureFlagDB.id)))).scalar_one()

    items: list[TenantSummary] = []
    for org in orgs:
        project_count = (
            await session.execute(select(func.count(ProjectDB.id)).where(ProjectDB.organization_id == org.id))
        ).scalar_one()
        user_count = (
            await session.execute(select(func.count(OrgMemberDB.id)).where(OrgMemberDB.organization_id == org.id))
        ).scalar_one()

        items.append(
            TenantSummary(
                id=org.id,
                name=org.name,
                slug=org.slug,
                created_at=org.created_at.isoformat() if org.created_at else "",
                project_count=project_count,
                user_count=user_count,
                flag_count=total_flags,
                status="active",
            )
        )

    return PaginatedTenants(items=items, total=total, limit=limit, offset=offset)


@router.get(
    "/admin/tenants/{org_id}",
    response_model=TenantDetail,
    dependencies=[require_role("admin")],
)
async def get_tenant(org_id: str, session: AsyncSession = Depends(get_session)):
    """Get single tenant details with enriched data."""
    org = (await session.execute(select(OrganizationDB).where(OrganizationDB.id == org_id))).scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    project_count = (
        await session.execute(select(func.count(ProjectDB.id)).where(ProjectDB.organization_id == org.id))
    ).scalar_one()
    user_count = (
        await session.execute(select(func.count(OrgMemberDB.id)).where(OrgMemberDB.organization_id == org.id))
    ).scalar_one()
    total_flags = (await session.execute(select(func.count(FeatureFlagDB.id)))).scalar_one()

    return TenantDetail(
        id=org.id,
        name=org.name,
        slug=org.slug,
        description=org.description,
        created_at=org.created_at.isoformat() if org.created_at else "",
        updated_at=org.updated_at.isoformat() if org.updated_at else None,
        project_count=project_count,
        user_count=user_count,
        flag_count=total_flags,
        status="active",
    )


@router.put(
    "/admin/tenants/{org_id}/suspend",
    response_model=TenantStatusResponse,
    dependencies=[require_role("admin")],
)
async def suspend_tenant(org_id: str, session: AsyncSession = Depends(get_session)):
    """Suspend an organization (placeholder — records intent but does not block)."""
    org = (await session.execute(select(OrganizationDB).where(OrganizationDB.id == org_id))).scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # Placeholder: actual suspension logic would update a status column and
    # enforce access restrictions across the platform.
    return TenantStatusResponse(
        id=org.id,
        name=org.name,
        status="suspended",
        note="Organization marked for suspension. Enforcement is not yet wired.",
    )


@router.put(
    "/admin/tenants/{org_id}/activate",
    response_model=TenantStatusResponse,
    dependencies=[require_role("admin")],
)
async def activate_tenant(org_id: str, session: AsyncSession = Depends(get_session)):
    """Reactivate a previously suspended organization."""
    org = (await session.execute(select(OrganizationDB).where(OrganizationDB.id == org_id))).scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    return TenantStatusResponse(
        id=org.id,
        name=org.name,
        status="active",
        note="Organization reactivated.",
    )


@router.get("/admin/users", response_model=PaginatedUsers, dependencies=[require_role("admin")])
async def list_users(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: str | None = Query(None),
    role: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """List all users across the platform."""
    where_clauses = []
    if search:
        where_clauses.append((UserDB.email.ilike(f"%{search}%")) | (UserDB.name.ilike(f"%{search}%")))
    if role:
        where_clauses.append(UserDB.role == role)

    count_stmt = select(func.count(UserDB.id))
    if where_clauses:
        count_stmt = count_stmt.where(*where_clauses)
    total = (await session.execute(count_stmt)).scalar_one()

    user_stmt = select(UserDB).order_by(UserDB.created_at.desc()).limit(limit).offset(offset)
    if where_clauses:
        user_stmt = user_stmt.where(*where_clauses)
    users = (await session.execute(user_stmt)).scalars().all()

    items = [
        UserSummary(
            id=u.id,
            email=u.email,
            name=u.name,
            role=u.role,
            created_at=u.created_at.isoformat() if u.created_at else "",
        )
        for u in users
    ]

    return PaginatedUsers(items=items, total=total, limit=limit, offset=offset)


@router.put(
    "/admin/users/{user_id}/role",
    response_model=UserSummary,
    dependencies=[require_role("admin")],
)
async def update_user_role(
    user_id: str,
    body: RoleUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Update a user's platform role."""
    valid_roles = {"admin", "editor", "viewer"}
    if body.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"role must be one of: {', '.join(sorted(valid_roles))}",
        )

    user = (await session.execute(select(UserDB).where(UserDB.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.role = body.role
    await session.flush()

    return UserSummary(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.delete(
    "/admin/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[require_role("admin")],
)
async def delete_user(user_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a user from the platform."""
    user = (await session.execute(select(UserDB).where(UserDB.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await session.delete(user)
    await session.flush()


@router.get("/admin/usage", response_model=UsageMetrics, dependencies=[require_role("admin")])
async def admin_usage(session: AsyncSession = Depends(get_session)):
    """Usage metrics: per-flag evaluation counts and month-over-month totals."""
    now = datetime.now(UTC)
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    evals_this_month = (
        await session.execute(
            select(func.count(EvaluationEventDB.id)).where(
                EvaluationEventDB.timestamp >= this_month_start,
            )
        )
    ).scalar_one()

    evals_last_month = (
        await session.execute(
            select(func.count(EvaluationEventDB.id)).where(
                and_(
                    EvaluationEventDB.timestamp >= last_month_start,
                    EvaluationEventDB.timestamp < this_month_start,
                )
            )
        )
    ).scalar_one()

    # Top 20 most evaluated flags.
    top_flags_stmt = select(FeatureFlagDB).order_by(FeatureFlagDB.evaluation_count.desc()).limit(20)
    flags = (await session.execute(top_flags_stmt)).scalars().all()

    evals_by_flag = [
        FlagUsage(
            flag_key=f.key,
            flag_name=f.name,
            evaluation_count=f.evaluation_count or 0,
            last_evaluated_at=f.last_evaluated_at.isoformat() if f.last_evaluated_at else None,
        )
        for f in flags
    ]

    return UsageMetrics(
        evaluations_this_month=evals_this_month,
        evaluations_last_month=evals_last_month,
        evaluations_by_flag=evals_by_flag,
    )


@router.get(
    "/admin/billing",
    response_model=BillingSummary,
    dependencies=[require_role("admin")],
)
async def admin_billing(session: AsyncSession = Depends(get_session)):
    """Billing summary (placeholder / mock data)."""
    tiers = [
        BillingTier(name="Free", eval_limit=10_000, price_monthly=0),
        BillingTier(name="Pro", eval_limit=1_000_000, price_monthly=49),
        BillingTier(name="Enterprise", eval_limit="unlimited", price_monthly=499),
    ]

    total_customers = (await session.execute(select(func.count(OrganizationDB.id)))).scalar_one()

    # Build per-tenant billing placeholders.
    orgs = (await session.execute(select(OrganizationDB))).scalars().all()
    total_evals = (
        await session.execute(select(func.coalesce(func.sum(FeatureFlagDB.evaluation_count), 0)))
    ).scalar_one()

    tenants = [
        BillingTenant(
            org_name=org.name,
            plan="free",
            usage=total_evals,  # shared total since flags lack org_id
            limit=10_000,
        )
        for org in orgs
    ]

    return BillingSummary(
        tiers=tiers,
        total_mrr=0,
        total_customers=total_customers,
        tenants=tenants,
    )


@router.get("/admin/health", response_model=PlatformHealth, dependencies=[require_role("admin")])
async def admin_health(session: AsyncSession = Depends(get_session)):
    """Platform health diagnostics."""
    # Verify database connectivity with a lightweight query.
    db_status = "connected"
    try:
        await session.execute(select(func.count(FeatureFlagDB.id)))
    except Exception:
        db_status = "disconnected"

    total_flags = (await session.execute(select(func.count(FeatureFlagDB.id)))).scalar_one()
    active_flags = (
        await session.execute(select(func.count(FeatureFlagDB.id)).where(FeatureFlagDB.status == "active"))
    ).scalar_one()

    uptime = time.monotonic() - _PROCESS_START

    # Memory usage via psutil (best-effort).
    memory_mb = "unknown"
    try:
        import psutil  # type: ignore[import-untyped]

        process = psutil.Process(os.getpid())
        memory_mb = f"{process.memory_info().rss / (1024 * 1024):.1f}"
    except Exception:
        pass

    return PlatformHealth(
        api_version=__version__,
        uptime_seconds=round(uptime, 2),
        database=db_status,
        active_sse_connections=sse_manager.client_count,
        total_flags=total_flags,
        active_flags=active_flags,
        python_version=sys.version,
        memory_usage_mb=memory_mb,
    )
