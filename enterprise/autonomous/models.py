"""Autonomous module — SQLAlchemy models for Thompson Sampling bandits."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class BanditArm(EnterpriseBase):
    """An arm in a multi-armed bandit (maps to a flag variation)."""

    __tablename__ = "enterprise_bandit_arms"

    id = Column(String(36), primary_key=True, default=_uuid)
    flag_key = Column(String(255), nullable=False, index=True)
    variation = Column(String(255), nullable=False)
    alpha = Column(Float, nullable=False, default=1.0)  # Beta prior successes + 1
    beta = Column(Float, nullable=False, default=1.0)  # Beta prior failures + 1
    total_selections = Column(Integer, nullable=False, default=0)
    total_rewards = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class BanditReward(EnterpriseBase):
    """Individual reward event for audit trail."""

    __tablename__ = "enterprise_bandit_rewards"

    id = Column(String(36), primary_key=True, default=_uuid)
    arm_id = Column(String(36), nullable=False, index=True)
    flag_key = Column(String(255), nullable=False, index=True)
    user_id = Column(String(255), nullable=True)
    reward = Column(Float, nullable=False)  # 0.0 or 1.0 for Bernoulli
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
