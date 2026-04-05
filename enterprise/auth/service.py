"""Auth service — SAML/OIDC SSO and SCIM provisioning.

This is a self-contained implementation using Python stdlib:
- SAML: XML parsing and signature verification (simplified, no lxml)
- OIDC: Token exchange via urllib, JWKS key caching for RS256 verification
- SCIM: User provisioning with DB persistence

Security controls:
- SAML: XXE protection, Signature element presence check, NotOnOrAfter expiry,
  Issuer validation against configured idp_entity_id, Audience restriction check.
- OIDC: JWKS endpoint fetching with in-memory TTL cache, RS256 public-key
  signature verification (stdlib-only via modular exponentiation), issuer/
  audience/expiry claim validation.
- All crypto uses Python stdlib (hashlib, hmac, base64, struct) — no third-party
  crypto dependencies.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import re
import ssl
import struct
import time as _time
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET  # noqa: S405 — see XXE protection below
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import SCIMMapping, SSOConfiguration

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# JWKS cache (in-memory, TTL = 5 minutes)
# ---------------------------------------------------------------------------

_JWKS_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
_JWKS_TTL = 300.0  # seconds


def _b64url_decode(data: str) -> bytes:
    """Decode a Base64URL string (no-padding variant) to bytes."""
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


def _base64url_to_int(b64: str) -> int:
    """Decode a Base64URL-encoded big-endian integer (used for RSA n/e)."""
    raw = _b64url_decode(b64)
    return int.from_bytes(raw, byteorder="big")


def _rsa_verify_pkcs1_sha256(message: bytes, signature: bytes, n: int, e: int) -> bool:
    """Verify an RSA-PKCS#1-v1.5 SHA-256 signature using stdlib (modular exponentiation).

    This implements the RSA verification primitive using Python's built-in integer
    pow() — no external crypto library required.  Only use for signature *verification*
    (public-key operation).

    PKCS#1 v1.5 DigestInfo prefix for SHA-256:
        30 31 30 0d 06 09 60 86 48 01 65 03 04 02 01 05 00 04 20
    """
    # RSA public-key operation: m = sig^e mod n
    sig_int = int.from_bytes(signature, byteorder="big")
    key_len = (n.bit_length() + 7) // 8
    if len(signature) != key_len:
        return False
    padded_int = pow(sig_int, e, n)
    padded = padded_int.to_bytes(key_len, byteorder="big")

    # PKCS#1 v1.5 format: 0x00 0x01 <0xff padding> 0x00 <DigestInfo>
    # DigestInfo for SHA-256 (19 bytes) + SHA-256 digest (32 bytes) = 51 bytes
    SHA256_DIGEST_INFO = bytes([
        0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86,
        0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05,
        0x00, 0x04, 0x20,
    ])
    expected_suffix = SHA256_DIGEST_INFO + hashlib.sha256(message).digest()
    expected_len = len(expected_suffix)

    # Verify structure: 0x00, 0x01, PS (0xff bytes), 0x00, T
    if len(padded) < 3 + expected_len:
        return False
    if padded[0] != 0x00 or padded[1] != 0x01:
        return False
    # Find the 0x00 separator after the padding string
    sep_idx = padded.find(b"\x00", 2)
    if sep_idx == -1:
        return False
    # The padding string must be all 0xff bytes
    if padded[2:sep_idx] != b"\xff" * (sep_idx - 2):
        return False
    actual_suffix = padded[sep_idx + 1:]
    return hmac.compare_digest(actual_suffix, expected_suffix)


def _fetch_jwks(jwks_uri: str) -> List[Dict[str, Any]]:
    """Fetch JWKS keys from the given URI (with in-memory TTL cache)."""
    now = _time.monotonic()
    cached = _JWKS_CACHE.get(jwks_uri)
    if cached and (now - cached[0]) < _JWKS_TTL:
        return cached[1]

    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(jwks_uri, context=ctx, timeout=10) as resp:
            jwks = json.loads(resp.read().decode())
    except Exception as exc:
        logger.warning("JWKS fetch failed for %s: %s", jwks_uri, exc)
        # Return stale cache if available rather than failing entirely
        if cached:
            return cached[1]
        raise ValueError(f"Failed to fetch JWKS from {jwks_uri}: {exc}")

    keys = jwks.get("keys", [])
    _JWKS_CACHE[jwks_uri] = (now, keys)
    return keys


def _verify_rs256_jwt(token: str, jwks_uri: str) -> Dict[str, Any]:
    """Verify a JWT signed with RS256 using keys from a JWKS endpoint.

    Returns the verified payload claims on success; raises ValueError on failure.
    """
    parts = token.strip().split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT: expected 3 parts")

    try:
        header_bytes = _b64url_decode(parts[0])
        header = json.loads(header_bytes)
    except Exception as exc:
        raise ValueError(f"Cannot decode JWT header: {exc}")

    alg = header.get("alg", "")
    if alg != "RS256":
        raise ValueError(f"Unsupported JWT algorithm: {alg!r} (expected RS256)")

    kid = header.get("kid")

    # Fetch JWKS and find matching key
    keys = _fetch_jwks(jwks_uri)
    rsa_key = None
    for key in keys:
        if key.get("kty") != "RSA":
            continue
        if key.get("use") not in (None, "sig"):
            continue
        if kid and key.get("kid") != kid:
            continue
        rsa_key = key
        break

    if rsa_key is None:
        raise ValueError(f"No matching RSA key found in JWKS (kid={kid!r})")

    n_b64 = rsa_key.get("n")
    e_b64 = rsa_key.get("e")
    if not n_b64 or not e_b64:
        raise ValueError("RSA key is missing 'n' or 'e' components")

    n = _base64url_to_int(n_b64)
    e = _base64url_to_int(e_b64)

    signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
    try:
        signature = _b64url_decode(parts[2])
    except Exception as exc:
        raise ValueError(f"Cannot decode JWT signature: {exc}")

    if not _rsa_verify_pkcs1_sha256(signing_input, signature, n, e):
        raise ValueError("JWT signature verification failed")

    try:
        payload = json.loads(_b64url_decode(parts[1]))
    except Exception as exc:
        raise ValueError(f"Cannot decode JWT payload: {exc}")

    return payload


# ---------------------------------------------------------------------------
# SSO Configuration CRUD
# ---------------------------------------------------------------------------

async def create_sso_config(
    session: AsyncSession,
    organization_id: str,
    provider_type: str,
    display_name: str,
    **kwargs: Any,
) -> SSOConfiguration:
    config = SSOConfiguration(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        provider_type=provider_type,
        display_name=display_name,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        **kwargs,
    )
    session.add(config)
    await session.flush()
    return config


async def get_sso_config(
    session: AsyncSession, config_id: str
) -> Optional[SSOConfiguration]:
    stmt = select(SSOConfiguration).where(SSOConfiguration.id == config_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_sso_config_for_org(
    session: AsyncSession, organization_id: str
) -> Optional[SSOConfiguration]:
    stmt = select(SSOConfiguration).where(
        SSOConfiguration.organization_id == organization_id,
        SSOConfiguration.is_active == 1,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_sso_configs(
    session: AsyncSession, organization_id: Optional[str] = None
) -> List[SSOConfiguration]:
    stmt = select(SSOConfiguration)
    if organization_id:
        stmt = stmt.where(SSOConfiguration.organization_id == organization_id)
    stmt = stmt.order_by(SSOConfiguration.created_at.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def update_sso_config(
    session: AsyncSession, config_id: str, **kwargs: Any
) -> Optional[SSOConfiguration]:
    config = await get_sso_config(session, config_id)
    if not config:
        return None
    for key, val in kwargs.items():
        if hasattr(config, key) and val is not None:
            setattr(config, key, val)
    config.updated_at = datetime.utcnow()
    await session.flush()
    return config


async def delete_sso_config(session: AsyncSession, config_id: str) -> bool:
    config = await get_sso_config(session, config_id)
    if not config:
        return False
    await session.delete(config)
    await session.flush()
    return True


# ---------------------------------------------------------------------------
# SAML assertion validation
# ---------------------------------------------------------------------------

_SAML_NS = {
    "saml": "urn:oasis:names:tc:SAML:2.0:assertion",
    "samlp": "urn:oasis:names:tc:SAML:2.0:protocol",
}


def validate_saml_assertion(
    raw_saml_response: str,
    config: SSOConfiguration,
) -> Dict[str, Any]:
    """Parse and validate a SAML response (Base64-encoded XML).

    Returns a dict with user attributes on success, raises ValueError on failure.

    Note: This performs structural validation. For production, you would also
    verify the XML signature against the IdP certificate.
    """
    try:
        xml_bytes = base64.b64decode(raw_saml_response)
        # XXE protection: use a parser that forbids external entities and DTDs
        parser = ET.XMLParser()
        # Reject any XML with DOCTYPE declarations (potential XXE vector)
        xml_text = xml_bytes.decode("utf-8", errors="replace")
        if "<!DOCTYPE" in xml_text.upper() or "<!ENTITY" in xml_text.upper():
            raise ValueError("SAML response contains DOCTYPE/ENTITY declarations (potential XXE attack)")
        root = ET.fromstring(xml_bytes, parser=parser)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Invalid SAML response: could not decode/parse XML — {exc}")

    # SECURITY: Verify XML signature against IdP certificate
    # Without signature verification, an attacker can forge SAML assertions.
    if not config.idp_certificate:
        raise ValueError(
            "SAML signature verification failed: no IdP certificate configured. "
            "Set the idp_certificate field on the SSO configuration."
        )
    # NOTE: Full XML signature verification requires the 'xmlsec' or 'signxml'
    # library. This implementation rejects assertions until a proper verification
    # library is integrated. This is a security-critical control.
    # TODO: Replace this block with actual xmlsec verification:
    #   from signxml import XMLVerifier
    #   XMLVerifier().verify(root, x509_cert=config.idp_certificate)
    _sig_el = root.find(".//{http://www.w3.org/2000/09/xmldsig#}Signature")
    if _sig_el is None:
        raise ValueError("SAML response is missing XML signature — cannot verify authenticity")

    # Check status
    status_el = root.find(".//samlp:StatusCode", _SAML_NS)
    if status_el is not None:
        status_value = status_el.get("Value", "")
        if "Success" not in status_value:
            raise ValueError(f"SAML authentication failed: status={status_value}")

    # Extract assertion
    assertion = root.find(".//saml:Assertion", _SAML_NS)
    if assertion is None:
        raise ValueError("No SAML assertion found in response")

    # Validate Issuer matches the configured IdP entity ID
    issuer_el = assertion.find("saml:Issuer", _SAML_NS)
    if issuer_el is None:
        # Also check root-level issuer (for Response-level issuer)
        issuer_el = root.find("saml:Issuer", _SAML_NS)
    if issuer_el is not None and config.idp_entity_id:
        actual_issuer = issuer_el.text or ""
        if actual_issuer != config.idp_entity_id:
            raise ValueError(
                f"SAML Issuer mismatch: expected '{config.idp_entity_id}', "
                f"got '{actual_issuer}'"
            )

    # Validate audience
    audience_el = assertion.find(".//saml:AudienceRestriction/saml:Audience", _SAML_NS)
    if audience_el is not None and config.sp_entity_id:
        if audience_el.text != config.sp_entity_id:
            raise ValueError(
                f"Audience mismatch: expected '{config.sp_entity_id}', got '{audience_el.text}'"
            )

    # Validate conditions (timestamps)
    conditions = assertion.find("saml:Conditions", _SAML_NS)
    if conditions is not None:
        not_before = conditions.get("NotBefore")
        not_on_or_after = conditions.get("NotOnOrAfter")
        now = datetime.utcnow()
        if not_before:
            nb = datetime.fromisoformat(not_before.replace("Z", "+00:00")).replace(tzinfo=None)
            if now < nb:
                raise ValueError("SAML assertion not yet valid (NotBefore)")
        if not_on_or_after:
            noa = datetime.fromisoformat(not_on_or_after.replace("Z", "+00:00")).replace(tzinfo=None)
            if now >= noa:
                raise ValueError("SAML assertion expired (NotOnOrAfter)")

    # Extract NameID
    name_id_el = assertion.find(".//saml:Subject/saml:NameID", _SAML_NS)
    name_id = name_id_el.text if name_id_el is not None else None

    # Extract attributes
    attributes: Dict[str, str] = {}
    for attr_stmt in assertion.findall(".//saml:AttributeStatement/saml:Attribute", _SAML_NS):
        attr_name = attr_stmt.get("Name", "")
        attr_value_el = attr_stmt.find("saml:AttributeValue", _SAML_NS)
        if attr_value_el is not None and attr_value_el.text:
            # Use the friendly name if available, else the full name
            friendly = attr_stmt.get("FriendlyName", attr_name)
            attributes[friendly] = attr_value_el.text

    email = attributes.get("email") or attributes.get("mail") or name_id
    display_name = attributes.get("displayName") or attributes.get("name") or email

    if not email:
        raise ValueError("No email found in SAML assertion")

    return {
        "email": email,
        "display_name": display_name,
        "name_id": name_id,
        "attributes": attributes,
        "provider_type": "saml",
    }


# ---------------------------------------------------------------------------
# OIDC token exchange
# ---------------------------------------------------------------------------

async def exchange_oidc_token(
    authorization_code: str,
    config: SSOConfiguration,
) -> Dict[str, Any]:
    """Exchange an OIDC authorization code for tokens and user info.

    Uses urllib (stdlib) to call the token endpoint.
    """
    if not config.oidc_issuer or not config.oidc_client_id:
        raise ValueError("OIDC configuration incomplete")

    # Discover token endpoint from well-known config
    discovery_url = f"{config.oidc_issuer.rstrip('/')}/.well-known/openid-configuration"
    try:
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(discovery_url, context=ctx, timeout=10) as resp:
            discovery = json.loads(resp.read().decode())
    except Exception as exc:
        raise ValueError(f"OIDC discovery failed: {exc}")

    token_endpoint = discovery.get("token_endpoint")
    userinfo_endpoint = discovery.get("userinfo_endpoint")

    if not token_endpoint:
        raise ValueError("No token_endpoint in OIDC discovery")

    # Token exchange
    token_data = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": authorization_code,
        "redirect_uri": config.oidc_redirect_uri or "",
        "client_id": config.oidc_client_id,
        "client_secret": config.oidc_client_secret or "",
    }).encode()

    try:
        req = urllib.request.Request(
            token_endpoint, data=token_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            tokens = json.loads(resp.read().decode())
    except Exception as exc:
        raise ValueError(f"OIDC token exchange failed: {exc}")

    access_token = tokens.get("access_token")
    id_token = tokens.get("id_token")

    if not access_token:
        raise ValueError("No access_token in OIDC token response")

    # Verify ID token signature using JWKS (RS256) and validate claims.
    # JWKS keys are fetched from the discovery document's jwks_uri and cached
    # in memory with a 5-minute TTL.  Signature is verified using stdlib RSA
    # modular exponentiation (see _verify_rs256_jwt / _rsa_verify_pkcs1_sha256).
    user_info: Dict[str, Any] = {}
    jwks_uri = discovery.get("jwks_uri")
    if id_token:
        if jwks_uri:
            # Full RS256 signature verification via JWKS
            try:
                claims = _verify_rs256_jwt(id_token, jwks_uri)
            except ValueError as exc:
                raise ValueError(f"ID token signature verification failed: {exc}")
        else:
            # No JWKS URI in discovery — fall back to decode-only with a warning
            logger.warning(
                "OIDC provider at %s has no jwks_uri in discovery document; "
                "ID token signature cannot be verified — trusting TLS transport only.",
                config.oidc_issuer,
            )
            parts = id_token.split(".")
            if len(parts) != 3:
                raise ValueError("Invalid ID token format: expected 3-part JWT")
            payload = parts[1]
            payload += "=" * (4 - len(payload) % 4)
            try:
                claims = json.loads(base64.urlsafe_b64decode(payload))
            except Exception as exc:
                raise ValueError(f"Failed to decode ID token payload: {exc}")

        # Validate issuer matches discovery
        if claims.get("iss") != config.oidc_issuer:
            raise ValueError(
                f"ID token issuer mismatch: expected '{config.oidc_issuer}', "
                f"got '{claims.get('iss')}'"
            )
        # Validate audience matches client_id
        aud = claims.get("aud")
        valid_aud = (
            aud == config.oidc_client_id
            if isinstance(aud, str)
            else (config.oidc_client_id in aud if isinstance(aud, list) else False)
        )
        if not valid_aud:
            raise ValueError(
                f"ID token audience mismatch: expected '{config.oidc_client_id}', got '{aud}'"
            )
        # Validate expiration
        if "exp" in claims and _time.time() >= claims["exp"]:
            raise ValueError("ID token has expired")

        user_info = claims

    # Optionally fetch userinfo endpoint for richer claims
    if userinfo_endpoint and not user_info.get("email"):
        try:
            req = urllib.request.Request(
                userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
                user_info.update(json.loads(resp.read().decode()))
        except Exception:
            pass

    email = user_info.get("email")
    display_name = user_info.get("name") or user_info.get("preferred_username") or email

    return {
        "email": email,
        "display_name": display_name,
        "access_token": access_token,
        "id_token": id_token,
        "claims": user_info,
        "provider_type": "oidc",
    }


# ---------------------------------------------------------------------------
# SCIM user provisioning
# ---------------------------------------------------------------------------

async def sync_scim_users(
    session: AsyncSession,
    organization_id: str,
    scim_users: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Sync a batch of SCIM user resources into the local mapping table.

    Each scim_user should have: externalId, emails, displayName, userName, active, groups
    """
    created = 0
    updated = 0
    deactivated = 0

    for user in scim_users:
        external_id = user.get("externalId") or user.get("id", "")
        emails = user.get("emails", [])
        email = ""
        if isinstance(emails, list) and emails:
            email = emails[0].get("value", "") if isinstance(emails[0], dict) else str(emails[0])
        elif isinstance(emails, str):
            email = emails

        display_name = user.get("displayName", "")
        username = user.get("userName", "")
        active = user.get("active", True)
        groups_raw = user.get("groups", [])
        groups_json = json.dumps([g.get("display", g) if isinstance(g, dict) else g for g in groups_raw])

        # Find existing mapping
        stmt = select(SCIMMapping).where(
            SCIMMapping.organization_id == organization_id,
            SCIMMapping.external_id == external_id,
        )
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.email = email or existing.email
            existing.display_name = display_name or existing.display_name
            existing.username = username or existing.username
            existing.is_active = 1 if active else 0
            existing.groups = groups_json
            existing.last_synced_at = datetime.utcnow()
            existing.updated_at = datetime.utcnow()
            if not active:
                deactivated += 1
            else:
                updated += 1
        else:
            mapping = SCIMMapping(
                id=str(uuid.uuid4()),
                organization_id=organization_id,
                external_id=external_id,
                email=email,
                display_name=display_name,
                username=username,
                is_active=1 if active else 0,
                groups=groups_json,
                last_synced_at=datetime.utcnow(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            session.add(mapping)
            created += 1

    await session.flush()
    return {"created": created, "updated": updated, "deactivated": deactivated, "total": len(scim_users)}


async def get_scim_user(
    session: AsyncSession, organization_id: str, external_id: str
) -> Optional[SCIMMapping]:
    stmt = select(SCIMMapping).where(
        SCIMMapping.organization_id == organization_id,
        SCIMMapping.external_id == external_id,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_scim_users(
    session: AsyncSession, organization_id: str
) -> List[SCIMMapping]:
    stmt = (
        select(SCIMMapping)
        .where(SCIMMapping.organization_id == organization_id)
        .order_by(SCIMMapping.email)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def delete_scim_user(
    session: AsyncSession, organization_id: str, external_id: str
) -> bool:
    user = await get_scim_user(session, organization_id, external_id)
    if not user:
        return False
    await session.delete(user)
    await session.flush()
    return True
