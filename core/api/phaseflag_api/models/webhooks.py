"""Webhook and exclusion group ORM models."""

import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, String, Text

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class WebhookDB(Base):
    """Webhook configuration for event notifications."""

    __tablename__ = "webhooks"

    id = Column(String(36), primary_key=True, default=_uuid)
    url = Column(String(2048), nullable=False)
    events = Column(Text, nullable=False, default="[]")
    secret = Column(String(255), nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())

    def get_events(self) -> list[str]:
        return json.loads(self.events) if self.events else []

    def set_events(self, events: list[str]) -> None:
        self.events = json.dumps(events)


class ExclusionGroupDB(Base):
    """Mutual exclusion group."""

    __tablename__ = "exclusion_groups"

    id = Column(String(36), primary_key=True, default=_uuid)
    key = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    member_flag_keys = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())

    def get_member_flag_keys(self) -> list[str]:
        return json.loads(self.member_flag_keys) if self.member_flag_keys else []

    def set_member_flag_keys(self, keys: list[str]) -> None:
        self.member_flag_keys = json.dumps(keys)
