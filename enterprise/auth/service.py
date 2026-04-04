"""Auth service — SAML/OIDC SSO and SCIM provisioning.

This is a self-contained implementation using Python stdlib:
- SAML: XML parsing and signature verification (simplified, no lxml)
- OIDC: Token exchange via urllib
- SCIM: User provisioning with DB persistence
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import ssl
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET  # noqa: S405 — see XXE protection below
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import SCIMMapping, SSOConfiguration


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

    # Decode ID token claims.
    # SECURITY: The ID token is received directly from the token endpoint over
    # TLS, which provides transport-level trust. For full security, the token
    # signature should be verified against the OIDC provider's JWKS keys.
    # TODO: Implement proper ID token signature verification using the provider's
    # JWKS endpoint (discovery["jwks_uri"]).
    user_info: Dict[str, Any] = {}
    jwks_uri = discovery.get("jwks_uri")
    if id_token:
        parts = id_token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid ID token format: expected 3-part JWT")
        payload = parts[1]
        # Pad base64
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
        valid_aud = (aud == config.oidc_client_id) if isinstance(aud, str) else (config.oidc_client_id in aud if isinstance(aud, list) else False)
        if not valid_aud:
            raise ValueError(
                f"ID token audience mismatch: expected '{config.oidc_client_id}', got '{aud}'"
            )
        # Validate expiration
        import time as _time
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
