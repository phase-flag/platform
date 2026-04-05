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

Signature verification strategy
---------------------------------
RS256 (production):
  _verify_jwt_rs256() implements RSA-PKCS#1-v1.5 SHA-256 verification
  using Python's built-in pow() (modular exponentiation) with the PEM-
  encoded RSA public key.  No external libraries are needed for *public-
  key verification only*.

  PEM key parsing: extract base64 DER bytes, decode ASN.1 SEQUENCE to
  retrieve (n, e).  This works for PKCS#8 SubjectPublicKeyInfo and bare
  RSAPublicKey DER encodings.

HS256 (dev/testing):
  _verify_jwt_hmac() uses hmac.new(secret, signing_input, sha256).

  Enable by passing hmac_secret to validate_license(); RS256 takes
  precedence if rsa_public_key_pem is also supplied.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import struct
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import LicenseRecord

logger = logging.getLogger(__name__)

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


# ---------------------------------------------------------------------------
# RS256 verification (stdlib only — modular exponentiation via built-in pow)
# ---------------------------------------------------------------------------

def _parse_asn1_length(data: bytes, offset: int) -> Tuple[int, int]:
    """Parse an ASN.1 DER length field; returns (length, new_offset)."""
    if data[offset] < 0x80:
        return data[offset], offset + 1
    num_bytes = data[offset] & 0x7f
    length = int.from_bytes(data[offset + 1: offset + 1 + num_bytes], byteorder="big")
    return length, offset + 1 + num_bytes


def _parse_asn1_integer(data: bytes, offset: int) -> Tuple[int, int]:
    """Parse an ASN.1 DER INTEGER; returns (value_as_int, new_offset)."""
    if data[offset] != 0x02:
        raise ValueError(f"Expected ASN.1 INTEGER (0x02) at offset {offset}, got 0x{data[offset]:02x}")
    length, offset = _parse_asn1_length(data, offset + 1)
    value_bytes = data[offset: offset + length]
    # Strip leading zero byte (used to signal positive integer in DER)
    if value_bytes and value_bytes[0] == 0:
        value_bytes = value_bytes[1:]
    return int.from_bytes(value_bytes, byteorder="big"), offset + length


def _extract_rsa_n_e_from_der(der: bytes) -> Tuple[int, int]:
    """Extract RSA public key (n, e) from DER-encoded bytes.

    Supports two DER formats:
    1. PKCS#8 SubjectPublicKeyInfo: SEQUENCE { AlgorithmIdentifier, BIT STRING { RSAPublicKey }}
    2. Raw RSAPublicKey: SEQUENCE { INTEGER n, INTEGER e }
    """
    # Outer SEQUENCE
    if der[0] != 0x30:
        raise ValueError("DER does not start with SEQUENCE (0x30)")
    _, offset = _parse_asn1_length(der, 1)

    # Peek at next tag: 0x30 = inner SEQUENCE (AlgorithmIdentifier) → SubjectPublicKeyInfo
    #                   0x02 = INTEGER → bare RSAPublicKey
    if der[offset] == 0x02:
        # Bare RSAPublicKey SEQUENCE { n INTEGER, e INTEGER }
        n, offset = _parse_asn1_integer(der, offset)
        e, _ = _parse_asn1_integer(der, offset)
        return n, e

    if der[offset] == 0x30:
        # AlgorithmIdentifier SEQUENCE — skip it
        alg_len, offset = _parse_asn1_length(der, offset + 1)
        offset += alg_len
        # BIT STRING wrapper
        if der[offset] != 0x03:
            raise ValueError(f"Expected BIT STRING (0x03) after AlgorithmIdentifier, got 0x{der[offset]:02x}")
        bs_len, offset = _parse_asn1_length(der, offset + 1)
        # First byte of BIT STRING is "unused bits" count; skip it
        inner_der = der[offset + 1: offset + bs_len]
        return _extract_rsa_n_e_from_der(inner_der)

    raise ValueError(f"Cannot parse DER: unexpected tag 0x{der[offset]:02x} at offset {offset}")


def _load_rsa_public_key_pem(pem: str) -> Tuple[int, int]:
    """Parse a PEM-encoded RSA public key and return (n, e)."""
    lines = [ln.strip() for ln in pem.strip().splitlines()]
    # Strip PEM headers/footers
    b64_lines = [ln for ln in lines if not ln.startswith("-----")]
    der = base64.b64decode("".join(b64_lines))
    return _extract_rsa_n_e_from_der(der)


def _rsa_verify_pkcs1_sha256(message: bytes, signature: bytes, n: int, e: int) -> bool:
    """Verify an RSA-PKCS#1-v1.5 SHA-256 signature using stdlib modular exponentiation.

    PKCS#1 v1.5 DigestInfo ASN.1 prefix for SHA-256 (19 bytes):
        30 31 30 0d 06 09 60 86 48 01 65 03 04 02 01 05 00 04 20
    followed by the 32-byte SHA-256 digest.
    """
    sig_int = int.from_bytes(signature, byteorder="big")
    key_len = (n.bit_length() + 7) // 8
    if len(signature) != key_len:
        return False
    padded_int = pow(sig_int, e, n)
    padded = padded_int.to_bytes(key_len, byteorder="big")

    SHA256_DIGEST_INFO = bytes([
        0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86,
        0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05,
        0x00, 0x04, 0x20,
    ])
    expected_suffix = SHA256_DIGEST_INFO + hashlib.sha256(message).digest()

    if padded[0] != 0x00 or padded[1] != 0x01:
        return False
    sep_idx = padded.find(b"\x00", 2)
    if sep_idx == -1:
        return False
    if padded[2:sep_idx] != b"\xff" * (sep_idx - 2):
        return False
    actual_suffix = padded[sep_idx + 1:]
    return hmac.compare_digest(actual_suffix, expected_suffix)


