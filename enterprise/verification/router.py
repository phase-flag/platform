"""Verification router — flag rule verification endpoints."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from . import service

router = APIRouter()


async def _get_session():
    raise RuntimeError("Override _get_session dependency in host app.")


class RuleCondition(BaseModel):
    attribute: str
    operator: str
    value: Any


class Rule(BaseModel):
    priority: int = 1
    conditions: List[RuleCondition] = []
    variation: str = "default"
    rollout_percentage: float = 100.0


class VerifyRequest(BaseModel):
    rules: List[Rule] = Field(..., max_length=500)
    environment: str = "production"


class VerifyResponse(BaseModel):
    id: str
    flag_key: str
    is_valid: bool
    num_rules: int
    contradictions: Optional[List[str]] = None
    dead_rules: Optional[List[str]] = None
    unreachable_rules: Optional[List[str]] = None
    overlapping_rules: Optional[List[str]] = None
    warnings: Optional[List[str]] = None
    summary: str
    created_at: str


def _parse_json_list(val: Optional[str]) -> Optional[List[str]]:
    if val is None:
        return None
    return json.loads(val)


@router.post("/verify/{flag_key}", response_model=VerifyResponse)
async def verify_flag(flag_key: str, body: VerifyRequest, session=Depends(_get_session)):
    rules_dicts = [
        {
            "priority": r.priority,
            "conditions": [c.model_dump() for c in r.conditions],
            "variation": r.variation,
            "rollout_percentage": r.rollout_percentage,
        }
        for r in body.rules
    ]
    result = await service.verify_flag_rules(session, flag_key, rules_dicts, body.environment)
    await session.commit()
    return VerifyResponse(
        id=result.id,
        flag_key=result.flag_key,
        is_valid=bool(result.is_valid),
        num_rules=result.num_rules,
        contradictions=_parse_json_list(result.contradictions),
        dead_rules=_parse_json_list(result.dead_rules),
        unreachable_rules=_parse_json_list(result.unreachable_rules),
        overlapping_rules=_parse_json_list(result.overlapping_rules),
        warnings=_parse_json_list(result.warnings),
        summary=result.summary,
        created_at=result.created_at.isoformat(),
    )


@router.get("/results/{flag_key}", response_model=List[VerifyResponse])
async def list_results(flag_key: str, session=Depends(_get_session)):
    results = await service.get_results(session, flag_key)
    return [
        VerifyResponse(
            id=r.id,
            flag_key=r.flag_key,
            is_valid=bool(r.is_valid),
            num_rules=r.num_rules,
            contradictions=_parse_json_list(r.contradictions),
            dead_rules=_parse_json_list(r.dead_rules),
            unreachable_rules=_parse_json_list(r.unreachable_rules),
            overlapping_rules=_parse_json_list(r.overlapping_rules),
            warnings=_parse_json_list(r.warnings),
            summary=r.summary,
            created_at=r.created_at.isoformat(),
        )
        for r in results
    ]
