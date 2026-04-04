"""Audience segment ORM model."""

import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Column, DateTime, String, Text

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class SegmentDB(Base):
    """Reusable audience segment."""

    __tablename__ = "segments"

    id = Column(String(36), primary_key=True, default=_uuid)
    key = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    conditions = Column(Text, nullable=False, default="[]")
    created_by = Column(String(255), nullable=False, default="system")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    def get_conditions(self) -> list[dict[str, Any]]:
        return json.loads(self.conditions) if self.conditions else []

    def set_conditions(self, conds: list[dict[str, Any]]) -> None:
        self.conditions = json.dumps(conds)
