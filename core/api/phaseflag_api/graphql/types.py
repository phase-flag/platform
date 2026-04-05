"""Strawberry GraphQL type definitions mapping to existing SQLAlchemy/Pydantic models."""

from __future__ import annotations

from typing import Any, Optional

import strawberry


@strawberry.type
class VariationType:
    id: str
    key: str
    name: str
    value: strawberry.scalars.JSON
    description: Optional[str]


@strawberry.type
class FlagType:
    id: str
    key: str
    name: str
    description: Optional[str]
    type: str  # maps to flag_type
    enabled: bool  # True when status == "active"
    variations: list[VariationType]
    targeting_rules: strawberry.scalars.JSON
    tags: list[str]
    lifecycle_stage: str
    flag_classification: str
    is_permanent: bool
    created_at: str
    updated_at: str
    created_by: str
    owner: str
    evaluation_count: int
    last_evaluated_at: Optional[str]


@strawberry.type
class SegmentType:
    id: str
    key: str
    name: str
    description: Optional[str]
    conditions: strawberry.scalars.JSON
    created_by: str
    created_at: str


@strawberry.type
class ProjectType:
    id: str
    slug: str
    name: str
    description: Optional[str]
    organization_id: str
    created_at: str
    updated_at: str


@strawberry.type
class EnvironmentType:
    id: str
    slug: str
    name: str
    description: Optional[str]
    project_id: str
    is_production: bool
    frozen: bool
    created_at: str
    updated_at: str


@strawberry.type
class EvaluationResultType:
    flag_key: str
    variation_key: str
    variation_value: strawberry.scalars.JSON
    reason: str
    enabled: bool


# ---------------------------------------------------------------------------
# Input types for mutations
# ---------------------------------------------------------------------------


@strawberry.input
class VariationInput:
    key: str
    name: str
    value: strawberry.scalars.JSON
    description: Optional[str] = None


@strawberry.input
class FlagCreateInput:
    key: str
    name: str
    description: Optional[str] = None
    flag_type: str = "boolean"
    environment: str = "development"
    variations: list[VariationInput] = strawberry.field(default_factory=list)
    default_variation_key: str = "off"
    tags: list[str] = strawberry.field(default_factory=list)
    created_by: str = "system"
    flag_classification: str = "release"
    is_permanent: bool = False


@strawberry.input
class FlagUpdateInput:
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None
    flag_classification: Optional[str] = None
    is_permanent: Optional[bool] = None
    owner: Optional[str] = None


@strawberry.input
class EvaluateFlagInput:
    flag_key: str
    user_id: str
    attributes: strawberry.scalars.JSON = strawberry.field(default_factory=dict)


# ---------------------------------------------------------------------------
# ORM -> GraphQL type converters
# ---------------------------------------------------------------------------


def flag_db_to_gql(flag: Any) -> FlagType:
    """Convert a FeatureFlagDB instance to a FlagType."""
    return FlagType(
        id=flag.id,
        key=flag.key,
        name=flag.name,
        description=flag.description,
        type=flag.flag_type,
        enabled=flag.status == "active",
        variations=[
            VariationType(
                id=v.id,
                key=v.key,
                name=v.name,
                value=v.get_value(),
                description=v.description,
            )
            for v in flag.variations
        ],
        targeting_rules=flag.get_targeting_rules(),
        tags=flag.get_tags(),
        lifecycle_stage=getattr(flag, "lifecycle_stage", "development") or "development",
        flag_classification=getattr(flag, "flag_classification", "release") or "release",
        is_permanent=getattr(flag, "is_permanent", False) or False,
        created_at=flag.created_at.isoformat(),
        updated_at=flag.updated_at.isoformat(),
        created_by=flag.created_by,
        owner=flag.owner,
        evaluation_count=flag.evaluation_count or 0,
        last_evaluated_at=flag.last_evaluated_at.isoformat() if flag.last_evaluated_at else None,
    )


def segment_db_to_gql(segment: Any) -> SegmentType:
    """Convert a SegmentDB instance to a SegmentType."""
    return SegmentType(
        id=segment.id,
        key=segment.key,
        name=segment.name,
        description=segment.description,
        conditions=segment.get_conditions(),
        created_by=segment.created_by,
        created_at=segment.created_at.isoformat(),
    )


def project_db_to_gql(project: Any) -> ProjectType:
    """Convert a ProjectDB instance to a ProjectType."""
    return ProjectType(
        id=project.id,
        slug=project.slug,
        name=project.name,
        description=project.description,
        organization_id=project.organization_id,
        created_at=project.created_at.isoformat(),
        updated_at=project.updated_at.isoformat(),
    )


def environment_db_to_gql(env: Any) -> EnvironmentType:
    """Convert an EnvironmentDB instance to an EnvironmentType."""
    return EnvironmentType(
        id=env.id,
        slug=env.slug,
        name=env.name,
        description=env.description,
        project_id=env.project_id,
        is_production=env.is_production,
        frozen=env.frozen,
        created_at=env.created_at.isoformat(),
        updated_at=env.updated_at.isoformat(),
    )
