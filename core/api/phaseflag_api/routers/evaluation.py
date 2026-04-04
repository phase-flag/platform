"""Evaluation endpoints — explainability and batch evaluation."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key
from phaseflag_api.repositories import flag_repository, segment_repository
from phaseflag_api.services.evaluation_engine import (
    evaluate_group_rollout,
    evaluate_with_prerequisites,
    evaluate_with_trace,
)

router = APIRouter(dependencies=[Depends(require_api_key)])


class EvalContextIn(BaseModel):
    user_id: str | None = None
    session_id: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)


class ExplainRequest(BaseModel):
    context: EvalContextIn = Field(default_factory=EvalContextIn)


class ExplainResponse(BaseModel):
    flag_key: str
    variation_id: str | None = None
    variation_key: str | None = None
    value: Any = None
    reason: str
    rules_evaluated: int = 0
    matched_rule_index: int | None = None


class BatchEvalRequest(BaseModel):
    flag_keys: list[str] = Field(..., max_length=100)
    context: EvalContextIn = Field(default_factory=EvalContextIn)


class BatchEvalResult(BaseModel):
    flag_key: str
    variation_key: str | None = None
    value: Any = None
    reason: str


class GroupRolloutRequest(BaseModel):
    flag_key: str
    group_id: str
    rollout_percentage: int = Field(..., ge=0, le=100)


class GroupRolloutResponse(BaseModel):
    flag_key: str
    group_id: str
    in_rollout: bool
    rollout_percentage: int


async def _compile_flag_for_eval(flag_db, session: AsyncSession) -> dict[str, Any]:
    """Compile a flag DB object into a dict suitable for the evaluation engine."""
    targeting_rules = flag_db.get_targeting_rules()
    for rule in targeting_rules:
        seg_id = rule.get("segment_id")
        if seg_id:
            seg = await segment_repository.get_segment_by_id(session, seg_id)
            if seg:
                rule.setdefault("conditions", []).extend(seg.get_conditions())

    prerequisites = flag_db.get_prerequisites() if hasattr(flag_db, "get_prerequisites") else []
    return {
        "id": flag_db.id,
        "key": flag_db.key,
        "flag_type": flag_db.flag_type,
        "default_variation_id": flag_db.default_variation_id,
        "variations": [{"id": v.id, "key": v.key, "name": v.name, "value": v.get_value()} for v in flag_db.variations],
        "targeting_rules": targeting_rules,
        "prerequisites": prerequisites,
    }


async def _build_prerequisite_map(session: AsyncSession, target_key: str) -> dict[str, dict[str, Any]]:
    """Build a flags map including all prerequisite chains for a target flag."""
    visited: set[str] = set()
    flags_map: dict[str, dict[str, Any]] = {}

    async def _load(key: str) -> None:
        if key in visited:
            return
        visited.add(key)
        flag_db = await flag_repository.get_flag_by_key(session, key)
        if flag_db is None or flag_db.status != "active":
            return
        compiled = await _compile_flag_for_eval(flag_db, session)
        flags_map[key] = compiled
        for prereq in compiled.get("prerequisites", []):
            await _load(prereq["flag_key"])

    await _load(target_key)
    return flags_map


@router.post("/flags/{key}/explain", response_model=ExplainResponse)
async def explain_flag(key: str, body: ExplainRequest, session: AsyncSession = Depends(get_session)):
    """Evaluate a flag and return an explanation of why the result was chosen."""
    flag_db = await flag_repository.get_flag_by_key(session, key)
    if flag_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found")
    if flag_db.status != "active":
        return ExplainResponse(flag_key=key, reason="flag_inactive", rules_evaluated=0)

    compiled = await _compile_flag_for_eval(flag_db, session)
    ctx_dict = {
        "user_id": body.context.user_id,
        "session_id": body.context.session_id,
        **(body.context.attributes or {}),
    }

    trace_result = evaluate_with_trace(compiled, ctx_dict)

    return ExplainResponse(
        flag_key=key,
        variation_id=trace_result.get("variation_id"),
        variation_key=trace_result.get("variation_key"),
        value=trace_result.get("value"),
        reason=trace_result["reason"],
        rules_evaluated=trace_result["trace"]["rules_evaluated"],
        matched_rule_index=trace_result["trace"]["matched_rule_index"],
    )


@router.post("/evaluate/batch", response_model=list[BatchEvalResult])
async def batch_evaluate(body: BatchEvalRequest, session: AsyncSession = Depends(get_session)):
    """Evaluate multiple flags in one call using prerequisite-aware evaluation."""
    ctx_dict = {
        "user_id": body.context.user_id,
        "session_id": body.context.session_id,
        **(body.context.attributes or {}),
    }
    results: list[BatchEvalResult] = []

    for flag_key in body.flag_keys:
        flag_db = await flag_repository.get_flag_by_key(session, flag_key)
        if flag_db is None or flag_db.status != "active":
            results.append(BatchEvalResult(flag_key=flag_key, reason="flag_not_found_or_inactive"))
            continue

        flags_map = await _build_prerequisite_map(session, flag_key)
        result = evaluate_with_prerequisites(flags_map, flag_key, ctx_dict)
        results.append(
            BatchEvalResult(
                flag_key=flag_key,
                variation_key=result.get("variation_key"),
                value=result.get("value"),
                reason=result.get("reason", "default"),
            )
        )

    return results


@router.post("/evaluate/group", response_model=GroupRolloutResponse)
async def evaluate_group(body: GroupRolloutRequest, session: AsyncSession = Depends(get_session)):
    """Evaluate whether a group (account/team/tenant) falls within a rollout percentage."""
    flag_db = await flag_repository.get_flag_by_key(session, body.flag_key)
    if flag_db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flag not found")
    if flag_db.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flag is not active")

    compiled = await _compile_flag_for_eval(flag_db, session)
    in_rollout = evaluate_group_rollout(compiled, body.group_id, body.rollout_percentage)

    return GroupRolloutResponse(
        flag_key=body.flag_key,
        group_id=body.group_id,
        in_rollout=in_rollout,
        rollout_percentage=body.rollout_percentage,
    )
