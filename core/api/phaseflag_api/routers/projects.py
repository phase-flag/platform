"""Organization and project management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import get_current_user, require_api_key, require_role
from phaseflag_api.models.projects import OrgMemberDB, OrganizationDB, ProjectDB
from phaseflag_api.models.users import UserDB
from phaseflag_api.repositories import project_repository
from phaseflag_api.services.billing_service import check_project_limit

router = APIRouter(dependencies=[Depends(require_api_key)])


# --- Schemas ---


class OrgCreate(BaseModel):
    slug: str = Field(..., min_length=1, max_length=255, examples=["acme-corp"])
    name: str = Field(..., min_length=1, max_length=255, examples=["Acme Corporation"])
    description: str | None = None


class OrgUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class OrgOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str | None
    subscription_tier: str
    created_at: str
    updated_at: str


class MemberInvite(BaseModel):
    email: EmailStr
    role: str = Field("member", pattern="^(owner|admin|member)$")


class MemberOut(BaseModel):
    org_id: str
    user_id: str
    role: str
    joined_at: str


class ProjectCreate(BaseModel):
    slug: str = Field(..., min_length=1, max_length=255, examples=["web-app"])
    name: str = Field(..., min_length=1, max_length=255, examples=["Web Application"])
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectOut(BaseModel):
    id: str
    organization_id: str
    slug: str
    name: str
    description: str | None
    created_at: str
    updated_at: str


class PaginatedOrgs(BaseModel):
    items: list[OrgOut]
    total: int
    limit: int
    offset: int


class PaginatedProjects(BaseModel):
    items: list[ProjectOut]
    total: int
    limit: int
    offset: int


def _org_to_out(org: OrganizationDB) -> OrgOut:
    return OrgOut(
        id=org.id,
        slug=org.slug,
        name=org.name,
        description=org.description,
        subscription_tier=org.subscription_tier,
        created_at=org.created_at.isoformat(),
        updated_at=org.updated_at.isoformat(),
    )


def _project_to_out(p: ProjectDB) -> ProjectOut:
    return ProjectOut(
        id=p.id,
        organization_id=p.organization_id,
        slug=p.slug,
        name=p.name,
        description=p.description,
        created_at=p.created_at.isoformat(),
        updated_at=p.updated_at.isoformat(),
    )


# --- Organization Endpoints ---


@router.get("/organizations/me", response_model=list[OrgOut])
async def my_organizations(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return all organizations the current user belongs to."""
    result = await session.execute(select(OrgMemberDB).where(OrgMemberDB.user_id == user["id"]))
    memberships = result.scalars().all()
    org_ids = [m.organization_id for m in memberships]
    if not org_ids:
        return []
    orgs_result = await session.execute(select(OrganizationDB).where(OrganizationDB.id.in_(org_ids)))
    return [_org_to_out(o) for o in orgs_result.scalars().all()]


@router.post("/organizations/{org_id}/members", response_model=MemberOut, status_code=201)
async def invite_member(
    org_id: str,
    body: MemberInvite,
    session: AsyncSession = Depends(get_session),
):
    """Invite a user to an organization by email."""
    org = await session.get(OrganizationDB, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    user_result = await session.execute(select(UserDB).where(UserDB.email == body.email))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=f"No user found with email {body.email}")
    existing = await session.execute(
        select(OrgMemberDB).where(
            OrgMemberDB.organization_id == org_id,
            OrgMemberDB.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member of this organization")
    member = OrgMemberDB(organization_id=org_id, user_id=user.id, role=body.role)
    session.add(member)
    await session.flush()
    return MemberOut(
        org_id=member.organization_id,
        user_id=member.user_id,
        role=member.role,
        joined_at=member.created_at.isoformat(),
    )


@router.get("/organizations", response_model=PaginatedOrgs)
async def list_organizations(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    orgs, total = await project_repository.list_organizations(session, limit=limit, offset=offset)
    return PaginatedOrgs(items=[_org_to_out(o) for o in orgs], total=total, limit=limit, offset=offset)


@router.post(
    "/organizations",
    response_model=OrgOut,
    status_code=201,
    dependencies=[require_role("admin")],
)
async def create_organization(body: OrgCreate, session: AsyncSession = Depends(get_session)):
    existing = await project_repository.get_org_by_slug(session, body.slug)
    if existing:
        raise HTTPException(status_code=409, detail=f"Organization '{body.slug}' already exists")
    org = OrganizationDB(slug=body.slug, name=body.name, description=body.description)
    created = await project_repository.create_organization(session, org)
    return _org_to_out(created)


@router.get("/organizations/{slug}", response_model=OrgOut)
async def get_organization(slug: str, session: AsyncSession = Depends(get_session)):
    org = await project_repository.get_org_by_slug(session, slug)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return _org_to_out(org)


@router.put("/organizations/{slug}", response_model=OrgOut, dependencies=[require_role("admin")])
async def update_organization(slug: str, body: OrgUpdate, session: AsyncSession = Depends(get_session)):
    org = await project_repository.get_org_by_slug(session, slug)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if body.name is not None:
        org.name = body.name
    if body.description is not None:
        org.description = body.description
    updated = await project_repository.update_organization(session, org)
    return _org_to_out(updated)


@router.delete("/organizations/{slug}", status_code=204, dependencies=[require_role("admin")])
async def delete_organization(slug: str, session: AsyncSession = Depends(get_session)):
    org = await project_repository.get_org_by_slug(session, slug)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    await project_repository.delete_organization(session, org)


# --- Project Endpoints ---


@router.get("/organizations/{org_slug}/projects", response_model=PaginatedProjects)
async def list_projects(
    org_slug: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    org = await project_repository.get_org_by_slug(session, org_slug)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    projects, total = await project_repository.list_projects(session, org.id, limit=limit, offset=offset)
    return PaginatedProjects(
        items=[_project_to_out(p) for p in projects],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/organizations/{org_slug}/projects",
    response_model=ProjectOut,
    status_code=201,
    dependencies=[require_role("admin")],
)
async def create_project(org_slug: str, body: ProjectCreate, session: AsyncSession = Depends(get_session)):
    org = await project_repository.get_org_by_slug(session, org_slug)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Enforce tier-based project limit before creating
    await check_project_limit(session, org.id)

    existing = await project_repository.get_project_by_slug(session, org.id, body.slug)
    if existing:
        raise HTTPException(status_code=409, detail=f"Project '{body.slug}' already exists in this org")
    project = ProjectDB(
        organization_id=org.id,
        slug=body.slug,
        name=body.name,
        description=body.description,
    )
    created = await project_repository.create_project(session, project)
    return _project_to_out(created)


@router.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, session: AsyncSession = Depends(get_session)):
    project = await project_repository.get_project_by_id(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_out(project)


@router.put(
    "/projects/{project_id}",
    response_model=ProjectOut,
    dependencies=[require_role("admin")],
)
async def update_project(project_id: str, body: ProjectUpdate, session: AsyncSession = Depends(get_session)):
    project = await project_repository.get_project_by_id(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    updated = await project_repository.update_project(session, project)
    return _project_to_out(updated)


@router.delete("/projects/{project_id}", status_code=204, dependencies=[require_role("admin")])
async def delete_project(project_id: str, session: AsyncSession = Depends(get_session)):
    project = await project_repository.get_project_by_id(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await project_repository.delete_project(session, project)
