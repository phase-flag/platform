"""Audit log and evaluation event ORM models."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, String, Text

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class AuditLogDB(Base):
    """Immutable audit log entry for tracking changes."""

    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=_uuid)
    action = Column(String(20), nullable=False)
    entity_type = Column(String(50), nullable=False, default="flag")
    entity_id = Column(String(36), nullable=False)
    entity_key = Column(String(255), nullable=False, index=True)
    actor = Column(String(255), nullable=False, default="system")
    changes = Column(Text, nullable=False, default="{}")
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))


class EvaluationEventDB(Base):
    """Persisted SDK evaluation event for analytics."""

    __tablename__ = "evaluation_events"

    id = Column(String(36), primary_key=True, default=_uuid)
    flag_key = Column(String(255), nullable=False, index=True)
    variation_key = Column(String(255), nullable=True)
    user_id = Column(String(255), nullable=True)
    timestamp = Column(
        DateTime, nullable=False, default=lambda: datetime.now(UTC), index=True
    )
    event_metadata = Column("metadata", Text, nullable=False, default="{}")
