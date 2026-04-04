"""Auth router — SSO (SAML/OIDC) and SCIM endpoints."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from . import service

router = APIRouter()


async def _get_session():
    raise RuntimeError("Override _get_session dependency in host app.")


# -- Schemas --

class SSOConfigCreate(BaseModel):
    organization_id: str
    provider_type: str  # "saml" or "oidc"
    display_name: str
    # SAML
    idp_entity_id: Optional[str] = None
    idp_sso_url: Optional[str] = None
    idp_certificate: Optional[str] = None
    sp_entity_id: Optional[str] = None
    sp_acs_url: Optional[str] = None
    # OIDC
    oidc_issuer: Optional[str] = None
    oidc_client_id: Optional[str] = None
    oidc_client_secret: Optional[str] = None
    oidc_scopes: Optional[str] = "openid profile email"
    oidc_redirect_uri: Optional[str] = None
    default_role: str = "viewer"


class SSOConfigResponse(BaseModel):
    id: str
    organization_id: str
    provider_type: str
    display_name: str
    is_active: bool
    default_role: str
    created_at: str
    # Omit secrets from response


class SAMLRequest(BaseModel):
    saml_response: str  # Base64-encoded
    config_id: str


class OIDCCallbackRequest(BaseModel):
    authorization_code: str
    config_id: str


class AuthResult(BaseModel):
    email: Optional[str]
    display_name: Optional[str]
    provider_type: str
    claims: Optional[Dict[str, Any]] = None


class SCIMUserResource(BaseModel):
    externalId: Optional[str] = None
    id: Optional[str] = None
    emails: Optional[Any] = None
    displayName: Optional[str] = None
    userName: Optional[str] = None
    active: bool = True
    groups: Optional[List[Any]] = None


class SCIMBulkSync(BaseModel):
    organization_id: str
    users: List[SCIMUserResource]


class SCIMUserResponse(BaseModel):
    id: str
    external_id: str
    email: str
    display_name: Optional[str]
    username: Optional[str]
    role: str
    is_active: bool
    groups: Optional[List[str]]
    last_synced_at: Optional[str]


# -- SSO Config Endpoints --

@router.post("/sso/configs", response_model=SSOConfigResponse)
async def create_sso(body: SSOConfigCreate, session=Depends(_get_session)):
    config = await service.create_sso_config(
        session, **body.model_dump(),
    )
    await session.commit()
    return SSOConfigResponse(
        id=config.id, organization_id=config.organization_id,
        provider_type=config.provider_type, display_name=config.display_name,
        is_active=bool(config.is_active), default_role=config.default_role,
        created_at=config.created_at.isoformat(),
    )


@router.get("/sso/configs", response_model=List[SSOConfigResponse])
async def list_sso(
    organization_id: Optional[str] = Query(None),
    session=Depends(_get_session),
):
    configs = await service.list_sso_configs(session, organization_id)
    return [
        SSOConfigResponse(
            id=c.id, organization_id=c.organization_id,
            provider_type=c.provider_type, display_name=c.display_name,
            is_active=bool(c.is_active), default_role=c.default_role,
            created_at=c.created_at.isoformat(),
        )
        for c in configs
    ]


@router.get("/sso/configs/{config_id}", response_model=SSOConfigResponse)
async def get_sso(config_id: str, session=Depends(_get_session)):
    config = await service.get_sso_config(session, config_id)
    if not config:
        raise HTTPException(404, "SSO configuration not found")
    return SSOConfigResponse(
        id=config.id, organization_id=config.organization_id,
        provider_type=config.provider_type, display_name=config.display_name,
        is_active=bool(config.is_active), default_role=config.default_role,
        created_at=config.created_at.isoformat(),
    )


@router.delete("/sso/configs/{config_id}")
async def delete_sso(config_id: str, session=Depends(_get_session)):
    deleted = await service.delete_sso_config(session, config_id)
    if not deleted:
        raise HTTPException(404, "SSO configuration not found")
    await session.commit()
    return {"deleted": True}


# -- SAML ACS --

@router.post("/saml/acs", response_model=AuthResult)
async def saml_acs(body: SAMLRequest, session=Depends(_get_session)):
    config = await service.get_sso_config(session, body.config_id)
    if not config:
        raise HTTPException(404, "SSO configuration not found")
    try:
        result = service.validate_saml_assertion(body.saml_response, config)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return AuthResult(
        email=result.get("email"),
        display_name=result.get("display_name"),
        provider_type="saml",
        claims=result.get("attributes"),
    )


# -- OIDC Callback --

@router.post("/oidc/callback", response_model=AuthResult)
async def oidc_callback(body: OIDCCallbackRequest, session=Depends(_get_session)):
    config = await service.get_sso_config(session, body.config_id)
    if not config:
        raise HTTPException(404, "SSO configuration not found")
    try:
        result = await service.exchange_oidc_token(body.authorization_code, config)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return AuthResult(
        email=result.get("email"),
        display_name=result.get("display_name"),
        provider_type="oidc",
        claims=result.get("claims"),
    )


# -- SCIM Endpoints --

@router.post("/scim/sync")
async def scim_sync(body: SCIMBulkSync, session=Depends(_get_session)):
    users_dicts = [u.model_dump() for u in body.users]
    result = await service.sync_scim_users(session, body.organization_id, users_dicts)
    await session.commit()
    return result


@router.get("/scim/users", response_model=List[SCIMUserResponse])
async def list_scim_users(
    organization_id: str = Query(...),
    session=Depends(_get_session),
):
    users = await service.list_scim_users(session, organization_id)
    return [
        SCIMUserResponse(
            id=u.id, external_id=u.external_id, email=u.email,
            display_name=u.display_name, username=u.username,
            role=u.role, is_active=bool(u.is_active),
            groups=json.loads(u.groups) if u.groups else None,
            last_synced_at=u.last_synced_at.isoformat() if u.last_synced_at else None,
        )
        for u in users
    ]


@router.get("/scim/users/{external_id}", response_model=SCIMUserResponse)
async def get_scim_user(
    external_id: str,
    organization_id: str = Query(...),
    session=Depends(_get_session),
):
    user = await service.get_scim_user(session, organization_id, external_id)
    if not user:
        raise HTTPException(404, "SCIM user not found")
    return SCIMUserResponse(
        id=user.id, external_id=user.external_id, email=user.email,
        display_name=user.display_name, username=user.username,
        role=user.role, is_active=bool(user.is_active),
        groups=json.loads(user.groups) if user.groups else None,
        last_synced_at=user.last_synced_at.isoformat() if user.last_synced_at else None,
    )


@router.delete("/scim/users/{external_id}")
async def delete_scim_user(
    external_id: str,
    organization_id: str = Query(...),
    session=Depends(_get_session),
):
    deleted = await service.delete_scim_user(session, organization_id, external_id)
    if not deleted:
        raise HTTPException(404, "SCIM user not found")
    await session.commit()
    return {"deleted": True}
