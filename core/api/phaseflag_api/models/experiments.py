"""Experimentation ORM models."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class ExperimentDB(Base):
    """A/B or multivariate experiment."""

    __tablename__ = "experiments"

    id = Column(String(36), primary_key=True, default=_uuid)
    key = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    flag_key = Column(String(255), nullable=False, index=True)
    hypothesis = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="draft")  # draft, running, paused, completed, cancelled
    experiment_type = Column(String(20), nullable=False, default="ab")  # ab, multivariate
    traffic_percentage = Column(Integer, nullable=False, default=100)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    winner_variation_id = Column(String(36), nullable=True)
    created_by = Column(String(255), nullable=False, default="system")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.utcnow(),
        onupdate=lambda: datetime.utcnow(),
    )
    project_key = Column(String(255), nullable=True, index=True)

    goals = relationship(
        "ExperimentGoalDB",
        back_populates="experiment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    results = relationship(
        "ExperimentResultDB",
        back_populates="experiment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class ExperimentGoalDB(Base):
    """A metric/goal being tracked for an experiment."""

    __tablename__ = "experiment_goals"

    id = Column(String(36), primary_key=True, default=_uuid)
    experiment_id = Column(String(36), ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    metric_key = Column(String(255), nullable=False)
    goal_type = Column(String(20), nullable=False, default="conversion")  # conversion, revenue, numeric
    is_primary = Column(Boolean, nullable=False, default=False)
    min_sample_size = Column(Integer, nullable=True)

    experiment = relationship("ExperimentDB", back_populates="goals")


class ExperimentResultDB(Base):
    """Statistical results for an experiment variation."""

    __tablename__ = "experiment_results"

    id = Column(String(36), primary_key=True, default=_uuid)
    experiment_id = Column(String(36), ForeignKey("experiments.id", ondelete="CASCADE"), nullable=False)
    variation_key = Column(String(255), nullable=False)
    goal_id = Column(String(36), nullable=True)
    sample_size = Column(Integer, nullable=False, default=0)
    conversions = Column(Integer, nullable=False, default=0)
    conversion_rate = Column(Float, nullable=True)
    confidence_level = Column(Float, nullable=True)  # 0.0 - 1.0
    is_significant = Column(Boolean, nullable=False, default=False)
    is_winner = Column(Boolean, nullable=False, default=False)
    lift = Column(Float, nullable=True)  # Relative improvement over control
    computed_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())

    experiment = relationship("ExperimentDB", back_populates="results")
