"""Usage metering ORM model."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, Integer, String, Text

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class UsageRecordDB(Base):
    """Monthly usage record — tracks unique user keys (MTU) per org per month."""

    __tablename__ = "usage_records"

    id = Column(String(36), primary_key=True, default=_uuid)
    org_id = Column(String(36), nullable=False, index=True)
    month = Column(String(7), nullable=False)  # e.g. "2026-04"
    # JSON array of unique user key strings seen this month
    unique_users = Column(Text, nullable=False, default="[]")
    count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.utcnow(),
        onupdate=lambda: datetime.utcnow(),
    )
