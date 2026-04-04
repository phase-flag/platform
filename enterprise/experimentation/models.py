"""Experimentation module — SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class ExperimentLayer(EnterpriseBase):
    """A traffic layer that partitions users into non-overlapping experiments."""

    __tablename__ = "enterprise_experiment_layers"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    total_traffic = Column(Float, nullable=False, default=100.0)
    allocated_traffic = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class MutualExclusionGroup(EnterpriseBase):
    """An experiment assigned to a layer, consuming a slice of traffic."""

    __tablename__ = "enterprise_mutual_exclusion_groups"

    id = Column(String(36), primary_key=True, default=_uuid)
    layer_id = Column(String(36), nullable=False, index=True)
    experiment_id = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    traffic_start = Column(Float, nullable=False)  # e.g. 0.0
    traffic_end = Column(Float, nullable=False)  # e.g. 25.0
    status = Column(String(20), nullable=False, default="active")  # active, paused, completed
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
