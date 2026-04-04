"""Organization and project ORM models."""

import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from phaseflag_api.database import Base


def _uuid() -> str:
    return str(uuid4())


class OrganizationDB(Base):
    """Top-level tenant organization."""

    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=_uuid)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    projects = relationship("ProjectDB", back_populates="organization", cascade="all, delete-orphan", lazy="selectin")
    members = relationship("OrgMemberDB", back_populates="organization", cascade="all, delete-orphan", lazy="selectin")


class ProjectDB(Base):
    """Project/application within an organization."""

    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    slug = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    organization = relationship("OrganizationDB", back_populates="projects")
    environments = relationship("EnvironmentDB", back_populates="project", cascade="all, delete-orphan", lazy="selectin")


class OrgMemberDB(Base):
    """Organization membership linking users to orgs with roles."""

    __tablename__ = "org_members"

    id = Column(String(36), primary_key=True, default=_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), nullable=False, index=True)
    role = Column(String(20), nullable=False, default="viewer")  # admin, editor, viewer
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))

    organization = relationship("OrganizationDB", back_populates="members")
