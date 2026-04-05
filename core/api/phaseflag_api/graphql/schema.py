"""Strawberry GraphQL schema — mounts alongside existing REST API at /graphql."""

from __future__ import annotations

from typing import Any, Optional

import strawberry
from strawberry.fastapi import GraphQLRouter
from strawberry.types import Info

from .resolvers import (
    resolve_create_flag,
    resolve_create_segment,
    resolve_delete_flag,
    resolve_environments,
    resolve_evaluate_flag,
    resolve_flag,
    resolve_flags,
    resolve_projects,
    resolve_segments,
    resolve_toggle_flag,
    resolve_update_flag,
)
from .types import (
    EvaluateFlagInput,
    EvaluationResultType,
    EnvironmentType,
    FlagCreateInput,
    FlagType,
    FlagUpdateInput,
    ProjectType,
    SegmentType,
)


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------


@strawberry.type
class Query:
    @strawberry.field(description="List feature flags, optionally filtered by project and environment.")
    async def flags(
        self,
        info: Info,
        project_id: Optional[str] = None,
        environment: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[FlagType]:
        return await resolve_flags(info, project_id=project_id, environment=environment, limit=limit, offset=offset)

    @strawberry.field(description="Fetch a single feature flag by its key.")
    async def flag(self, info: Info, key: str) -> Optional[FlagType]:
        return await resolve_flag(info, key=key)

    @strawberry.field(description="List all audience segments.")
    async def segments(
        self,
        info: Info,
        limit: int = 50,
        offset: int = 0,
    ) -> list[SegmentType]:
        return await resolve_segments(info, limit=limit, offset=offset)

    @strawberry.field(description="List all projects.")
    async def projects(
        self,
        info: Info,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ProjectType]:
        return await resolve_projects(info, limit=limit, offset=offset)

    @strawberry.field(description="List environments, optionally filtered by project.")
    async def environments(
        self,
        info: Info,
        project_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[EnvironmentType]:
        return await resolve_environments(info, project_id=project_id, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# Mutation
# ---------------------------------------------------------------------------


@strawberry.type
class Mutation:
    @strawberry.mutation(description="Create a new feature flag.")
    async def create_flag(self, info: Info, input: FlagCreateInput) -> FlagType:
        return await resolve_create_flag(info, input=input)

    @strawberry.mutation(description="Update an existing feature flag.")
    async def update_flag(self, info: Info, key: str, input: FlagUpdateInput) -> Optional[FlagType]:
        return await resolve_update_flag(info, key=key, input=input)

    @strawberry.mutation(description="Toggle a flag between active and inactive states.")
    async def toggle_flag(self, info: Info, key: str) -> Optional[FlagType]:
        return await resolve_toggle_flag(info, key=key)

    @strawberry.mutation(description="Delete a flag (must be archived first).")
    async def delete_flag(self, info: Info, key: str) -> bool:
        return await resolve_delete_flag(info, key=key)

    @strawberry.mutation(description="Create a new audience segment.")
    async def create_segment(
        self,
        info: Info,
        key: str,
        name: str,
        description: Optional[str] = None,
        created_by: str = "system",
    ) -> SegmentType:
        return await resolve_create_segment(
            info, key=key, name=name, description=description, created_by=created_by
        )

    @strawberry.mutation(description="Evaluate a feature flag for a given user context.")
    async def evaluate_flag(self, info: Info, input: EvaluateFlagInput) -> EvaluationResultType:
        return await resolve_evaluate_flag(info, input=input)


# ---------------------------------------------------------------------------
# Schema + FastAPI router
# ---------------------------------------------------------------------------

schema = strawberry.Schema(query=Query, mutation=Mutation)


async def get_graphql_context(request: Any = None) -> dict[str, Any]:
    """Build the GraphQL context dict — injects the database session.

    The session is opened here and committed/rolled-back by the context manager
    embedded in GraphQLRouter's request lifecycle.
    """
    from phaseflag_api.database import get_session

    # Use the FastAPI dependency directly to get a properly managed session
    session_gen = get_session()
    session = await session_gen.__anext__()
    return {"session": session, "request": request}


def create_graphql_router() -> GraphQLRouter:
    """Return a mounted Strawberry GraphQL router with GraphiQL enabled."""
    return GraphQLRouter(
        schema,
        graphiql=True,
        context_getter=get_graphql_context,
    )
