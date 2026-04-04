"""Environment ORM model with per-environment API keys and settings."""

import json
import secrets
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


def _generate_api_key() -> str:
    return f"pf_env_{secrets.token_urlsafe(32)}"


class EnvironmentDB(Base):
    """Deployment environment within a project."""

    __tablename__ = "environments"

    id = Column(String(36), primary_key=True, default=_uuid)
    project_id = Column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    slug = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(7), nullable=True)  # Hex color for UI
    api_key = Column(
        String(255), nullable=False, unique=True, default=_generate_api_key
    )
    is_production = Column(Boolean, nullable=False, default=False)
    frozen = Column(Boolean, nullable=False, default=False)
    frozen_reason = Column(Text, nullable=True)
    settings = Column(
        Text, nullable=False, default="{}"
    )  # JSON blob for env-specific settings
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    project = relationship("ProjectDB", back_populates="environments")

    def get_settings(self) -> dict[str, Any]:
        return json.loads(self.settings) if self.settings else {}

    def set_settings(self, s: dict[str, Any]) -> None:
        self.settings = json.dumps(s)

    def rotate_api_key(self) -> str:
        self.api_key = _generate_api_key()
        return self.api_key
