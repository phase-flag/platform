"""Feature flag and variation ORM models."""

import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class FeatureFlagDB(Base):
    """Persistent representation of a feature flag."""

    __tablename__ = "feature_flags"

    id = Column(String(36), primary_key=True, default=_uuid)
    key = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    flag_type = Column(String(20), nullable=False, default="boolean")
    status = Column(String(20), nullable=False, default="inactive")
    environment = Column(String(20), nullable=False, default="development")
    default_variation_id = Column(String(36), nullable=False)
    tags = Column(Text, nullable=False, default="[]")

    # Scheduling
    scheduled_on = Column(DateTime, nullable=True)
    scheduled_status = Column(String(20), nullable=True)

    # Prerequisites — JSON array of {flag_key, variation_key}
    prerequisites = Column(Text, nullable=False, default="[]")

    # Lifecycle — development, testing, production, stale, archived
    lifecycle_stage = Column(String(20), nullable=False, default="development")

    # Phase 1.1 — Enhanced flag model
    flag_classification = Column(
        String(20), nullable=False, default="release"
    )  # release, experiment, ops_killswitch, permission, migration
    is_permanent = Column(Boolean, nullable=False, default=False)
    expires_at = Column(DateTime, nullable=True)
    ticket_url = Column(String(2048), nullable=True)
    runbook_url = Column(String(2048), nullable=True)
    owner_team = Column(String(255), nullable=True)

    # Namespace/workspace partitioning
    namespace = Column(String(255), nullable=True, index=True)

    # Metadata
    created_by = Column(String(255), nullable=False, default="system")
    owner = Column(String(255), nullable=False, default="system")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    last_evaluated_at = Column(DateTime, nullable=True)
    evaluation_count = Column(Integer, nullable=False, default=0)

    # Relationships
    variations = relationship(
        "VariationDB",
        back_populates="flag",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    targeting_rules = Column(Text, nullable=False, default="[]")

    def get_tags(self) -> list[str]:
        return json.loads(self.tags) if self.tags else []

    def set_tags(self, tags: list[str]) -> None:
        self.tags = json.dumps(tags)

    def get_targeting_rules(self) -> list[dict[str, Any]]:
        return json.loads(self.targeting_rules) if self.targeting_rules else []

    def set_targeting_rules(self, rules: list[dict[str, Any]]) -> None:
        self.targeting_rules = json.dumps(rules)

    def get_prerequisites(self) -> list[dict[str, str]]:
        return json.loads(self.prerequisites) if self.prerequisites else []

    def set_prerequisites(self, prereqs: list[dict[str, str]]) -> None:
        self.prerequisites = json.dumps(prereqs)


class VariationDB(Base):
    """A variation belonging to a feature flag."""

    __tablename__ = "variations"

    id = Column(String(36), primary_key=True, default=_uuid)
    flag_id = Column(String(36), ForeignKey("feature_flags.id", ondelete="CASCADE"), nullable=False)
    key = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)

    flag = relationship("FeatureFlagDB", back_populates="variations")

    def get_value(self) -> Any:
        return json.loads(self.value)

    def set_value(self, val: Any) -> None:
        self.value = json.dumps(val)
