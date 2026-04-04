"""Auth module — SQLAlchemy models for SSO and SCIM."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class SSOConfiguration(EnterpriseBase):
    """SSO identity provider configuration."""

    __tablename__ = "enterprise_sso_configurations"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), nullable=False, index=True)
    provider_type = Column(String(20), nullable=False)  # "saml" or "oidc"
    display_name = Column(String(255), nullable=False)
    # SAML fields
    idp_entity_id = Column(String(500), nullable=True)
    idp_sso_url = Column(String(500), nullable=True)
    idp_certificate = Column(Text, nullable=True)  # PEM-encoded X.509
    sp_entity_id = Column(String(500), nullable=True)
    sp_acs_url = Column(String(500), nullable=True)
    # OIDC fields
    oidc_issuer = Column(String(500), nullable=True)
    oidc_client_id = Column(String(255), nullable=True)
    oidc_client_secret = Column(Text, nullable=True)
    oidc_scopes = Column(String(500), nullable=True, default="openid profile email")
    oidc_redirect_uri = Column(String(500), nullable=True)
    # General
    is_active = Column(Integer, nullable=False, default=1)
    default_role = Column(String(50), nullable=False, default="viewer")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class SCIMMapping(EnterpriseBase):
    """Mapping between external SCIM user and internal identity."""

    __tablename__ = "enterprise_scim_mappings"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), nullable=False, index=True)
    external_id = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    username = Column(String(255), nullable=True)
    role = Column(String(50), nullable=False, default="viewer")
    is_active = Column(Integer, nullable=False, default=1)
    groups = Column(Text, nullable=True)  # JSON array of group names
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
