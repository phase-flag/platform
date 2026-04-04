"""Governance models — change requests, service accounts, freeze windows."""

import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class ChangeRequestDB(Base):
    """Change request requiring approval before applying."""

    __tablename__ = "change_requests"

    id = Column(String(36), primary_key=True, default=_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    entity_type = Column(String(50), nullable=False, default="flag")  # flag, segment, environment
    entity_key = Column(String(255), nullable=False)
    change_type = Column(String(20), nullable=False)  # create, update, toggle, archive, delete
    payload = Column(Text, nullable=False, default="{}")  # JSON blob of the proposed change
    status = Column(String(20), nullable=False, default="pending")  # pending, approved, rejected, applied, cancelled
    requested_by = Column(String(255), nullable=False)
    reviewed_by = Column(String(255), nullable=True)
    review_comment = Column(Text, nullable=True)
    environment = Column(String(255), nullable=True)
    requires_approval_count = Column(Integer, nullable=False, default=1)
    approval_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    resolved_at = Column(DateTime, nullable=True)

    def get_payload(self) -> dict[str, Any]:
        return json.loads(self.payload) if self.payload else {}

    def set_payload(self, data: dict[str, Any]) -> None:
        self.payload = json.dumps(data)


class ServiceAccountDB(Base):
    """Service account for automated API access."""

    __tablename__ = "service_accounts"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    api_key = Column(String(255), nullable=False, unique=True, index=True)
    role = Column(String(20), nullable=False, default="viewer")
    scopes = Column(Text, nullable=False, default="[]")  # JSON array of scoped permissions
    active = Column(Boolean, nullable=False, default=True)
    created_by = Column(String(255), nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    def get_scopes(self) -> list[str]:
        return json.loads(self.scopes) if self.scopes else []

    def set_scopes(self, scopes: list[str]) -> None:
        self.scopes = json.dumps(scopes)


class FreezeWindowDB(Base):
    """Scheduled freeze window preventing changes to an environment."""

    __tablename__ = "freeze_windows"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(255), nullable=False)
    environment = Column(String(255), nullable=True)  # null = all environments
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    reason = Column(Text, nullable=True)
    created_by = Column(String(255), nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))


class BreakGlassEventDB(Base):
    """Emergency override event that bypasses freeze windows and approval requirements."""

    __tablename__ = "break_glass_events"

    id = Column(String(36), primary_key=True, default=_uuid)
    flag_key = Column(String(255), nullable=False, index=True)
    environment = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)  # toggle, update, override
    reason = Column(Text, nullable=False)
    performed_by = Column(String(255), nullable=False)
    approved_by = Column(String(255), nullable=True)
    changes_json = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # auto-revert time
    reverted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
