"""Notification configuration ORM model."""

import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, String, Text

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class NotificationConfigDB(Base):
    """Per-project notification channel configuration (Slack / Teams)."""

    __tablename__ = "notification_configs"

    id = Column(String(36), primary_key=True, default=_uuid)
    project_id = Column(String(255), nullable=False, index=True)
    provider = Column(String(32), nullable=False)  # "slack" | "teams"
    webhook_url = Column(String(2048), nullable=False)
    # JSON list of event types this config is subscribed to, e.g.
    # ["flag.created", "flag.toggled", "flag.archived", "approval.requested", "freeze.activated"]
    events = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())

    def get_events(self) -> list[str]:
        return json.loads(self.events) if self.events else []

    def set_events(self, events: list[str]) -> None:
        self.events = json.dumps(events)
