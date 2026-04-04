"""Async SQLAlchemy queries for organizations and projects."""

from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.models.projects import OrganizationDB, OrgMemberDB, ProjectDB


async def list_organizations(
    session: AsyncSession, *, limit: int = 50, offset: int = 0
) -> tuple[Sequence[OrganizationDB], int]:
    base = select(OrganizationDB)
    total = (
        await session.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0
    items = (
        (
            await session.execute(
                base.order_by(OrganizationDB.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return items, total


async def get_org_by_slug(session: AsyncSession, slug: str) -> OrganizationDB | None:
    result = await session.execute(
        select(OrganizationDB).where(OrganizationDB.slug == slug)
    )
    return result.scalar_one_or_none()


async def get_org_by_id(session: AsyncSession, org_id: str) -> OrganizationDB | None:
    result = await session.execute(
        select(OrganizationDB).where(OrganizationDB.id == org_id)
    )
    return result.scalar_one_or_none()


async def create_organization(
    session: AsyncSession, org: OrganizationDB
) -> OrganizationDB:
    session.add(org)
    await session.flush()
    await session.refresh(org)
    return org


async def update_organization(
    session: AsyncSession, org: OrganizationDB
) -> OrganizationDB:
    await session.flush()
    await session.refresh(org)
    return org


async def delete_organization(session: AsyncSession, org: OrganizationDB) -> None:
    await session.delete(org)
    await session.flush()


async def list_projects(
    session: AsyncSession, org_id: str, *, limit: int = 50, offset: int = 0
) -> tuple[Sequence[ProjectDB], int]:
    base = select(ProjectDB).where(ProjectDB.organization_id == org_id)
    total = (
        await session.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0
    items = (
        (
            await session.execute(
                base.order_by(ProjectDB.created_at.desc()).limit(limit).offset(offset)
            )
        )
        .scalars()
        .all()
    )
    return items, total


async def get_project_by_id(session: AsyncSession, project_id: str) -> ProjectDB | None:
    result = await session.execute(select(ProjectDB).where(ProjectDB.id == project_id))
    return result.scalar_one_or_none()


async def get_project_by_slug(
    session: AsyncSession, org_id: str, slug: str
) -> ProjectDB | None:
    result = await session.execute(
        select(ProjectDB).where(
            ProjectDB.organization_id == org_id, ProjectDB.slug == slug
        )
    )
    return result.scalar_one_or_none()


async def create_project(session: AsyncSession, project: ProjectDB) -> ProjectDB:
    session.add(project)
    await session.flush()
    await session.refresh(project)
    return project


async def update_project(session: AsyncSession, project: ProjectDB) -> ProjectDB:
    await session.flush()
    await session.refresh(project)
    return project


async def delete_project(session: AsyncSession, project: ProjectDB) -> None:
    await session.delete(project)
    await session.flush()


async def add_member(session: AsyncSession, member: OrgMemberDB) -> OrgMemberDB:
    session.add(member)
    await session.flush()
    return member


async def get_member(
    session: AsyncSession, org_id: str, user_id: str
) -> OrgMemberDB | None:
    result = await session.execute(
        select(OrgMemberDB).where(
            OrgMemberDB.organization_id == org_id, OrgMemberDB.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def ensure_default_project(session: AsyncSession) -> ProjectDB:
    """Ensure a default org and project exist for backward compatibility."""
    org = await get_org_by_slug(session, "default")
    if org is None:
        org = OrganizationDB(slug="default", name="Default Organization")
        org = await create_organization(session, org)

    project = await get_project_by_slug(session, org.id, "default")
    if project is None:
        project = ProjectDB(
            organization_id=org.id, slug="default", name="Default Project"
        )
        project = await create_project(session, project)

    return project
