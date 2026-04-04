"""Sticky assignment ORM model."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, String, UniqueConstraint

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class StickyAssignmentDB(Base):
    __tablename__ = "sticky_assignments"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(255), nullable=False, index=True)
    flag_key = Column(String(255), nullable=False, index=True)
    variation_key = Column(String(255), nullable=False)
    environment = Column(String(50), nullable=False, default="production")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    __table_args__ = (
        UniqueConstraint(
            "user_id", "flag_key", "environment", name="uq_sticky_user_flag_env"
        ),
    )
