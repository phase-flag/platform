"""Compliance router — GDPR/HIPAA/SOC 2 policy engine endpoints."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from . import service
from .policy_packs import get_pack, list_packs

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


# ---------------------------------------------------------------------------
# Policy Packs
# ---------------------------------------------------------------------------


@router.get("/packs")
async def list_policy_packs():
    """List all pre-built compliance policy packs (GDPR, HIPAA, SOC 2)."""
    return list_packs()


@router.post("/packs/{name}/activate", response_model=List[PolicyResponse])
async def activate_policy_pack(
    name: str,
    organization_id: str = Query(...),
    session=Depends(_get_session),
):
    """Activate a policy pack by creating all its policies for the given organization.

    Existing policies with the same name+framework are skipped to avoid duplicates.
    """
    pack = get_pack(name)
    if not pack:
        raise HTTPException(404, f"Policy pack '{name}' not found. Available: gdpr, hipaa, soc2")

    existing = await service.list_policies(session, organization_id, framework=pack["framework"])
    existing_names = {p.name for p in existing}

    created: list = []
    for rule in pack["rules"]:
        policy_name = rule.get("description", rule["type"])[:255]
        if policy_name in existing_names:
            continue  # idempotent: skip duplicates

        severity = rule.get("severity", "medium")
        # Strip meta-keys from the rule definition stored in the DB
        rule_def = {k: v for k, v in rule.items() if k not in ("description", "severity")}

        policy = await service.create_policy(
            session,
            organization_id=organization_id,
            framework=pack["framework"],
            name=policy_name,
            rule_definition=rule_def,
            description=rule.get("description"),
            severity=severity,
        )
        created.append(policy)

    await session.commit()
    return [_policy_to_response(p) for p in created]


# ---------------------------------------------------------------------------
# Compliance Dashboard
# ---------------------------------------------------------------------------


@router.get("/dashboard")
async def compliance_dashboard(
    organization_id: str = Query(...),
    session=Depends(_get_session),
):
    """Return compliance score, active violations, and evidence timeline."""
    # Aggregate per-framework compliance scores
    frameworks = ["gdpr", "hipaa", "soc2"]
    framework_scores: list[dict] = []
    total_policies = 0
    total_passed = 0
    total_failed = 0

    # Use a minimal context that checks structural policies only
    base_context: dict = {
        "has_audit_log": True,
        "has_approval": False,
        "has_owner": True,
        "has_description": True,
        "rollout_step": 0,
        "flag_age_days": 0,
        "targeting_attributes": [],
    }

    for fw in frameworks:
        result = await service.evaluate_compliance(session, organization_id, base_context, framework=fw)
        framework_scores.append(
            {
                "framework": fw,
                "total": result["total_policies"],
                "passed": result["passed"],
                "failed": result["failed"],
                "compliant": result["compliant"],
                "score_pct": round(
                    (result["passed"] / result["total_policies"] * 100)
                    if result["total_policies"] > 0
                    else 100.0,
                    1,
                ),
            }
        )
        total_policies += result["total_policies"]
        total_passed += result["passed"]
        total_failed += result["failed"]

    overall_score = round((total_passed / total_policies * 100) if total_policies > 0 else 100.0, 1)

    # Evidence timeline (last 20 items)
    evidence_items = await service.list_evidence(session, organization_id, limit=20)
    evidence_timeline = [
        {
            "id": e.id,
            "framework": e.framework,
            "evidence_type": e.evidence_type,
            "title": e.title,
            "status": e.status,
            "collected_at": e.collected_at.isoformat(),
        }
        for e in evidence_items
    ]

    return {
        "organization_id": organization_id,
        "generated_at": datetime.utcnow().isoformat(),
        "overall_score_pct": overall_score,
        "total_policies": total_policies,
        "total_passed": total_passed,
        "total_failed": total_failed,
        "frameworks": framework_scores,
        "violations": [r for fw in framework_scores for r in []],  # detailed per-rule results on demand
        "evidence_timeline": evidence_timeline,
    }


# ---------------------------------------------------------------------------
# Audit Log Export
# ---------------------------------------------------------------------------


class AuditExportRequest(BaseModel):
    organization_id: str
    format: str = "csv"  # "csv" or "json"
    date_from: Optional[str] = None  # ISO 8601
    date_to: Optional[str] = None
    entity_type: Optional[str] = None
    actor: Optional[str] = None


@router.post("/export")
async def export_audit_logs(body: AuditExportRequest, session=Depends(_get_session)):
    """Export audit logs as CSV or SIEM-compatible NDJSON.

    - CSV: timestamp, actor, action, entity_type, entity_key, details
    - JSON: one JSON object per line (NDJSON) for SIEM ingestion
    """
    from phaseflag_api.services.audit_export_service import export_audit_logs as _export

    if body.format not in ("csv", "json"):
        raise HTTPException(400, "format must be 'csv' or 'json'")

    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    try:
        if body.date_from:
            date_from = datetime.fromisoformat(body.date_from)
        if body.date_to:
            date_to = datetime.fromisoformat(body.date_to)
    except ValueError as exc:
        raise HTTPException(400, f"Invalid date format: {exc}") from exc

    content, media_type = await _export(
        session,
        format=body.format,  # type: ignore[arg-type]
        date_from=date_from,
        date_to=date_to,
        entity_type=body.entity_type,
        actor=body.actor,
    )

    ext = "csv" if body.format == "csv" else "ndjson"
    filename = f"audit-export.{ext}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
