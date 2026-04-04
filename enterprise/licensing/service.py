"""Licensing service — RSA-signed JWT license validation.

License tokens are JWTs signed with RS256 (RSA + SHA-256).  The public
key is embedded or configured; the private key is held by the license
issuer (Phase Flag).

JWT payload structure:
{
  "jti": "license-uuid",
  "sub": "org-id",
  "iss": "phaseflag",
  "iat": 1700000000,
  "exp": 1730000000,
  "plan": "enterprise",
  "features": ["analytics", "experimentation", "simulation", ...],
  "limits": {
    "max_seats": 100,
    "max_flags": 10000,
    "max_environments": 50
  }
}
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import struct
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import LicenseRecord

# ---------------------------------------------------------------------------
# All enterprise feature keys
# ---------------------------------------------------------------------------

ALL_FEATURES = [
    "analytics",
    "experimentation",
    "simulation",
    "verification",
    "counterfactual",
    "autonomous",
    "interactions",
    "finops",
    "auth",
    "compliance",
    "governance",
    "migration",
    "dashboard",
]


# ---------------------------------------------------------------------------
# JWT decoding (stdlib only, no cryptography lib)
# ---------------------------------------------------------------------------

def _b64url_decode(data: str) -> bytes:
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


def _decode_jwt_payload(token: str) -> Dict[str, Any]:
    """Decode a JWT and return the payload claims (without signature verification)."""
    parts = token.strip().split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")
    payload_bytes = _b64url_decode(parts[1])
    return json.loads(payload_bytes)


def _verify_jwt_hmac(token: str, secret: str) -> bool:
    """Verify an HS256 JWT signature (used for dev/testing mode)."""
    parts = token.strip().split(".")
    if len(parts) != 3:
        return False
    signing_input = f"{parts[0]}.{parts[1]}".encode()
    expected_sig = _b64url_decode(parts[2])
    computed = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return hmac.compare_digest(computed, expected_sig)


def _validate_claims(claims: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """Validate standard JWT claims."""
    now = datetime.utcnow()
    now_ts = int(now.timestamp())

    if "exp" in claims:
        if now_ts >= claims["exp"]:
            return False, f"License expired at {datetime.utcfromtimestamp(claims['exp']).isoformat()}"

    if "nbf" in claims:
        if now_ts < claims["nbf"]:
            return False, "License not yet valid"

    if claims.get("iss") not in ("phaseflag", "phase-flag", "PhaseFlag"):
        return False, f"Invalid issuer: {claims.get('iss')}"

    if not claims.get("sub"):
        return False, "Missing subject (organization)"

    return True, None


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

async def validate_license(
    session: AsyncSession,
    organization_id: str,
    license_key: str,
    hmac_secret: Optional[str] = None,
) -> LicenseRecord:
    """Validate a license JWT and persist the record.

    For production RSA verification, you would use the `cryptography` library.
    This implementation supports HS256 (HMAC) for testing and does structural
    validation of the JWT payload for RS256.
    """
    try:
        claims = _decode_jwt_payload(license_key)
    except Exception as exc:
        record = LicenseRecord(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            license_key=license_key,
            is_valid=0,
            validation_error=f"Failed to decode JWT: {exc}",
            features="[]",
            validated_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
        )
        session.add(record)
        await session.flush()
        return record

    # Signature verification is REQUIRED — reject tokens without it.
    # In production, use RSA-2048 public key verification. For dev/testing,
    # an HMAC secret can be provided.
    if not hmac_secret:
        record = LicenseRecord(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            license_key=license_key,
            is_valid=0,
            validation_error=(
                "License signature verification failed: no signing key configured. "
                "Set the HMAC secret or RSA public key for license validation."
            ),
            features="[]",
            validated_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
        )
        session.add(record)
        await session.flush()
        return record

    if not _verify_jwt_hmac(license_key, hmac_secret):
        record = LicenseRecord(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            license_key=license_key,
            is_valid=0,
            validation_error="Invalid signature",
            features="[]",
            validated_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
        )
        session.add(record)
        await session.flush()
        return record

    # Validate claims
    is_valid, error = _validate_claims(claims)

    # Check organization match
    if is_valid and claims.get("sub") != organization_id:
        is_valid = False
        error = f"License is for org '{claims.get('sub')}', not '{organization_id}'"

    # Never default to ALL_FEATURES — only grant what the license explicitly specifies
    features = claims.get("features", [])
    limits = claims.get("limits", {})

    issued_at = None
    if "iat" in claims:
        issued_at = datetime.utcfromtimestamp(claims["iat"])

    expires_at = None
    if "exp" in claims:
        expires_at = datetime.utcfromtimestamp(claims["exp"])

    record = LicenseRecord(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        license_key=license_key,
        license_id=claims.get("jti"),
        plan=claims.get("plan", "enterprise"),
        issued_at=issued_at,
        expires_at=expires_at,
        max_seats=limits.get("max_seats"),
        max_flags=limits.get("max_flags"),
        max_environments=limits.get("max_environments"),
        features=json.dumps(features),
        is_valid=1 if is_valid else 0,
        validation_error=error,
        validated_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    session.add(record)
    await session.flush()
    return record


async def get_features(
    session: AsyncSession, organization_id: str
) -> List[str]:
    """Get the feature entitlements for an organization's active license."""
    stmt = (
        select(LicenseRecord)
        .where(
            LicenseRecord.organization_id == organization_id,
            LicenseRecord.is_valid == 1,
        )
        .order_by(LicenseRecord.validated_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        return []
    return json.loads(record.features)


async def check_entitlement(
    session: AsyncSession, organization_id: str, feature: str
) -> bool:
    """Check if an organization is entitled to a specific feature."""
    features = await get_features(session, organization_id)
    return feature in features


async def get_license(
    session: AsyncSession, organization_id: str
) -> Optional[LicenseRecord]:
    stmt = (
        select(LicenseRecord)
        .where(LicenseRecord.organization_id == organization_id)
        .order_by(LicenseRecord.validated_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()
