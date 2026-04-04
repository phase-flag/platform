"""Simulation module — SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class SimulationRun(EnterpriseBase):
    """A Monte Carlo simulation run."""

    __tablename__ = "enterprise_simulation_runs"

    id = Column(String(36), primary_key=True, default=_uuid)
    flag_key = Column(String(255), nullable=False, index=True)
    environment = Column(String(100), nullable=False, default="production")
    description = Column(Text, nullable=True)
    num_iterations = Column(Integer, nullable=False, default=10000)
    num_users = Column(Integer, nullable=False, default=1000)
    rollout_percentage = Column(Float, nullable=False, default=100.0)
    baseline_conversion_rate = Column(Float, nullable=False)
    treatment_effect = Column(Float, nullable=False, default=0.0)  # relative lift
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class SimulationResult(EnterpriseBase):
    """Aggregated result of a simulation run."""

    __tablename__ = "enterprise_simulation_results"

    id = Column(String(36), primary_key=True, default=_uuid)
    run_id = Column(String(36), nullable=False, index=True)
    mean_impact = Column(Float, nullable=False)
    median_impact = Column(Float, nullable=False)
    std_dev = Column(Float, nullable=False)
    p5_impact = Column(Float, nullable=False)  # 5th percentile
    p25_impact = Column(Float, nullable=False)
    p75_impact = Column(Float, nullable=False)
    p95_impact = Column(Float, nullable=False)  # 95th percentile
    prob_positive = Column(Float, nullable=False)
    prob_negative = Column(Float, nullable=False)
    worst_case = Column(Float, nullable=False)
    best_case = Column(Float, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