def _verify_jwt_rs256(token: str, rsa_public_key_pem: str) -> bool:
    """Verify an RS256 JWT signature using a PEM-encoded RSA public key.

    Returns True if the signature is valid, False otherwise.

    To add this to production:
      1. Generate key pair: openssl genrsa -out license_private.pem 2048
         openssl rsa -in license_private.pem -pubout -out license_public.pem
      2. Store license_public.pem content in PHASEFLAG_LICENSE_RSA_PUBLIC_KEY env var.
      3. Pass that value as rsa_public_key_pem to validate_license().
    """
    parts = token.strip().split(".")
    if len(parts) != 3:
        return False
    try:
        n, e = _load_rsa_public_key_pem(rsa_public_key_pem)
    except Exception as exc:
        logger.warning("Failed to load RSA public key: %s", exc)
        return False

    signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
    try:
        signature = _b64url_decode(parts[2])
    except Exception:
        return False

    return _rsa_verify_pkcs1_sha256(signing_input, signature, n, e)


def _validate_claims(claims: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """Validate standard JWT claims (iss, sub, exp, iat, jti, nbf)."""
    import time as _time_mod
    now_ts = int(_time_mod.time())  # Unix UTC epoch seconds (timezone-independent)

    # exp — must not be in the past
    if "exp" in claims:
        if now_ts >= claims["exp"]:
            return False, f"License expired at {datetime.utcfromtimestamp(claims['exp']).isoformat()}"
    else:
        return False, "License JWT is missing 'exp' claim"

    # nbf — not-before
    if "nbf" in claims:
        if now_ts < claims["nbf"]:
            return False, "License not yet valid"

    # iat — issued-at must be present and not in the future (with 60s clock skew)
    if "iat" not in claims:
        return False, "License JWT is missing 'iat' claim"
    if claims["iat"] > now_ts + 60:
        return False, f"License 'iat' is in the future: {claims['iat']}"

    # iss — issuer
    if claims.get("iss") not in ("phaseflag", "phase-flag", "PhaseFlag"):
        return False, f"Invalid issuer: {claims.get('iss')}"

    # sub — subject (organization ID)
    if not claims.get("sub"):
        return False, "Missing subject (organization)"

    # jti — JWT ID must be present (used for replay detection)
    if not claims.get("jti"):
        return False, "License JWT is missing 'jti' claim (unique license ID required)"

    return True, None


# ---------------------------------------------------------------------------
# Service functions
# ---------------------------------------------------------------------------

async def validate_license(
    session: AsyncSession,
    organization_id: str,
    license_key: str,
    hmac_secret: Optional[str] = None,
    rsa_public_key_pem: Optional[str] = None,
) -> LicenseRecord:
    """Validate a license JWT and persist the record.

    Signature verification priority:
      1. RS256 — if rsa_public_key_pem is provided, verify with RSA public key
         using stdlib modular exponentiation (see _verify_jwt_rs256).
         Set PHASEFLAG_LICENSE_RSA_PUBLIC_KEY env var with PEM content.
      2. HS256 — if hmac_secret is provided, verify with HMAC-SHA256.
         Intended for dev/testing only.
      3. Neither configured — reject with a clear error.

    All JWT claims (iss, sub, exp, iat, jti) are validated regardless of
    the signature method.
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

    # Determine which signature algorithm the token claims to use
    parts = license_key.strip().split(".")
    try:
        header = json.loads(_b64url_decode(parts[0]))
        alg = header.get("alg", "")
    except Exception:
        alg = ""

    sig_valid = False
    sig_error: Optional[str] = None

    if rsa_public_key_pem:
        # RS256 path — preferred for production
        if alg not in ("RS256", ""):
            sig_error = f"Expected RS256 algorithm, got '{alg}'"
        else:
            if _verify_jwt_rs256(license_key, rsa_public_key_pem):
                sig_valid = True
            else:
                sig_error = "RS256 signature verification failed"
    elif hmac_secret:
        # HS256 path — dev/testing only
        if alg not in ("HS256", ""):
            sig_error = f"Expected HS256 algorithm for HMAC verification, got '{alg}'"
        else:
            if _verify_jwt_hmac(license_key, hmac_secret):
                sig_valid = True
            else:
                sig_error = "HS256 signature verification failed (invalid signature)"
    else:
        sig_error = (
            "License signature verification failed: no signing key configured. "
            "Provide PHASEFLAG_LICENSE_RSA_PUBLIC_KEY (RS256, production) or "
            "an HMAC secret (HS256, dev/testing)."
        )

    if not sig_valid:
        record = LicenseRecord(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            license_key=license_key,
            is_valid=0,
            validation_error=sig_error,
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
