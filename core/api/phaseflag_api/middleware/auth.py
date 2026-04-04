"""Authentication and RBAC dependencies for API-key and JWT bearer tokens."""

import hmac
import logging
from datetime import UTC, datetime

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from phaseflag_api.config import settings

_security_logger = logging.getLogger("phaseflag.security")

ROLE_HIERARCHY = {"admin": 3, "editor": 2, "viewer": 1}

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
_bearer_scheme = HTTPBearer(auto_error=False)


def _is_valid_api_key(token: str) -> bool:
    """Constant-time comparison of a token against the configured API secret key."""
    return hmac.compare_digest(token.encode(), settings.API_SECRET_KEY.encode())


def _decode_jwt(token: str) -> dict | None:
    """Try to decode a JWT. Returns claims dict or None if not a valid JWT.

    Only accepts HS256 algorithm — rejects 'none', RS256, and other algorithm
    confusion attacks.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=["HS256"],  # Hardcoded — never trust algorithm from token header
            options={"require": ["exp", "sub", "iat"]},
        )
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp, tz=UTC) < datetime.now(UTC):
            return None
        return payload
    except (jwt.InvalidTokenError, jwt.DecodeError, jwt.MissingRequiredClaimError):
        return None


async def require_api_key(
    api_key: str | None = Security(_api_key_header),
    bearer: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
) -> str:
    """Validate that the request carries a valid API key or JWT token."""
    token: str | None = None

    if api_key:
        token = api_key
    elif bearer:
        token = bearer.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key. Provide X-API-Key header or Authorization Bearer token.",
        )

    if _is_valid_api_key(token):
        return token

    claims = _decode_jwt(token)
    if claims is not None:
        return token

    _security_logger.warning(
        "AUTH_FAILURE: invalid API key or token (token_prefix=%s...)",
        token[:8] if len(token) > 8 else "***",
    )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Invalid API key or token.",
    )


async def get_current_user(
    api_key: str | None = Security(_api_key_header),
    bearer: HTTPAuthorizationCredentials | None = Security(_bearer_scheme),
) -> dict:
    """Extract the current user from the request."""
    token: str | None = None

    if api_key:
        token = api_key
    elif bearer:
        token = bearer.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key or token.",
        )

    if _is_valid_api_key(token):
        return {"id": "system", "email": "system", "name": "API Key", "role": "admin"}

    claims = _decode_jwt(token)
    if claims is not None:
        return {
            "id": claims.get("sub", ""),
            "email": claims.get("email", ""),
            "name": claims.get("name", ""),
            "role": claims.get("role", "viewer"),
        }

    _security_logger.warning(
        "AUTH_FAILURE: invalid credentials in get_current_user (token_prefix=%s...)",
        token[:8] if len(token) > 8 else "***",
    )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Invalid API key or token.",
    )


def require_role(minimum_role: str):
    """FastAPI dependency that enforces a minimum role level."""
    min_level = ROLE_HIERARCHY.get(minimum_role, 0)

    async def _check(user: dict = Depends(get_current_user)):
        user_level = ROLE_HIERARCHY.get(user.get("role", "viewer"), 0)
        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{minimum_role}' role or higher. Your role: '{user.get('role')}'.",
            )
        return user

    return Depends(_check)
