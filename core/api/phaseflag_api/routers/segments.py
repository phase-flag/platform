"""Audience-segment CRUD endpoints."""

import json
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.repositories import segment_repository
from phaseflag_api.models.segments import SegmentDB

router = APIRouter(dependencies=[Depends(require_api_key)])


class ConditionIn(BaseModel):
    attribute: str
    operator: str
    value: Any


class SegmentCreate(BaseModel):
    key: str
    name: str
    description: str | None = None
    conditions: list[ConditionIn]
    created_by: str = "system"


class SegmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    conditions: list[ConditionIn] | None = None


class ConditionOut(BaseModel):
    attribute: str
    operator: str
    value: Any


class SegmentOut(BaseModel):
    id: str
    key: str
    name: str
    description: str | None
    conditions: list[ConditionOut]
    created_by: str
    created_at: str


class PaginatedSegments(BaseModel):
    items: list[SegmentOut]
    total: int
    limit: int
    offset: int


def _segment_to_out(seg) -> SegmentOut:
    raw_conditions = seg.get_conditions()
    return SegmentOut(
        id=seg.id,
        key=seg.key,
        name=seg.name,
        description=seg.description,
        conditions=[ConditionOut(**c) for c in raw_conditions],
        created_by=seg.created_by,
        created_at=seg.created_at.isoformat(),
    )


@router.get("/segments", response_model=PaginatedSegments)
async def list_segments(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    segments, total = await segment_repository.list_segments(
        session, limit=limit, offset=offset
    )
    return PaginatedSegments(
        items=[_segment_to_out(s) for s in segments],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/segments/{key}", response_model=SegmentOut)
async def get_segment(key: str, session: AsyncSession = Depends(get_session)):
    seg = await segment_repository.get_segment_by_key(session, key)
    if seg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found"
        )
    return _segment_to_out(seg)


@router.post(
    "/segments",
    response_model=SegmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[require_role("editor")],
)
async def create_segment(
    body: SegmentCreate, session: AsyncSession = Depends(get_session)
):
    existing = await segment_repository.get_segment_by_key(session, body.key)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Segment with key '{body.key}' already exists",
        )
    seg = SegmentDB(
        id=str(uuid4()),
        key=body.key,
        name=body.name,
        description=body.description,
        conditions=json.dumps([c.model_dump() for c in body.conditions]),
        created_by=body.created_by,
    )
    created = await segment_repository.create_segment(session, seg)
    return _segment_to_out(created)


@router.put(
    "/segments/{key}", response_model=SegmentOut, dependencies=[require_role("editor")]
)
async def update_segment(
    key: str, body: SegmentUpdate, session: AsyncSession = Depends(get_session)
):
    seg = await segment_repository.get_segment_by_key(session, key)
    if seg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found"
        )
    if body.name is not None:
        seg.name = body.name
    if body.description is not None:
        seg.description = body.description
    if body.conditions is not None:
        seg.set_conditions([c.model_dump() for c in body.conditions])
    updated = await segment_repository.update_segment(session, seg)
    return _segment_to_out(updated)


@router.delete(
    "/segments/{key}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[require_role("admin")],
)
async def delete_segment(key: str, session: AsyncSession = Depends(get_session)):
    seg = await segment_repository.get_segment_by_key(session, key)
    if seg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found"
        )
    await segment_repository.delete_segment(session, seg)
