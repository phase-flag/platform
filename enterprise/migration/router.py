"""Migration router — vendor migration import endpoints."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from . import service

router = APIRouter()


async def _get_session():
    raise RuntimeError("Override _get_session dependency in host app.")


class ImportRequest(BaseModel):
    organization_id: str
    flags: List[Dict[str, Any]]
    created_by: Optional[str] = None


class MappingResponse(BaseModel):
    id: str
    source_key: str
    source_name: Optional[str]
    target_key: str
    flag_type: Optional[str]
    status: str
    error: Optional[str]


class JobResponse(BaseModel):
    id: str
    organization_id: str
    source: str
    status: str
    total_flags: int
    imported_flags: int
    skipped_flags: int
    failed_flags: int
    errors: Optional[List[str]]
    created_by: Optional[str]
    started_at: Optional[str]
    completed_at: Optional[str]
    created_at: str


class JobDetailResponse(JobResponse):
    mappings: List[MappingResponse]


def _job_to_response(j) -> JobResponse:
    return JobResponse(
        id=j.id, organization_id=j.organization_id,
        source=j.source, status=j.status,
        total_flags=j.total_flags, imported_flags=j.imported_flags,
        skipped_flags=j.skipped_flags, failed_flags=j.failed_flags,
        errors=json.loads(j.error_log) if j.error_log else None,
        created_by=j.created_by,
        started_at=j.started_at.isoformat() if j.started_at else None,
        completed_at=j.completed_at.isoformat() if j.completed_at else None,
        created_at=j.created_at.isoformat(),
    )


def _mapping_to_response(m) -> MappingResponse:
    return MappingResponse(
        id=m.id, source_key=m.source_key, source_name=m.source_name,
        target_key=m.target_key, flag_type=m.flag_type,
        status=m.status, error=m.error,
    )


@router.post("/import/{source}", response_model=JobResponse)
async def import_flags(source: str, body: ImportRequest, session=Depends(_get_session)):
    valid_sources = ["launchdarkly", "unleash", "flagsmith", "configcat", "custom"]
    if source not in valid_sources:
        raise HTTPException(400, f"Unsupported source: {source}. Supported: {valid_sources}")

    job, mappings = await service.create_migration(
        session, body.organization_id, source, body.flags, body.created_by,
    )
    await session.commit()
    return _job_to_response(job)


@router.get("/jobs", response_model=List[JobResponse])
async def list_jobs(
    organization_id: str = Query(...),
    session=Depends(_get_session),
):
    jobs = await service.list_jobs(session, organization_id)
    return [_job_to_response(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=JobDetailResponse)
async def get_job(job_id: str, session=Depends(_get_session)):
    job = await service.get_job(session, job_id)
    if not job:
        raise HTTPException(404, "Migration job not found")
    mappings = await service.get_mappings(session, job_id)
    resp = _job_to_response(job)
    return JobDetailResponse(
        **resp.model_dump(),
        mappings=[_mapping_to_response(m) for m in mappings],
    )


@router.get("/jobs/{job_id}/mappings", response_model=List[MappingResponse])
async def list_mappings(job_id: str, session=Depends(_get_session)):
    mappings = await service.get_mappings(session, job_id)
    return [_mapping_to_response(m) for m in mappings]
