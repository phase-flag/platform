"""Migration module — SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from enterprise import EnterpriseBase


def _uuid() -> str:
    return str(uuid.uuid4())


class MigrationJob(EnterpriseBase):
    """A migration import job."""

    __tablename__ = "enterprise_migration_jobs"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), nullable=False, index=True)
    source = Column(String(50), nullable=False)  # launchdarkly, unleash, flagsmith, configcat, custom
    status = Column(String(20), nullable=False, default="pending")  # pending, running, completed, failed
    total_flags = Column(Integer, nullable=False, default=0)
    imported_flags = Column(Integer, nullable=False, default=0)
    skipped_flags = Column(Integer, nullable=False, default=0)
    failed_flags = Column(Integer, nullable=False, default=0)
    error_log = Column(Text, nullable=True)  # JSON array of errors
    source_config = Column(Text, nullable=True)  # JSON: connection details (sanitized)
    created_by = Column(String(255), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class MigrationMapping(EnterpriseBase):
    """Mapping between source flag and Phase Flag flag."""

    __tablename__ = "enterprise_migration_mappings"

    id = Column(String(36), primary_key=True, default=_uuid)
    job_id = Column(String(36), nullable=False, index=True)
    source_key = Column(String(500), nullable=False)
    source_name = Column(String(500), nullable=True)
    target_key = Column(String(255), nullable=False)
    flag_type = Column(String(50), nullable=True)  # boolean, string, number, json
    status = Column(String(20), nullable=False, default="mapped")  # mapped, imported, skipped, failed
    source_data = Column(Text, nullable=True)  # JSON: original flag definition
    target_data = Column(Text, nullable=True)  # JSON: converted Phase Flag definition
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
