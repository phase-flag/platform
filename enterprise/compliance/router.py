"""Compliance router — GDPR/HIPAA/SOC 2 policy engine endpoints."""

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
    framework: str
    name: str
    rule_definition: Dict[str, Any]
    description: Optional[str] = None
    severity: str = "medium"


class PolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rule_definition: Optional[Dict[str, Any]] = None
    severity: Optional[str] = None
    is_active: Optional[int] = None


class PolicyResponse(BaseModel):
    id: str
    organization_id: str
    framework: str
    name: str
    description: Optional[str]
    rule_definition: Dict[str, Any]
    severity: str
    is_active: bool
    created_at: str


class ComplianceCheckRequest(BaseModel):
    organization_id: str
    context: Dict[str, Any]
    framework: Optional[str] = None


class EvidenceCreate(BaseModel):
    organization_id: str
    framework: str
    evidence_type: str
    title: str
    data: Dict[str, Any]
    description: Optional[str] = None
    policy_id: Optional[str] = None


class EvidenceResponse(BaseModel):
    id: str
    framework: str
    evidence_type: str
    title: str
    description: Optional[str]
    status: str
    collected_at: str
    reviewed_by: Optional[str]
    reviewed_at: Optional[str]


class EvidenceReview(BaseModel):
    reviewer: str
    status: str = "reviewed"


class RetentionRuleCreate(BaseModel):
    organization_id: str
    data_type: str
    retention_days: int
    action: str = "delete"


class RetentionRuleResponse(BaseModel):
    id: str
    data_type: str
    retention_days: int
    action: str
    is_active: bool
    last_applied_at: Optional[str]


def _policy_to_response(p) -> PolicyResponse:
    return PolicyResponse(
        id=p.id, organization_id=p.organization_id,
        framework=p.framework, name=p.name,
        description=p.description,
        rule_definition=json.loads(p.rule_definition),
        severity=p.severity, is_active=bool(p.is_active),
        created_at=p.created_at.isoformat(),
    )


# -- Policy Endpoints --

@router.post("/policies", response_model=PolicyResponse)
async def create_policy(body: PolicyCreate, session=Depends(_get_session)):
    policy = await service.create_policy(
        session, body.organization_id, body.framework, body.name,
        body.rule_definition, body.description, body.severity,
    )
    await session.commit()
    return _policy_to_response(policy)


@router.get("/policies", response_model=List[PolicyResponse])
async def list_policies(
    organization_id: str = Query(...),
    framework: Optional[str] = Query(None),
    session=Depends(_get_session),
):
    policies = await service.list_policies(session, organization_id, framework)
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


# -- Compliance Check --

@router.post("/evaluate")
async def evaluate_compliance(body: ComplianceCheckRequest, session=Depends(_get_session)):
    result = await service.evaluate_compliance(
        session, body.organization_id, body.context, body.framework,
    )
    return result


# -- Evidence --

@router.post("/evidence", response_model=EvidenceResponse)
async def create_evidence(body: EvidenceCreate, session=Depends(_get_session)):
    evidence = await service.generate_evidence(
        session, body.organization_id, body.framework, body.evidence_type,
        body.title, body.data, body.description, body.policy_id,
    )
    await session.commit()
    return EvidenceResponse(
        id=evidence.id, framework=evidence.framework,
        evidence_type=evidence.evidence_type, title=evidence.title,
        description=evidence.description, status=evidence.status,
        collected_at=evidence.collected_at.isoformat(),
        reviewed_by=evidence.reviewed_by,
        reviewed_at=evidence.reviewed_at.isoformat() if evidence.reviewed_at else None,
    )


@router.get("/evidence", response_model=List[EvidenceResponse])
async def list_evidence(
    organization_id: str = Query(...),
    framework: Optional[str] = Query(None),
    session=Depends(_get_session),
):
    items = await service.list_evidence(session, organization_id, framework)
    return [
        EvidenceResponse(
            id=e.id, framework=e.framework, evidence_type=e.evidence_type,
            title=e.title, description=e.description, status=e.status,
            collected_at=e.collected_at.isoformat(), reviewed_by=e.reviewed_by,
            reviewed_at=e.reviewed_at.isoformat() if e.reviewed_at else None,
        )
        for e in items
    ]


@router.post("/evidence/{evidence_id}/review", response_model=EvidenceResponse)
async def review_evidence(evidence_id: str, body: EvidenceReview, session=Depends(_get_session)):
    evidence = await service.review_evidence(session, evidence_id, body.reviewer, body.status)
    if not evidence:
        raise HTTPException(404, "Evidence not found")
    await session.commit()
    return EvidenceResponse(
        id=evidence.id, framework=evidence.framework,
        evidence_type=evidence.evidence_type, title=evidence.title,
        description=evidence.description, status=evidence.status,
        collected_at=evidence.collected_at.isoformat(), reviewed_by=evidence.reviewed_by,
        reviewed_at=evidence.reviewed_at.isoformat() if evidence.reviewed_at else None,
    )


# -- Retention Rules --

@router.post("/retention", response_model=RetentionRuleResponse)
async def create_retention(body: RetentionRuleCreate, session=Depends(_get_session)):
    rule = await service.create_retention_rule(
        session, body.organization_id, body.data_type, body.retention_days, body.action,
    )
    await session.commit()
    return RetentionRuleResponse(
        id=rule.id, data_type=rule.data_type, retention_days=rule.retention_days,
        action=rule.action, is_active=bool(rule.is_active),
        last_applied_at=rule.last_applied_at.isoformat() if rule.last_applied_at else None,
    )


@router.get("/retention", response_model=List[RetentionRuleResponse])
async def list_retention(organization_id: str = Query(...), session=Depends(_get_session)):
    rules = await service.list_retention_rules(session, organization_id)
    return [
        RetentionRuleResponse(
            id=r.id, data_type=r.data_type, retention_days=r.retention_days,
            action=r.action, is_active=bool(r.is_active),
            last_applied_at=r.last_applied_at.isoformat() if r.last_applied_at else None,
        )
        for r in rules
    ]


@router.post("/retention/apply")
async def apply_retention(organization_id: str = Query(...), session=Depends(_get_session)):
    result = await service.apply_retention(session, organization_id)
    await session.commit()
    return result
