"""Verification module — SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class VerificationResult(EnterpriseBase):
    """Stores the result of a formal verification check on flag rules."""

    __tablename__ = "enterprise_verification_results"

    id = Column(String(36), primary_key=True, default=_uuid)
    flag_key = Column(String(255), nullable=False, index=True)
    environment = Column(String(100), nullable=False, default="production")
    is_valid = Column(Integer, nullable=False, default=1)  # 0/1
    num_rules = Column(Integer, nullable=False, default=0)
    contradictions = Column(Text, nullable=True)  # JSON array
    dead_rules = Column(Text, nullable=True)  # JSON array
    unreachable_rules = Column(Text, nullable=True)  # JSON array
    overlapping_rules = Column(Text, nullable=True)  # JSON array
    warnings = Column(Text, nullable=True)  # JSON array
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
