"""Governance endpoints — change requests, approvals, service accounts, freeze windows, break-glass, policies."""

from datetime import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import (
    get_current_user,
    require_api_key,
    require_role,
)
from phaseflag_api.services import governance_service
from phaseflag_api.services.policy_engine import PolicyEngine

router = APIRouter(dependencies=[Depends(require_api_key)])


# --- Change Request Schemas ---


class ChangeRequestCreate(BaseModel):
    title: str = Field(..., max_length=255)
    description: str | None = None
    entity_type: str = Field("flag", examples=["flag"])
    entity_key: str = Field(..., examples=["dark-mode"])
    change_type: str = Field(..., examples=["update"])
    payload: dict = Field(default_factory=dict)
    environment: str | None = None
    requires_approval_count: int = Field(1, ge=1, le=5)


class ReviewRequest(BaseModel):
    comment: str | None = None


class ChangeRequestOut(BaseModel):
    id: str
    title: str
    description: str | None
    entity_type: str
    entity_key: str
    change_type: str
    status: str
    requested_by: str
    reviewed_by: str | None
    review_comment: str | None
    environment: str | None
    requires_approval_count: int
    approval_count: int
    created_at: str
    resolved_at: str | None


class PaginatedChangeRequests(BaseModel):
    items: list[ChangeRequestOut]
    total: int


def _cr_to_out(cr) -> ChangeRequestOut:
    return ChangeRequestOut(
        id=cr.id,
        title=cr.title,
        description=cr.description,
        entity_type=cr.entity_type,
        entity_key=cr.entity_key,
        change_type=cr.change_type,
        status=cr.status,
        requested_by=cr.requested_by,
        reviewed_by=cr.reviewed_by,
        review_comment=cr.review_comment,
        environment=cr.environment,
        requires_approval_count=cr.requires_approval_count,
        approval_count=cr.approval_count,
        created_at=cr.created_at.isoformat(),
        resolved_at=cr.resolved_at.isoformat() if cr.resolved_at else None,
    )


# --- Service Account Schemas ---


class ServiceAccountCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: str | None = None
    role: str = Field("viewer", examples=["editor"])
    scopes: list[str] = Field(default_factory=list)


class ServiceAccountOut(BaseModel):
    id: str
    name: str
    description: str | None
    api_key: str
    role: str
    scopes: list[str]
    active: bool
    created_by: str
    created_at: str


def _sa_to_out(sa) -> ServiceAccountOut:
    return ServiceAccountOut(
        id=sa.id,
        name=sa.name,
        description=sa.description,
        api_key=sa.api_key,
        role=sa.role,
        scopes=sa.get_scopes(),
        active=sa.active,
        created_by=sa.created_by,
        created_at=sa.created_at.isoformat(),
    )


# --- Freeze Window Schemas ---


class FreezeWindowCreate(BaseModel):
    name: str = Field(..., max_length=255)
    environment: str | None = None
    starts_at: str = Field(..., examples=["2026-03-25T00:00:00Z"])
    ends_at: str = Field(..., examples=["2026-03-26T00:00:00Z"])
    reason: str | None = None


class FreezeWindowOut(BaseModel):
    id: str
    name: str
    environment: str | None
    starts_at: str
    ends_at: str
    reason: str | None
    active: bool
    created_by: str
    created_at: str


def _fw_to_out(fw) -> FreezeWindowOut:
    return FreezeWindowOut(
        id=fw.id,
        name=fw.name,
        environment=fw.environment,
        starts_at=fw.starts_at.isoformat(),
        ends_at=fw.ends_at.isoformat(),
        reason=fw.reason,
        active=fw.active,
        created_by=fw.created_by,
        created_at=fw.created_at.isoformat(),
    )


# --- Change Request Endpoints ---


