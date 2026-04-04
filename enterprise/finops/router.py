"""FinOps router — cost attribution endpoints."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from . import service

router = APIRouter()


async def _get_session():
    raise RuntimeError("Override _get_session dependency in host app.")


class CostEntryCreate(BaseModel):
    flag_key: str
    cost_amount: float
    period_start: str  # ISO datetime
    period_end: str
    environment: str = "production"
    team: Optional[str] = None
    service: Optional[str] = None
    resource_type: Optional[str] = None
    currency: str = "USD"
    description: Optional[str] = None


class CostEntryResponse(BaseModel):
    id: str
    flag_key: str
    environment: str
    team: Optional[str]
    service: Optional[str]
    resource_type: Optional[str]
    cost_amount: float
    currency: str
    period_start: str
    period_end: str
    description: Optional[str]
    created_at: str


class CostReportRequest(BaseModel):
    report_type: str  # by_flag, by_team, by_service
    period_start: str
    period_end: str
    filter_key: Optional[str] = None


class CostReportResponse(BaseModel):
    id: str
    report_type: str
    filter_key: Optional[str]
    period_start: str
    period_end: str
    total_cost: float
    num_entries: int
    breakdown: Dict[str, float]
    currency: str
    created_at: str


def _entry_to_response(e) -> CostEntryResponse:
    return CostEntryResponse(
        id=e.id, flag_key=e.flag_key, environment=e.environment,
        team=e.team, service=e.service, resource_type=e.resource_type,
        cost_amount=e.cost_amount, currency=e.currency,
        period_start=e.period_start.isoformat(), period_end=e.period_end.isoformat(),
        description=e.description, created_at=e.created_at.isoformat(),
    )


@router.post("/costs", response_model=CostEntryResponse)
async def create_cost(body: CostEntryCreate, session=Depends(_get_session)):
    entry = await service.record_cost(
        session,
        flag_key=body.flag_key,
        cost_amount=body.cost_amount,
        period_start=datetime.fromisoformat(body.period_start),
        period_end=datetime.fromisoformat(body.period_end),
        environment=body.environment,
        team=body.team,
        service=body.service,
        resource_type=body.resource_type,
        currency=body.currency,
        description=body.description,
    )
    await session.commit()
    return _entry_to_response(entry)


@router.get("/costs", response_model=List[CostEntryResponse])
async def list_costs(
    flag_key: Optional[str] = Query(None),
    team: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    session=Depends(_get_session),
):
    entries = await service.list_entries(session, limit=limit, offset=offset, team=team, flag_key=flag_key)
    return [_entry_to_response(e) for e in entries]


@router.get("/costs/by-flag/{flag_key}", response_model=List[CostEntryResponse])
async def costs_by_flag(flag_key: str, session=Depends(_get_session)):
    entries = await service.get_cost_by_flag(session, flag_key)
    return [_entry_to_response(e) for e in entries]


@router.post("/reports", response_model=CostReportResponse)
async def generate_report(body: CostReportRequest, session=Depends(_get_session)):
    report = await service.get_cost_report(
        session,
        report_type=body.report_type,
        period_start=datetime.fromisoformat(body.period_start),
        period_end=datetime.fromisoformat(body.period_end),
        filter_key=body.filter_key,
    )
    await session.commit()
    return CostReportResponse(
        id=report.id, report_type=report.report_type,
        filter_key=report.filter_key,
        period_start=report.period_start.isoformat(),
        period_end=report.period_end.isoformat(),
        total_cost=report.total_cost, num_entries=report.num_entries,
        breakdown=json.loads(report.breakdown) if report.breakdown else {},
        currency=report.currency,
        created_at=report.created_at.isoformat(),
    )
