"""Authentication service — password hashing and JWT token creation."""

from datetime import UTC, datetime, timedelta
from hashlib import sha256
import hmac

import bcrypt
import jwt

from phaseflag_api.config import settings
from phaseflag_api.models.users import UserDB


def hash_password(password: str) -> str:
    """Hash a password using bcrypt with auto-generated salt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a stored hash.

    Supports both bcrypt (new) and legacy SHA-256 hashes.
    """
    if password_hash.startswith(("$2b$", "$2a$", "$2y$")):
        return bcrypt.checkpw(password.encode(), password_hash.encode())

    parts = password_hash.split("$", 1)
    if len(parts) != 2:
        return False
    salt, stored_hash = parts
    h = sha256(f"{salt}${password}".encode()).hexdigest()
    return hmac.compare_digest(h, stored_hash)


def create_token(user: UserDB, org_id: str | None = None) -> str:
    """Create a JWT access token for the given user."""
    now = datetime.now(UTC)
    payload = {
        "sub": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "iat": now,
        "exp": now + timedelta(hours=settings.JWT_EXPIRE_HOURS),
    }
    if org_id is not None:
        payload["org_id"] = org_id
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
