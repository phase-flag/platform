"""Analytics module — SQLAlchemy models for A/B test results."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class ABTestResult(EnterpriseBase):
    """Stores the outcome of a frequentist or Bayesian A/B test."""

    __tablename__ = "enterprise_ab_test_results"

    id = Column(String(36), primary_key=True, default=_uuid)
    experiment_id = Column(String(255), nullable=False, index=True)
    test_type = Column(String(20), nullable=False)  # "frequentist" | "bayesian"
    variant_a_name = Column(String(255), nullable=False, default="control")
    variant_b_name = Column(String(255), nullable=False, default="treatment")
    variant_a_count = Column(Integer, nullable=False)
    variant_a_successes = Column(Integer, nullable=False)
    variant_b_count = Column(Integer, nullable=False)
    variant_b_successes = Column(Integer, nullable=False)
    p_value = Column(Float, nullable=True)  # frequentist
    z_score = Column(Float, nullable=True)  # frequentist
    confidence_level = Column(Float, nullable=True)  # frequentist
    prob_b_beats_a = Column(Float, nullable=True)  # bayesian
    expected_loss = Column(Float, nullable=True)  # bayesian
    credible_interval_low = Column(Float, nullable=True)  # bayesian
    credible_interval_high = Column(Float, nullable=True)  # bayesian
    is_significant = Column(Integer, nullable=False, default=0)  # 0/1
    recommendation = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class MetricSnapshot(EnterpriseBase):
    """Point-in-time metric value for an experiment."""

    __tablename__ = "enterprise_metric_snapshots"

    id = Column(String(36), primary_key=True, default=_uuid)
    experiment_id = Column(String(255), nullable=False, index=True)
    variant = Column(String(255), nullable=False)
    metric_name = Column(String(255), nullable=False)
    metric_value = Column(Float, nullable=False)
    sample_size = Column(Integer, nullable=False)
    captured_at = Column(DateTime, nullable=False, default=datetime.utcnow)
