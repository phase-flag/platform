"""Governance router — policy engine, freeze windows, break-glass, audit trail."""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from . import service

router = APIRouter()


async def _get_session():
    raise RuntimeError("Override _get_session dependency in host app.")


# -- Schemas --

class PolicyCreate(BaseModel):
    organization_id: str
    name: str
    policy_type: str
    rule_definition: Dict[str, Any]
    environment: Optional[str] = None
    description: Optional[str] = None
    priority: int = 100
    created_by: Optional[str] = None


class PolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rule_definition: Optional[Dict[str, Any]] = None
    is_active: Optional[int] = None
    priority: Optional[int] = None


class PolicyResponse(BaseModel):
    id: str
    organization_id: str
    environment: Optional[str]
    name: str
    description: Optional[str]
    policy_type: str
    rule_definition: Dict[str, Any]
    is_active: bool
    priority: int
    created_by: Optional[str]
    created_at: str


class EvaluateRequest(BaseModel):
    organization_id: str
    action: str
    context: Dict[str, Any]
    environment: Optional[str] = None


class AuditLogCreate(BaseModel):
    organization_id: str
    action: str
    resource_type: str
    actor: str
    resource_id: Optional[str] = None
    environment: Optional[str] = None
    actor_role: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    policy_id: Optional[str] = None
    policy_result: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class AuditTrailResponse(BaseModel):
    id: str
    organization_id: str
    environment: Optional[str]
    action: str
    resource_type: str
    resource_id: Optional[str]
    actor: str
    actor_role: Optional[str]
    details: Optional[Dict[str, Any]]
    policy_id: Optional[str]
    policy_result: Optional[str]
    created_at: str


def _policy_to_response(p) -> PolicyResponse:
    return PolicyResponse(
        id=p.id, organization_id=p.organization_id,
        environment=p.environment, name=p.name,
        description=p.description, policy_type=p.policy_type,
        rule_definition=json.loads(p.rule_definition),
        is_active=bool(p.is_active), priority=p.priority,
        created_by=p.created_by, created_at=p.created_at.isoformat(),
    )


def _audit_to_response(a) -> AuditTrailResponse:
    return AuditTrailResponse(
        id=a.id, organization_id=a.organization_id,
        environment=a.environment, action=a.action,
        resource_type=a.resource_type, resource_id=a.resource_id,
        actor=a.actor, actor_role=a.actor_role,
        details=json.loads(a.details) if a.details else None,
        policy_id=a.policy_id, policy_result=a.policy_result,
        created_at=a.created_at.isoformat(),
    )


# -- Policy Endpoints --

@router.post("/policies", response_model=PolicyResponse)
async def create_policy(body: PolicyCreate, session=Depends(_get_session)):
    policy = await service.create_policy(
        session, **body.model_dump(),
    )
    await session.commit()
    return _policy_to_response(policy)


@router.get("/policies", response_model=List[PolicyResponse])
async def list_policies(
    organization_id: str = Query(...),
    environment: Optional[str] = Query(None),
    policy_type: Optional[str] = Query(None),
    session=Depends(_get_session),
):
    policies = await service.list_policies(session, organization_id, environment, policy_type)
    return [_policy_to_response(p) for p in policies]


@router.get("/policies/{policy_id}", response_model=PolicyResponse)
async def get_policy(policy_id: str, session=Depends(_get_session)):
    policy = await service.get_policy(session, policy_id)
    if not policy:
        raise HTTPException(404, "Policy not found")
    return _policy_to_response(policy)


@router.put("/policies/{policy_id}", response_model=PolicyResponse)
async def update_policy(policy_id: str, body: PolicyUpdate, session=Depends(_get_session)):
    policy = await service.update_policy(session, policy_id, **body.model_dump(exclude_none=True))
    if not policy:
        raise HTTPException(404, "Policy not found")
    await session.commit()
    return _policy_to_response(policy)


@router.delete("/policies/{policy_id}")
async def delete_policy(policy_id: str, session=Depends(_get_session)):
    deleted = await service.delete_policy(session, policy_id)
    if not deleted:
        raise HTTPException(404, "Policy not found")
    await session.commit()
    return {"deleted": True}


# -- Policy Evaluation --

@router.post("/evaluate")
async def evaluate_policy(body: EvaluateRequest, session=Depends(_get_session)):
    result = await service.evaluate_policy(
        session, body.organization_id, body.action, body.context, body.environment,
    )
    return result


# -- Audit Trail --

@router.post("/audit", response_model=AuditTrailResponse)
async def create_audit_entry(body: AuditLogCreate, session=Depends(_get_session)):
    entry = await service.log_action(session, **body.model_dump())
    await session.commit()
    return _audit_to_response(entry)


@router.get("/audit", response_model=List[AuditTrailResponse])
async def list_audit_trail(
    organization_id: str = Query(...),
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    actor: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    session=Depends(_get_session),
):
    entries = await service.get_audit_trail(
        session, organization_id, resource_type, resource_id, actor, action, limit, offset,
    )
    return [_audit_to_response(e) for e in entries]
