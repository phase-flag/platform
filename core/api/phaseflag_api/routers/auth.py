"""Authentication endpoints: register, login, current user, password reset, profile update."""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.config import DeploymentMode, settings
from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import get_current_user
from phaseflag_api.models.projects import OrgMemberDB
from phaseflag_api.models.users import UserDB
from phaseflag_api.services.auth_service import (
    create_token,
    hash_password,
    verify_password,
)
from phaseflag_api.services import email_service

router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory password reset token store: { token -> (user_id, expires_at) }
# ---------------------------------------------------------------------------
_reset_tokens: dict[str, tuple[str, datetime]] = {}


def _purge_expired_tokens() -> None:
    """Remove tokens that have already expired."""
    now = datetime.now(UTC)
    expired = [t for t, (_, exp) in _reset_tokens.items() if exp < now]
    for t in expired:
        _reset_tokens.pop(t, None)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class AuthResponse(BaseModel):
    token: str
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/auth/register", response_model=AuthResponse, status_code=201)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    existing = await session.execute(select(UserDB).where(UserDB.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")

    count_result = await session.execute(select(func.count()).select_from(UserDB))
    user_count = count_result.scalar() or 0

    user = UserDB(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
        role="admin" if user_count == 0 else "viewer",
    )
    session.add(user)
    await session.flush()

    token = create_token(user)

    # Fire-and-forget welcome email (SaaS/Enterprise only; no-op in OSS)
    email_service.send_welcome_email(user.email, user.name)

    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        },
    }


@router.post("/auth/login", response_model=AuthResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(UserDB).where(UserDB.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.password_hash.startswith(("$2b$", "$2a$", "$2y$")):
        user.password_hash = hash_password(body.password)

    org_id: str | None = None
    if settings.DEPLOYMENT_MODE == DeploymentMode.SAAS:
        membership = await session.execute(select(OrgMemberDB).where(OrgMemberDB.user_id == user.id).limit(1))
        first_membership = membership.scalar_one_or_none()
        if first_membership:
            org_id = first_membership.organization_id

    token = create_token(user, org_id=org_id)
    return {
        "token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
        },
    }


@router.get("/auth/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.patch("/auth/me", response_model=UserResponse)
async def update_me(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(UserDB).where(UserDB.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if body.name is not None:
        user.name = body.name
    if body.email is not None and body.email != user.email:
        existing = await session.execute(select(UserDB).where(UserDB.email == body.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use.")
        user.email = body.email

    await session.flush()
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role}


@router.post("/auth/change-password", status_code=200)
async def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(UserDB).where(UserDB.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect.")

    user.password_hash = hash_password(body.new_password)
    await session.flush()
    return {"message": "Password changed successfully."}


@router.post("/auth/forgot-password", status_code=200)
async def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    _purge_expired_tokens()

    result = await session.execute(select(UserDB).where(UserDB.email == body.email))
    user = result.scalar_one_or_none()

    # Always return 200 to avoid leaking whether the email exists
    if user:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(hours=1)
        _reset_tokens[token] = (user.id, expires_at)

        portal_origin = getattr(settings, "PORTAL_ORIGIN", "http://localhost:5174")
        reset_url = f"{portal_origin}/reset-password?token={token}"
        email_service.send_password_reset_email(user.email, token, reset_url)

    return {"message": "If an account exists with that email, we've sent a reset link."}


@router.post("/auth/reset-password", status_code=200)
async def reset_password(
    body: ResetPasswordRequest,
    session: AsyncSession = Depends(get_session),
):
    _purge_expired_tokens()

    entry = _reset_tokens.get(body.token)
    if not entry:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link.")

    user_id, expires_at = entry
    if datetime.now(UTC) > expires_at:
        _reset_tokens.pop(body.token, None)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link.")

    result = await session.execute(select(UserDB).where(UserDB.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link.")

    user.password_hash = hash_password(body.new_password)
    _reset_tokens.pop(body.token, None)
    await session.flush()
    return {"message": "Password reset successfully."}
