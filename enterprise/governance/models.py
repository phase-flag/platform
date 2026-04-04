"""Governance module — SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class PolicyRule(EnterpriseBase):
    """A governance policy rule (freeze windows, change controls, etc.)."""

    __tablename__ = "enterprise_governance_policy_rules"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), nullable=False, index=True)
    environment = Column(String(100), nullable=True)  # None = applies to all
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    policy_type = Column(String(50), nullable=False)
    # Types: freeze_window, require_approval, two_person_rule,
    #        break_glass, role_restriction, change_window
    rule_definition = Column(Text, nullable=False)  # JSON
    is_active = Column(Integer, nullable=False, default=1)
    priority = Column(Integer, nullable=False, default=100)
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditTrail(EnterpriseBase):
    """Immutable audit trail of governance-relevant actions."""

    __tablename__ = "enterprise_governance_audit_trail"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), nullable=False, index=True)
    environment = Column(String(100), nullable=True)
    action = Column(String(100), nullable=False)  # flag.create, flag.toggle, policy.override, break_glass
    resource_type = Column(String(50), nullable=False)  # flag, policy, environment, user
    resource_id = Column(String(255), nullable=True)
    actor = Column(String(255), nullable=False)
    actor_role = Column(String(50), nullable=True)
    details = Column(Text, nullable=True)  # JSON: before/after diff, reason, etc.
    policy_id = Column(String(36), nullable=True)  # which policy was evaluated
    policy_result = Column(String(20), nullable=True)  # allowed, denied, break_glass
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
