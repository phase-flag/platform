"""Analytics endpoints for flag evaluation data."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key
from phaseflag_api.models.audit import EvaluationEventDB

router = APIRouter(prefix="/analytics", dependencies=[Depends(require_api_key)])


class EvaluationBucket(BaseModel):
    period: str
    variation_key: str | None
    count: int


class AnalyticsSummary(BaseModel):
    flag_key: str
    total_evaluations: int
    unique_users: int
    variations: dict[str, int]


def _date_trunc_expr(period: str, col):
    if period == "hour":
        return func.strftime("%Y-%m-%dT%H:00:00", col)
    elif period == "week":
        return func.strftime("%Y-%m-%d", func.date(col, "weekday 0", "-6 days"))
    else:
        return func.strftime("%Y-%m-%d", col)


@router.get("/flags/{flag_key}/evaluations", response_model=list[EvaluationBucket])
async def get_flag_evaluations(
    flag_key: str,
    period: str = Query("day", pattern="^(hour|day|week)$"),
    days: int = Query(7, ge=1, le=90),
    session: AsyncSession = Depends(get_session),
):
    since = datetime.utcnow() - timedelta(days=days)
    ts_col = EvaluationEventDB.timestamp
    bucket_expr = _date_trunc_expr(period, ts_col)

    stmt = (
        select(
            bucket_expr.label("period"),
            EvaluationEventDB.variation_key,
            func.count().label("count"),
        )
        .where(EvaluationEventDB.flag_key == flag_key)
        .where(ts_col >= since)
        .group_by(bucket_expr, EvaluationEventDB.variation_key)
        .order_by(bucket_expr)
    )

    result = await session.execute(stmt)
    rows = result.all()
    return [EvaluationBucket(period=row.period, variation_key=row.variation_key, count=row.count) for row in rows]


@router.get("/flags/{flag_key}/summary", response_model=AnalyticsSummary)
async def get_flag_summary(
    flag_key: str,
    days: int = Query(7, ge=1, le=90),
    session: AsyncSession = Depends(get_session),
):
    since = datetime.utcnow() - timedelta(days=days)

    totals_stmt = (
        select(
            func.count().label("total"),
            func.count(func.distinct(EvaluationEventDB.user_id)).label("unique_users"),
        )
        .where(EvaluationEventDB.flag_key == flag_key)
        .where(EvaluationEventDB.timestamp >= since)
    )
    totals = (await session.execute(totals_stmt)).one()

    var_stmt = (
        select(EvaluationEventDB.variation_key, func.count().label("count"))
        .where(EvaluationEventDB.flag_key == flag_key)
        .where(EvaluationEventDB.timestamp >= since)
        .group_by(EvaluationEventDB.variation_key)
    )
    var_rows = (await session.execute(var_stmt)).all()

    return AnalyticsSummary(
        flag_key=flag_key,
        total_evaluations=totals.total,
        unique_users=totals.unique_users,
        variations={row.variation_key or "unknown": row.count for row in var_rows},
    )


@router.delete("/events/cleanup")
async def cleanup_old_events(
    days: int = Query(30, ge=1, le=365),
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import delete

    cutoff = datetime.utcnow() - timedelta(days=days)
    stmt = delete(EvaluationEventDB).where(EvaluationEventDB.timestamp < cutoff)
    result = await session.execute(stmt)
    await session.flush()
    return {"deleted": result.rowcount, "cutoff": cutoff.isoformat()}