@router.post(
    "/changes",
    response_model=ChangeRequestOut,
    status_code=201,
    dependencies=[require_role("editor")],
)
async def create_change_request(
    body: ChangeRequestCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    cr = await governance_service.create_change_request(
        session,
        title=body.title,
        description=body.description,
        entity_type=body.entity_type,
        entity_key=body.entity_key,
        change_type=body.change_type,
        payload=body.payload,
        requested_by=user.get("email", "system"),
        environment=body.environment,
        requires_approval_count=body.requires_approval_count,
    )
    return _cr_to_out(cr)


@router.get("/changes", response_model=PaginatedChangeRequests)
async def list_change_requests(
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    items, total = await governance_service.list_change_requests(
        session,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )
    return PaginatedChangeRequests(items=[_cr_to_out(cr) for cr in items], total=total)


@router.get("/changes/{cr_id}", response_model=ChangeRequestOut)
async def get_change_request(cr_id: str, session: AsyncSession = Depends(get_session)):
    cr = await governance_service.get_change_request(session, cr_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")
    return _cr_to_out(cr)


@router.post(
    "/changes/{cr_id}/approve",
    response_model=ChangeRequestOut,
    dependencies=[require_role("admin")],
)
async def approve_change_request(
    cr_id: str,
    body: ReviewRequest,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    cr = await governance_service.get_change_request(session, cr_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")

    # Enforce two-person rule
    try:
        await governance_service.enforce_two_person_rule(
            session, cr_id, user.get("email", "system")
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    updated = await governance_service.approve_change_request(
        session,
        cr,
        reviewer=user.get("email", "system"),
        comment=body.comment,
    )
    return _cr_to_out(updated)


@router.post(
    "/changes/{cr_id}/reject",
    response_model=ChangeRequestOut,
    dependencies=[require_role("admin")],
)
async def reject_change_request(
    cr_id: str,
    body: ReviewRequest,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    cr = await governance_service.get_change_request(session, cr_id)
    if not cr:
        raise HTTPException(status_code=404, detail="Change request not found")
    updated = await governance_service.reject_change_request(
        session,
        cr,
        reviewer=user.get("email", "system"),
        comment=body.comment,
    )
    return _cr_to_out(updated)


# --- Service Account Endpoints ---


@router.post(
    "/service-accounts",
    response_model=ServiceAccountOut,
    status_code=201,
    dependencies=[require_role("admin")],
)
async def create_service_account(
    body: ServiceAccountCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    sa = await governance_service.create_service_account(
        session,
        name=body.name,
        description=body.description,
        role=body.role,
        scopes=body.scopes,
        created_by=user.get("email", "system"),
    )
    return _sa_to_out(sa)


@router.get(
    "/service-accounts",
    response_model=list[ServiceAccountOut],
    dependencies=[require_role("admin")],
)
async def list_service_accounts(session: AsyncSession = Depends(get_session)):
    accounts, _ = await governance_service.list_service_accounts(session)
    return [_sa_to_out(sa) for sa in accounts]


@router.delete(
    "/service-accounts/{sa_id}", status_code=204, dependencies=[require_role("admin")]
)
async def revoke_service_account(
    sa_id: str, session: AsyncSession = Depends(get_session)
):
    from sqlalchemy import select
    from phaseflag_api.models.governance import ServiceAccountDB

    result = await session.execute(
        select(ServiceAccountDB).where(ServiceAccountDB.id == sa_id)
    )
    sa = result.scalar_one_or_none()
    if not sa:
        raise HTTPException(status_code=404, detail="Service account not found")
    await governance_service.revoke_service_account(session, sa)


# --- Freeze Window Endpoints ---


@router.post(
    "/freeze-windows",
    response_model=FreezeWindowOut,
    status_code=201,
    dependencies=[require_role("admin")],
)
async def create_freeze_window(
    body: FreezeWindowCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    fw = await governance_service.create_freeze_window(
        session,
        name=body.name,
        environment=body.environment,
        starts_at=dt.fromisoformat(body.starts_at.replace("Z", "+00:00")),
        ends_at=dt.fromisoformat(body.ends_at.replace("Z", "+00:00")),
        reason=body.reason,
        created_by=user.get("email", "system"),
    )
    return _fw_to_out(fw)


@router.get("/freeze-windows", response_model=list[FreezeWindowOut])
async def list_freeze_windows(
    active_only: bool = Query(True),
    session: AsyncSession = Depends(get_session),
):
    windows = await governance_service.list_freeze_windows(
        session, active_only=active_only
    )
    return [_fw_to_out(fw) for fw in windows]


# --- Break-Glass Schemas ---


class BreakGlassCreate(BaseModel):
    flag_key: str = Field(..., max_length=255)
    environment: str = Field(..., max_length=50)
    action: str = Field(..., examples=["toggle", "update", "override"])
    reason: str = Field(..., min_length=1)
    expires_hours: int = Field(24, ge=1, le=168)


class BreakGlassOut(BaseModel):
    id: str
    flag_key: str
    environment: str
    action: str
    reason: str
    performed_by: str
    approved_by: str | None
    changes_json: str | None
    expires_at: str | None
    reverted: bool
    created_at: str


class PaginatedBreakGlass(BaseModel):
    items: list[BreakGlassOut]
    total: int


def _bg_to_out(event) -> BreakGlassOut:
    return BreakGlassOut(
        id=event.id,
        flag_key=event.flag_key,
        environment=event.environment,
        action=event.action,
        reason=event.reason,
        performed_by=event.performed_by,
        approved_by=event.approved_by,
        changes_json=event.changes_json,
        expires_at=event.expires_at.isoformat() if event.expires_at else None,
        reverted=event.reverted,
        created_at=event.created_at.isoformat(),
    )


# --- Break-Glass Endpoints ---


@router.post(
    "/break-glass",
    response_model=BreakGlassOut,
    status_code=201,
    dependencies=[require_role("admin")],
)
async def create_break_glass(
    body: BreakGlassCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Emergency override that bypasses freeze windows and approval requirements."""
    event = await governance_service.break_glass(
        session,
        flag_key=body.flag_key,
        environment=body.environment,
        action=body.action,
        reason=body.reason,
        performer=user.get("email", "system"),
        expires_hours=body.expires_hours,
    )
    return _bg_to_out(event)


@router.get("/break-glass", response_model=PaginatedBreakGlass)
async def list_break_glass_events(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    items, total = await governance_service.list_break_glass_events(
        session, limit=limit, offset=offset
    )
    return PaginatedBreakGlass(items=[_bg_to_out(e) for e in items], total=total)


@router.post(
    "/break-glass/{event_id}/revert",
    response_model=BreakGlassOut,
    dependencies=[require_role("admin")],
)
async def revert_break_glass(
    event_id: str,
    session: AsyncSession = Depends(get_session),
):
    try:
        event = await governance_service.revert_break_glass(session, event_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _bg_to_out(event)


# --- Policy Evaluation ---


class PolicyEvaluateRequest(BaseModel):
    action: str = Field(..., examples=["flag.modify", "flag.deploy_production"])
    resource: dict = Field(
        default_factory=dict,
        examples=[{"flag_key": "dark-mode", "environment": "production"}],
    )


class PolicyEvaluateResponse(BaseModel):
    allowed: bool
    reason: str


@router.post("/policies/evaluate", response_model=PolicyEvaluateResponse)
async def evaluate_policy(
    body: PolicyEvaluateRequest,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Evaluate an access control policy for the current user."""
    allowed, reason = await PolicyEngine.evaluate_policy(
        session, body.action, user, body.resource
    )
    return PolicyEvaluateResponse(allowed=allowed, reason=reason)


# --- Token Rotation / Key Expiry Schemas ---


class KeyRotationOut(BaseModel):
    id: str
    name: str
    api_key: str
    old_key_prefix: str | None


class KeyExpiryRequest(BaseModel):
    expires_at: str = Field(..., examples=["2026-06-01T00:00:00Z"])


class KeyExpiryOut(BaseModel):
    id: str
    expires_at: str


# --- Token Rotation / Key Expiry Endpoints ---


@router.post(
    "/service-accounts/{sa_id}/rotate-key",
    response_model=KeyRotationOut,
    dependencies=[require_role("admin")],
)
async def rotate_service_account_key(
    sa_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Rotate a service account's API key, invalidating the old one."""
    try:
        result = await governance_service.rotate_service_account_key(session, sa_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return KeyRotationOut(**result)


@router.put(
    "/service-accounts/{sa_id}/expiry",
    response_model=KeyExpiryOut,
    dependencies=[require_role("admin")],
)
async def set_key_expiry(
    sa_id: str,
    body: KeyExpiryRequest,
    session: AsyncSession = Depends(get_session),
):
    """Set or update the expiration date for a service account's API key."""
    try:
        expires_at = dt.fromisoformat(body.expires_at.replace("Z", "+00:00"))
        result = await governance_service.set_key_expiry(session, sa_id, expires_at)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return KeyExpiryOut(**result)
