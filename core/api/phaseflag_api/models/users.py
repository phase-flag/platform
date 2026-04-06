"""User ORM model."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, String

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class UserDB(Base):
    """Registered dashboard / API user."""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="viewer")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.utcnow())
