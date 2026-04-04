"""Compliance module — SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class CompliancePolicy(EnterpriseBase):
    """A compliance policy rule (e.g. GDPR, HIPAA, SOC 2)."""

    __tablename__ = "enterprise_compliance_policies"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), nullable=False, index=True)
    framework = Column(String(50), nullable=False)  # gdpr, hipaa, soc2, custom
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    # JSON-encoded rule definition
    rule_definition = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False, default="medium")  # low, medium, high, critical
    is_active = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ComplianceEvidence(EnterpriseBase):
    """Evidence record for compliance audits."""

    __tablename__ = "enterprise_compliance_evidence"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), nullable=False, index=True)
    policy_id = Column(String(36), nullable=True, index=True)
    framework = Column(String(50), nullable=False)
    evidence_type = Column(String(50), nullable=False)  # audit_log, config_snapshot, access_review
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    data = Column(Text, nullable=True)  # JSON payload
    status = Column(String(20), nullable=False, default="collected")  # collected, reviewed, approved
    collected_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    reviewed_by = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)


class DataRetentionRule(EnterpriseBase):
    """Data retention policy rule."""

    __tablename__ = "enterprise_data_retention_rules"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), nullable=False, index=True)
    data_type = Column(String(100), nullable=False)  # evaluation_logs, audit_logs, user_data
    retention_days = Column(Integer, nullable=False)
    action = Column(String(20), nullable=False, default="delete")  # delete, anonymize, archive
    is_active = Column(Integer, nullable=False, default=1)
    last_applied_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
