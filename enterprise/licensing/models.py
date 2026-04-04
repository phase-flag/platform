"""Licensing module — SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class LicenseRecord(EnterpriseBase):
    """A validated enterprise license."""

    __tablename__ = "enterprise_license_records"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), nullable=False, index=True)
    license_key = Column(Text, nullable=False)  # the JWT token
    license_id = Column(String(255), nullable=True, unique=True)  # 'jti' from JWT
    plan = Column(String(50), nullable=False, default="enterprise")
    issued_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    max_seats = Column(Integer, nullable=True)
    max_flags = Column(Integer, nullable=True)
    max_environments = Column(Integer, nullable=True)
    # JSON list of entitled feature keys
    features = Column(Text, nullable=False, default="[]")
    is_valid = Column(Integer, nullable=False, default=1)
    validation_error = Column(Text, nullable=True)
    validated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
