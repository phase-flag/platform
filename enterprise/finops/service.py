"""FinOps service — per-flag cloud cost attribution."""

from __future__ import annotations

import json
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import CostEntry, CostReport


async def record_cost(
    session: AsyncSession,
    flag_key: str,
    cost_amount: float,
    period_start: datetime,
    period_end: datetime,
    environment: str = "production",
    team: Optional[str] = None,
    service: Optional[str] = None,
    resource_type: Optional[str] = None,
    currency: str = "USD",
    description: Optional[str] = None,
) -> CostEntry:
    entry = CostEntry(
        id=str(uuid.uuid4()),
        flag_key=flag_key,
        environment=environment,
        team=team,
        service=service,
        resource_type=resource_type,
        cost_amount=cost_amount,
        currency=currency,
        period_start=period_start,
        period_end=period_end,
        description=description,
        created_at=datetime.utcnow(),
    )
    session.add(entry)
    await session.flush()
    return entry


async def get_cost_by_flag(
    session: AsyncSession,
    flag_key: str,
    period_start: Optional[datetime] = None,
    period_end: Optional[datetime] = None,
) -> List[CostEntry]:
    conditions = [CostEntry.flag_key == flag_key]
    if period_start:
        conditions.append(CostEntry.period_start >= period_start)
    if period_end:
        conditions.append(CostEntry.period_end <= period_end)

    stmt = select(CostEntry).where(and_(*conditions)).order_by(CostEntry.period_start.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_cost_report(
    session: AsyncSession,
    report_type: str,
    period_start: datetime,
    period_end: datetime,
    filter_key: Optional[str] = None,
) -> CostReport:
    """Generate an aggregated cost report.

    report_type: 'by_flag', 'by_team', 'by_service'
    """
    conditions = [
        CostEntry.period_start >= period_start,
        CostEntry.period_end <= period_end,
    ]
    if filter_key:
        if report_type == "by_flag":
            conditions.append(CostEntry.flag_key == filter_key)
        elif report_type == "by_team":
            conditions.append(CostEntry.team == filter_key)
        elif report_type == "by_service":
            conditions.append(CostEntry.service == filter_key)

    stmt = select(CostEntry).where(and_(*conditions))
    result = await session.execute(stmt)
    entries = list(result.scalars().all())

    total = sum(e.cost_amount for e in entries)

    # Build breakdown
    breakdown: Dict[str, float] = defaultdict(float)
    for e in entries:
        if report_type == "by_flag":
            breakdown[e.flag_key] += e.cost_amount
        elif report_type == "by_team":
            breakdown[e.team or "unassigned"] += e.cost_amount
        elif report_type == "by_service":
            breakdown[e.service or "unassigned"] += e.cost_amount

    # Sort breakdown descending by cost
    sorted_breakdown = dict(sorted(breakdown.items(), key=lambda x: x[1], reverse=True))

    report = CostReport(
        id=str(uuid.uuid4()),
        report_type=report_type,
        filter_key=filter_key,
        period_start=period_start,
        period_end=period_end,
        total_cost=total,
        num_entries=len(entries),
        breakdown=json.dumps(sorted_breakdown),
        currency="USD",
        created_at=datetime.utcnow(),
    )
    session.add(report)
    await session.flush()
    return report


async def list_entries(
    session: AsyncSession,
    limit: int = 100,
    offset: int = 0,
    team: Optional[str] = None,
    flag_key: Optional[str] = None,
) -> List[CostEntry]:
    conditions = []
    if team:
        conditions.append(CostEntry.team == team)
    if flag_key:
        conditions.append(CostEntry.flag_key == flag_key)

    stmt = select(CostEntry)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(CostEntry.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(stmt)
    return list(result.scalars().all())
