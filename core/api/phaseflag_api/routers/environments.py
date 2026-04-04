"""Environment management endpoints with clone and promote support."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.models.environments import EnvironmentDB
from phaseflag_api.repositories import environment_repository, project_repository

router = APIRouter(dependencies=[Depends(require_api_key)])


class EnvCreate(BaseModel):
    slug: str = Field(..., min_length=1, max_length=255, examples=["staging"])
    name: str = Field(..., min_length=1, max_length=255, examples=["Staging"])
    description: str | None = None
    color: str | None = Field(None, examples=["#F59E0B"])
    is_production: bool = False


class EnvUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    is_production: bool | None = None


class EnvOut(BaseModel):
    id: str
    project_id: str
    slug: str
    name: str
    description: str | None
    color: str | None
    api_key: str
    is_production: bool
    frozen: bool
    frozen_reason: str | None
    created_at: str
    updated_at: str


class PaginatedEnvs(BaseModel):
    items: list[EnvOut]
    total: int
    limit: int
    offset: int


class CloneRequest(BaseModel):
    new_slug: str = Field(..., examples=["staging-copy"])
    new_name: str = Field(..., examples=["Staging Copy"])


class FreezeRequest(BaseModel):
    reason: str = Field(..., examples=["Release freeze for v2.0"])


def _env_to_out(env: EnvironmentDB) -> EnvOut:
    return EnvOut(
        id=env.id,
        project_id=env.project_id,
        slug=env.slug,
        name=env.name,
        description=env.description,
        color=env.color,
        api_key=env.api_key,
        is_production=env.is_production,
        frozen=env.frozen,
        frozen_reason=env.frozen_reason,
        created_at=env.created_at.isoformat(),
        updated_at=env.updated_at.isoformat(),
    )


@router.get("/projects/{project_id}/environments", response_model=PaginatedEnvs)
async def list_environments(
    project_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    project = await project_repository.get_project_by_id(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    envs, total = await environment_repository.list_environments(
        session, project_id, limit=limit, offset=offset
    )
    return PaginatedEnvs(
        items=[_env_to_out(e) for e in envs], total=total, limit=limit, offset=offset
    )


@router.post(
    "/projects/{project_id}/environments",
    response_model=EnvOut,
    status_code=201,
    dependencies=[require_role("admin")],
)
async def create_environment(
    project_id: str, body: EnvCreate, session: AsyncSession = Depends(get_session)
):
    project = await project_repository.get_project_by_id(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    existing = await environment_repository.get_env_by_slug(
        session, project_id, body.slug
    )
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Environment '{body.slug}' already exists"
        )
    env = EnvironmentDB(
        project_id=project_id,
        slug=body.slug,
        name=body.name,
        description=body.description,
        color=body.color,
        is_production=body.is_production,
    )
    created = await environment_repository.create_environment(session, env)
    return _env_to_out(created)


@router.get("/environments/{env_id}", response_model=EnvOut)
async def get_environment(env_id: str, session: AsyncSession = Depends(get_session)):
    env = await environment_repository.get_env_by_id(session, env_id)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    return _env_to_out(env)


@router.put(
    "/environments/{env_id}",
    response_model=EnvOut,
    dependencies=[require_role("admin")],
)
async def update_environment(
    env_id: str, body: EnvUpdate, session: AsyncSession = Depends(get_session)
):
    env = await environment_repository.get_env_by_id(session, env_id)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    if body.name is not None:
        env.name = body.name
    if body.description is not None:
        env.description = body.description
    if body.color is not None:
        env.color = body.color
    if body.is_production is not None:
        env.is_production = body.is_production
    updated = await environment_repository.update_environment(session, env)
    return _env_to_out(updated)


@router.delete(
    "/environments/{env_id}", status_code=204, dependencies=[require_role("admin")]
)
async def delete_environment(env_id: str, session: AsyncSession = Depends(get_session)):
    env = await environment_repository.get_env_by_id(session, env_id)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    await environment_repository.delete_environment(session, env)


@router.post(
    "/environments/{env_id}/clone",
    response_model=EnvOut,
    status_code=201,
    dependencies=[require_role("admin")],
)
async def clone_environment(
    env_id: str, body: CloneRequest, session: AsyncSession = Depends(get_session)
):
    source = await environment_repository.get_env_by_id(session, env_id)
    if not source:
        raise HTTPException(status_code=404, detail="Environment not found")
    existing = await environment_repository.get_env_by_slug(
        session, source.project_id, body.new_slug
    )
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Environment '{body.new_slug}' already exists"
        )
    cloned = await environment_repository.clone_environment(
        session, source, body.new_slug, body.new_name
    )
    return _env_to_out(cloned)


@router.post(
    "/environments/{env_id}/freeze",
    response_model=EnvOut,
    dependencies=[require_role("admin")],
)
async def freeze_environment(
    env_id: str, body: FreezeRequest, session: AsyncSession = Depends(get_session)
):
    env = await environment_repository.get_env_by_id(session, env_id)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    env.frozen = True
    env.frozen_reason = body.reason
    updated = await environment_repository.update_environment(session, env)
    return _env_to_out(updated)


@router.post(
    "/environments/{env_id}/unfreeze",
    response_model=EnvOut,
    dependencies=[require_role("admin")],
)
async def unfreeze_environment(
    env_id: str, session: AsyncSession = Depends(get_session)
):
    env = await environment_repository.get_env_by_id(session, env_id)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    env.frozen = False
    env.frozen_reason = None
    updated = await environment_repository.update_environment(session, env)
    return _env_to_out(updated)


@router.post(
    "/environments/{env_id}/rotate-key",
    response_model=EnvOut,
    dependencies=[require_role("admin")],
)
async def rotate_api_key(env_id: str, session: AsyncSession = Depends(get_session)):
    env = await environment_repository.get_env_by_id(session, env_id)
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    env.rotate_api_key()
    updated = await environment_repository.update_environment(session, env)
    return _env_to_out(updated)
