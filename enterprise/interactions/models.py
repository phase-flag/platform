"""Interactions module — SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class InteractionTest(EnterpriseBase):
    """Request to detect flag interactions."""

    __tablename__ = "enterprise_interaction_tests"

    id = Column(String(36), primary_key=True, default=_uuid)
    environment = Column(String(100), nullable=False, default="production")
    metric_name = Column(String(255), nullable=False)
    num_observations = Column(Integer, nullable=False)
    # JSON: list of flag_keys involved
    flag_keys = Column(Text, nullable=False)
    # JSON: raw data passed in
    data_hash = Column(String(64), nullable=True)
    status = Column(String(20), nullable=False, default="completed")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class InteractionResult(EnterpriseBase):
    """Individual interaction detection result between a pair of flags."""

    __tablename__ = "enterprise_interaction_results"

    id = Column(String(36), primary_key=True, default=_uuid)
    test_id = Column(String(36), nullable=False, index=True)
    flag_a = Column(String(255), nullable=False)
    flag_b = Column(String(255), nullable=False)
    chi_squared = Column(Float, nullable=False)
    degrees_of_freedom = Column(Integer, nullable=False)
    p_value = Column(Float, nullable=False)
    cramers_v = Column(Float, nullable=False)
    is_significant = Column(Integer, nullable=False, default=0)
    effect_size = Column(String(20), nullable=False, default="negligible")
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
