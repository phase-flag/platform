"""Counterfactual module — SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class CounterfactualQuery(EnterpriseBase):
    """A 'what if' query definition."""

    __tablename__ = "enterprise_counterfactual_queries"

    id = Column(String(36), primary_key=True, default=_uuid)
    flag_key = Column(String(255), nullable=False, index=True)
    environment = Column(String(100), nullable=False, default="production")
    original_variation = Column(String(255), nullable=False)
    counterfactual_variation = Column(String(255), nullable=False)
    metric_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    # Historical data supplied as JSON
    historical_data = Column(Text, nullable=False)  # JSON array of observations
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class CounterfactualResult(EnterpriseBase):
    """Result of a counterfactual analysis."""

    __tablename__ = "enterprise_counterfactual_results"

    id = Column(String(36), primary_key=True, default=_uuid)
    query_id = Column(String(36), nullable=False, index=True)
    estimated_effect = Column(Float, nullable=False)
    confidence_interval_low = Column(Float, nullable=False)
    confidence_interval_high = Column(Float, nullable=False)
    original_mean = Column(Float, nullable=False)
    counterfactual_mean = Column(Float, nullable=False)
    sample_size = Column(Integer, nullable=False)
    method = Column(String(100), nullable=False)  # "difference_in_means", "ipw", etc.
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
