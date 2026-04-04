"""Rollback rules and metric threshold endpoints."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key, require_role
from phaseflag_api.services import rollout_service

router = APIRouter(dependencies=[Depends(require_api_key)])


class RollbackRuleCreate(BaseModel):
    flag_key: str
    metric_name: str = Field(..., examples=["error_rate"])
    operator: str = Field(..., examples=["gt"])
    threshold: float = Field(..., examples=[0.05])
    window_minutes: int = Field(5, ge=1, le=60)
    action: str = Field("disable", examples=["disable"])


class RollbackRuleOut(BaseModel):
    id: str
    flag_key: str
    metric_name: str
    operator: str
    threshold: float
    window_minutes: int
    action: str
    active: bool
    last_triggered_at: str | None
    created_at: str


def _rule_to_out(r) -> RollbackRuleOut:
    return RollbackRuleOut(
        id=r.id, flag_key=r.flag_key, metric_name=r.metric_name,
        operator=r.operator, threshold=r.threshold,
        window_minutes=r.window_minutes, action=r.action,
        active=r.active,
        last_triggered_at=r.last_triggered_at.isoformat() if r.last_triggered_at else None,
        created_at=r.created_at.isoformat(),
    )


@router.post("/rollback-rules", response_model=RollbackRuleOut, status_code=201, dependencies=[require_role("editor")])
async def create_rollback_rule(body: RollbackRuleCreate, session: AsyncSession = Depends(get_session)):
    rule = await rollout_service.create_rollback_rule(
        session, flag_key=body.flag_key, metric_name=body.metric_name,
        operator=body.operator, threshold=body.threshold,
        window_minutes=body.window_minutes, action=body.action,
    )
    return _rule_to_out(rule)


@router.get("/rollback-rules/{flag_key}", response_model=list[RollbackRuleOut])
async def list_rollback_rules(flag_key: str, session: AsyncSession = Depends(get_session)):
    rules = await rollout_service.list_rollback_rules(session, flag_key)
    return [_rule_to_out(r) for r in rules]
