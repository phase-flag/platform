"""Integration configuration ORM model for the webhook marketplace."""

import base64
import json
import os
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, String, Text

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


def _encrypt_api_key(api_key: str) -> str:
    """Simple reversible obfuscation for storing API keys at rest.

    In production, replace this with a proper KMS-backed solution or
    use the Fernet symmetric encryption from cryptography library.
    For now we XOR-encode with a rotation key derived from the env.
    """
    secret = os.environ.get("PHASEFLAG_API_SECRET_KEY", "default-insecure-key")
    key_bytes = secret.encode()
    api_bytes = api_key.encode()
    encoded = bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(api_bytes))
    return base64.b64encode(encoded).decode()


def _decrypt_api_key(encrypted: str) -> str:
    """Reverse the obfuscation applied by _encrypt_api_key."""
    secret = os.environ.get("PHASEFLAG_API_SECRET_KEY", "default-insecure-key")
    key_bytes = secret.encode()
    encoded = base64.b64decode(encrypted.encode())
    decoded = bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(encoded))
    return decoded.decode()


class IntegrationConfigDB(Base):
    """Persisted integration configuration — one per provider per project."""

    __tablename__ = "integration_configs"

    id = Column(String(36), primary_key=True, default=_uuid)
    project_id = Column(String(255), nullable=True, index=True)  # None = org-level
    provider = Column(String(64), nullable=False, index=True)  # datadog, pagerduty, jira, ...
    _api_key_encrypted = Column("api_key", Text, nullable=True)
    config = Column(Text, nullable=False, default="{}")  # JSON blob of provider-specific settings
    events = Column(Text, nullable=False, default="[]")  # JSON array of subscribed event types
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # ------------------------------------------------------------------ #
    # API key encryption helpers                                           #
    # ------------------------------------------------------------------ #

    @property
    def api_key(self) -> str | None:
        if self._api_key_encrypted is None:
            return None
        return _decrypt_api_key(self._api_key_encrypted)

    @api_key.setter
    def api_key(self, value: str | None) -> None:
        self._api_key_encrypted = _encrypt_api_key(value) if value else None

    # ------------------------------------------------------------------ #
    # JSON helpers                                                         #
    # ------------------------------------------------------------------ #

    def get_config(self) -> dict[str, Any]:
        return json.loads(self.config) if self.config else {}

    def set_config(self, cfg: dict[str, Any]) -> None:
        self.config = json.dumps(cfg)

    def get_events(self) -> list[str]:
        return json.loads(self.events) if self.events else []

    def set_events(self, event_list: list[str]) -> None:
        self.events = json.dumps(event_list)
