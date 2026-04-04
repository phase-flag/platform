"""SDK-facing endpoints: ruleset download, event ingestion, server-side evaluation, and SSE streaming."""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from phaseflag_api.database import get_session
from phaseflag_api.middleware.auth import require_api_key
from phaseflag_api.models.audit import EvaluationEventDB
from phaseflag_api.repositories import flag_repository, segment_repository
from phaseflag_api.services import flag_service
from phaseflag_api.services.evaluation_engine import (
    evaluate,
    evaluate_with_prerequisites,
    evaluate_with_trace,
    merge_identity,
)
from phaseflag_api.services.sse_manager import sse_manager

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_api_key)])


class EvaluationEvent(BaseModel):
    flag_key: str
    variation_key: str | None = None
    user_id: str | None = None
    timestamp: str | None = None
    metadata: dict[str, Any] = {}


MAX_EVENT_BATCH_SIZE = 500
MAX_SSE_CONNECTIONS = 100


class EventBatch(BaseModel):
    events: list[EvaluationEvent] = Field(..., max_length=MAX_EVENT_BATCH_SIZE)


class RulesetResponse(BaseModel):
    flags: list[dict[str, Any]]
    version: str


class EvaluateContextIn(BaseModel):
    user_id: str | None = None
    session_id: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)


class EvaluateRequest(BaseModel):
    flag_key: str = Field(..., examples=["dark-mode"])
    context: EvaluateContextIn = Field(default_factory=EvaluateContextIn)


class EvaluateResponse(BaseModel):
    flag_key: str
    variation_id: str | None = None
    variation_key: str | None = None
    value: Any = None
    reason: str
    trace: dict[str, Any] | None = None


class IdentityMergeRequest(BaseModel):
    anonymous_id: str
    authenticated_id: str
    assignments: dict[str, str] = Field(default_factory=dict)


class IdentityMergeResponse(BaseModel):
    merged_assignments: dict[str, str]


class SSEStatusResponse(BaseModel):
    connected_clients: int
    streaming_enabled: bool = True


@router.get("/sdk/ruleset")
async def get_ruleset(request: Request, session: AsyncSession = Depends(get_session)):
    """Compile and return all active flags as a JSON ruleset.

    Supports ETag-based conditional fetch — returns 304 if unchanged.
    """
    import hashlib

    flags = await flag_service.compile_ruleset(session)
    version = str(hash(tuple(f["id"] for f in flags)) & 0xFFFFFFFF)

    # Compute ETag from version
    etag = f'"{hashlib.md5(version.encode()).hexdigest()}"'

    # Check If-None-Match for conditional fetch
    if_none_match = request.headers.get("if-none-match")
    if if_none_match and if_none_match == etag:
        from fastapi.responses import Response

        return Response(status_code=304, headers={"ETag": etag})

    return JSONResponse(
        content={"flags": flags, "version": version},
        headers={"ETag": etag, "Cache-Control": "no-cache"},
    )


