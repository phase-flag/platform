"""Progressive delivery pipeline ORM models."""

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


class PipelineDB(Base):
    """Progressive delivery pipeline for staged rollouts."""

    __tablename__ = "pipelines"

    id = Column(String(36), primary_key=True, default=_uuid)
    flag_key = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, running, paused, completed, rolled_back
    current_stage_index = Column(Integer, nullable=False, default=0)
    environment = Column(String(255), nullable=True)
    template = Column(String(50), nullable=True)  # canary, blue_green, linear, custom
    created_by = Column(String(255), nullable=False, default="system")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.utcnow(),
        onupdate=lambda: datetime.utcnow(),
    )
    completed_at = Column(DateTime, nullable=True)

    stages = relationship(
        "PipelineStageDB",
        back_populates="pipeline",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="PipelineStageDB.stage_order",
    )


class PipelineStageDB(Base):
    """A stage within a progressive delivery pipeline."""

    __tablename__ = "pipeline_stages"

    id = Column(String(36), primary_key=True, default=_uuid)
    pipeline_id = Column(String(36), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False)
    stage_order = Column(Integer, nullable=False)
    name = Column(String(255), nullable=False)
    rollout_percentage = Column(Integer, nullable=False)  # 0-100
    duration_minutes = Column(Integer, nullable=True)  # How long to hold before auto-advance
    status = Column(String(20), nullable=False, default="pending")  # pending, active, completed, skipped
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    rollback_on_failure = Column(Boolean, nullable=False, default=True)
    health_check_url = Column(String(2048), nullable=True)
    success_threshold = Column(Float, nullable=True)  # e.g., 0.99 for 99% success rate

    pipeline = relationship("PipelineDB", back_populates="stages")


class RollbackRuleDB(Base):
    """Automated rollback rule tied to metric thresholds."""

    __tablename__ = "rollback_rules"

    id = Column(String(36), primary_key=True, default=_uuid)
    flag_key = Column(String(255), nullable=False, index=True)
    metric_name = Column(String(255), nullable=False)
    operator = Column(String(10), nullable=False)  # gt, lt, gte, lte
    threshold = Column(Float, nullable=False)
    window_minutes = Column(Integer, nullable=False, default=5)
    action = Column(String(20), nullable=False, default="disable")  # disable, rollback, alert
    active = Column(Boolean, nullable=False, default=True)
    last_triggered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
