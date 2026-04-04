"""FinOps module — SQLAlchemy models for cost attribution."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class CostEntry(EnterpriseBase):
    """An individual cost record attributed to a flag."""

    __tablename__ = "enterprise_cost_entries"

    id = Column(String(36), primary_key=True, default=_uuid)
    flag_key = Column(String(255), nullable=False, index=True)
    environment = Column(String(100), nullable=False, default="production")
    team = Column(String(255), nullable=True, index=True)
    service = Column(String(255), nullable=True)
    resource_type = Column(String(100), nullable=True)  # compute, storage, network, etc.
    cost_amount = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False, default="USD")
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class CostReport(EnterpriseBase):
    """Aggregated cost report."""

    __tablename__ = "enterprise_cost_reports"

    id = Column(String(36), primary_key=True, default=_uuid)
    report_type = Column(String(50), nullable=False)  # by_flag, by_team, by_service
    filter_key = Column(String(255), nullable=True)  # flag_key, team name, etc.
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)
    total_cost = Column(Float, nullable=False)
    num_entries = Column(Integer, nullable=False)
    breakdown = Column(Text, nullable=True)  # JSON breakdown
    currency = Column(String(10), nullable=False, default="USD")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
