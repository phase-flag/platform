"""Remote configuration ORM models."""

import json
from datetime import datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class RemoteConfigDB(Base):
    """First-class typed remote configuration value."""

    __tablename__ = "remote_configs"

    id = Column(String(36), primary_key=True, default=_uuid)
    key = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    config_type = Column(String(20), nullable=False, default="string")  # string, number, boolean, json
    value = Column(Text, nullable=False)  # JSON-encoded
    default_value = Column(Text, nullable=False)  # JSON-encoded fallback
    environment = Column(String(255), nullable=False, default="development")
    schema_definition = Column(Text, nullable=True)  # JSON Schema for validation
    is_server_only = Column(Boolean, nullable=False, default=False)  # If true, not sent to client SDKs
    version = Column(Integer, nullable=False, default=1)
    owner = Column(String(255), nullable=False, default="system")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.utcnow())
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.utcnow(),
        onupdate=lambda: datetime.utcnow(),
    )

    def get_value(self) -> Any:
        return json.loads(self.value) if self.value else None

    def set_value(self, val: Any) -> None:
        self.value = json.dumps(val)

    def get_default_value(self) -> Any:
        return json.loads(self.default_value) if self.default_value else None

    def get_schema(self) -> dict[str, Any] | None:
        return json.loads(self.schema_definition) if self.schema_definition else None
