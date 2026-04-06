"""Migration flag ORM models."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class MigrationFlagDB(Base):
    """Migration flag with staged workflow support."""

    __tablename__ = "migration_flags"

    id = Column(String(36), primary_key=True, default=_uuid)
    flag_key = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    source_system = Column(String(255), nullable=True)
    target_system = Column(String(255), nullable=True)
    stage = Column(String(30), nullable=False, default="dual_read")  # dual_read, dual_write, shadow, cutover, cleanup
    rollout_percentage = Column(Integer, nullable=False, default=0)
    error_count = Column(Integer, nullable=False, default=0)
    success_count = Column(Integer, nullable=False, default=0)
    rollback_threshold = Column(Float, nullable=True)  # Error rate threshold for auto-rollback
    created_by = Column(String(255), nullable=False, default="system")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.utcnow(),
        onupdate=lambda: datetime.utcnow(),
    )