@router.get("/sdk/stream")
async def stream_flag_updates(request: Request, session: AsyncSession = Depends(get_session)):
    if sse_manager.client_count >= MAX_SSE_CONNECTIONS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Too many SSE connections.",
        )

    flags = await flag_service.compile_ruleset(session)
    version = str(hash(tuple(f["id"] for f in flags)) & 0xFFFFFFFF)
    queue = sse_manager.connect()

    async def event_generator():
        try:
            yield sse_manager.format_connected_event(version)
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield message
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            sse_manager.disconnect(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sdk/stream/status", response_model=SSEStatusResponse)
async def stream_status():
    return SSEStatusResponse(connected_clients=sse_manager.client_count, streaming_enabled=True)


@router.get("/sdk/bootstrap")
async def get_bootstrap(session: AsyncSession = Depends(get_session)):
    """Return a complete bootstrap payload for offline SDK initialization.

    Includes all active flags with full configuration for local evaluation.
    """
    import hashlib
    import hmac as _hmac

    flags = await flag_service.compile_ruleset(session)
    version = str(hash(tuple(f["id"] for f in flags)) & 0xFFFFFFFF)

    # Include segment definitions for local resolution
    segments_list, _ = await segment_repository.list_segments(session, limit=10000, offset=0)
    segments = [{"id": s.id, "key": s.key, "name": s.name, "conditions": s.get_conditions()} for s in segments_list]

    payload = {
        "flags": flags,
        "segments": segments,
        "version": version,
        "generated_at": datetime.now(UTC).isoformat(),
    }

    # Sign the payload
    from phaseflag_api.config import settings
    import json as _json

    payload_bytes = _json.dumps(payload, sort_keys=True).encode()
    signature = _hmac.new(
        settings.API_SECRET_KEY.encode(),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()

    return {**payload, "signature": signature}


async def _compile_flag(flag_db, session: AsyncSession) -> dict[str, Any]:
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


async def _build_flags_map(session: AsyncSession, target_key: str) -> dict[str, dict[str, Any]]:
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
        compiled = await _compile_flag(flag_db, session)
        flags_map[key] = compiled
        for prereq in compiled.get("prerequisites", []):
            await _load(prereq["flag_key"])

    await _load(target_key)
    return flags_map


@router.post("/sdk/evaluate", response_model=EvaluateResponse)
async def evaluate_flag(body: EvaluateRequest, session: AsyncSession = Depends(get_session)):
    flag_db = await flag_repository.get_flag_by_key(session, body.flag_key)
    if flag_db is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flag '{body.flag_key}' not found",
        )
    if flag_db.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Flag '{body.flag_key}' is not active (status={flag_db.status})",
        )

    ctx_dict = {
        "user_id": body.context.user_id,
        "session_id": body.context.session_id,
        **(body.context.attributes or {}),
    }

    # Build a map of this flag + all its prerequisites for proper evaluation
    flags_map = await _build_flags_map(session, body.flag_key)

    # Use prerequisite-aware evaluation
    result = evaluate_with_prerequisites(flags_map, body.flag_key, ctx_dict)

    # Also get trace for the target flag itself
    if body.flag_key in flags_map:
        trace_result = evaluate_with_trace(flags_map[body.flag_key], ctx_dict)
        trace = trace_result.get("trace")
    else:
        trace = None

    flag_db.evaluation_count = (flag_db.evaluation_count or 0) + 1
    flag_db.last_evaluated_at = datetime.now(UTC)
    await flag_repository.update_flag(session, flag_db)

    return EvaluateResponse(
        flag_key=body.flag_key,
        variation_id=result.get("variation_id"),
        variation_key=result.get("variation_key"),
        value=result.get("value"),
        reason=result.get("reason", "default"),
        trace=trace,
    )


@router.post("/sdk/identity/merge", response_model=IdentityMergeResponse)
async def merge_user_identity(body: IdentityMergeRequest):
    """Merge anonymous user flag assignments to an authenticated user identity."""
    merged = merge_identity(body.anonymous_id, body.authenticated_id, body.assignments)
    return IdentityMergeResponse(merged_assignments=merged)


@router.get("/sdk/evaluate-all")
async def evaluate_all_flags(
    user_id: str | None = None,
    session_id: str | None = None,
    session: AsyncSession = Depends(get_session),
):
    """Evaluate ALL active flags for a given context and return a dict of flag_key -> value."""
    ctx_dict: dict[str, Any] = {}
    if user_id:
        ctx_dict["user_id"] = user_id
    if session_id:
        ctx_dict["session_id"] = session_id

    active_flags = await flag_repository.list_active_flags(session)
    results: dict[str, Any] = {}

    for flag_db in active_flags:
        compiled = await _compile_flag(flag_db, session)
        result = evaluate(compiled, ctx_dict)
        results[flag_db.key] = result.get("value")

    return {"evaluations": results, "count": len(results)}


@router.post("/sdk/events", status_code=status.HTTP_202_ACCEPTED)
async def ingest_events(batch: EventBatch, session: AsyncSession = Depends(get_session)):
    import json as _json

    for ev in batch.events:
        ts = datetime.fromisoformat(ev.timestamp) if ev.timestamp else datetime.now(UTC)
        row = EvaluationEventDB(
            flag_key=ev.flag_key,
            variation_key=ev.variation_key,
            user_id=ev.user_id,
            timestamp=ts,
            event_metadata=_json.dumps(ev.metadata) if ev.metadata else "{}",
        )
        session.add(row)
    await session.flush()
    return {"accepted": len(batch.events), "message": "Events persisted"}
