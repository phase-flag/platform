"""SSO endpoints — SAML 2.0, OIDC, and SCIM provisioning."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from phaseflag_api.middleware.auth import require_api_key, require_role

router = APIRouter(dependencies=[Depends(require_api_key)])


# --- Schemas ---

class SAMLConfig(BaseModel):
    entity_id: str
    sso_url: str
    certificate: str


class OIDCConfig(BaseModel):
    issuer: str
    client_id: str
    client_secret: str
    redirect_uri: str


class SCIMUser(BaseModel):
    userName: str
    name: dict  # {"givenName": "...", "familyName": "..."}
    emails: list[dict]
    active: bool = True


# In-memory config storage (enterprise module would persist to DB)
_saml_config: dict | None = None
_oidc_config: dict | None = None
_scim_users: dict[str, dict] = {}


# --- SAML 2.0 ---

@router.post("/sso/saml/configure", dependencies=[require_role("admin")])
async def configure_saml(config: SAMLConfig):
    """Configure SAML 2.0 identity provider settings."""
    global _saml_config
    _saml_config = config.model_dump()
    return {"status": "configured", "entity_id": config.entity_id}


@router.get("/sso/saml/metadata")
async def saml_metadata():
    """Return SAML service provider metadata."""
    if not _saml_config:
        raise HTTPException(status_code=404, detail="SAML not configured")
    return {"entity_id": _saml_config["entity_id"], "sso_url": _saml_config["sso_url"]}


@router.post("/sso/saml/acs")
async def saml_assertion_consumer(body: dict):
    """SAML Assertion Consumer Service endpoint."""
    if not _saml_config:
        raise HTTPException(status_code=400, detail="SAML not configured")
    return {
        "status": "ok",
        "message": "SAML assertion processed (enterprise module required for full validation)",
    }


# --- OIDC ---

@router.post("/sso/oidc/configure", dependencies=[require_role("admin")])
async def configure_oidc(config: OIDCConfig):
    """Configure OIDC identity provider settings."""
    global _oidc_config
    _oidc_config = config.model_dump()
    _oidc_config.pop("client_secret")  # Don't return secret
    return {"status": "configured", "issuer": config.issuer}


@router.get("/sso/oidc/authorize")
async def oidc_authorize():
    """Initiate OIDC authorization flow."""
    if not _oidc_config:
        raise HTTPException(status_code=400, detail="OIDC not configured")
    return {
        "authorize_url": f"{_oidc_config['issuer']}/authorize",
        "client_id": _oidc_config["client_id"],
    }


@router.post("/sso/oidc/callback")
async def oidc_callback(code: str = ""):
    """Handle OIDC authorization callback."""
    if not _oidc_config:
        raise HTTPException(status_code=400, detail="OIDC not configured")
    return {
        "status": "ok",
        "message": "OIDC callback processed (enterprise module required for full token exchange)",
    }


# --- SCIM 2.0 ---

@router.get("/scim/v2/Users")
async def scim_list_users():
    """List provisioned users (SCIM 2.0)."""
    return {
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        "totalResults": len(_scim_users),
        "Resources": list(_scim_users.values()),
    }


@router.post("/scim/v2/Users", status_code=201)
async def scim_create_user(user: SCIMUser):
    """Provision a new user (SCIM 2.0)."""
    user_dict = user.model_dump()
    user_dict["id"] = str(len(_scim_users) + 1)
    _scim_users[user.userName] = user_dict
    return user_dict


@router.get("/scim/v2/Users/{user_id}")
async def scim_get_user(user_id: str):
    """Get a provisioned user by ID (SCIM 2.0)."""
    for u in _scim_users.values():
        if u.get("id") == user_id:
            return u
    raise HTTPException(status_code=404, detail="User not found")


@router.put("/scim/v2/Users/{user_id}")
async def scim_update_user(user_id: str, user: SCIMUser):
    """Update a provisioned user (SCIM 2.0)."""
    for key, u in _scim_users.items():
        if u.get("id") == user_id:
            updated = user.model_dump()
            updated["id"] = user_id
            _scim_users[key] = updated
            return updated
    raise HTTPException(status_code=404, detail="User not found")


@router.delete("/scim/v2/Users/{user_id}", status_code=204)
async def scim_delete_user(user_id: str):
    """Delete a provisioned user (SCIM 2.0)."""
    for key, u in list(_scim_users.items()):
        if u.get("id") == user_id:
            del _scim_users[key]
            return
    raise HTTPException(status_code=404, detail="User not found")
