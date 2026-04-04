"""Compliance service — GDPR/HIPAA/SOC 2 policy engine with evidence generation."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import ComplianceEvidence, CompliancePolicy, DataRetentionRule


# ---------------------------------------------------------------------------
# Policy CRUD
# ---------------------------------------------------------------------------

async def create_policy(
    session: AsyncSession,
    organization_id: str,
    framework: str,
    name: str,
    rule_definition: Dict[str, Any],
    description: Optional[str] = None,
    severity: str = "medium",
) -> CompliancePolicy:
    policy = CompliancePolicy(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        framework=framework,
        name=name,
        description=description,
        rule_definition=json.dumps(rule_definition),
        severity=severity,
        is_active=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(policy)
    await session.flush()
    return policy


async def get_policy(session: AsyncSession, policy_id: str) -> Optional[CompliancePolicy]:
    stmt = select(CompliancePolicy).where(CompliancePolicy.id == policy_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_policies(
    session: AsyncSession, organization_id: str, framework: Optional[str] = None
) -> List[CompliancePolicy]:
    conditions = [CompliancePolicy.organization_id == organization_id]
    if framework:
        conditions.append(CompliancePolicy.framework == framework)
    stmt = select(CompliancePolicy).where(and_(*conditions)).order_by(CompliancePolicy.created_at.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def update_policy(
    session: AsyncSession, policy_id: str, **kwargs: Any
) -> Optional[CompliancePolicy]:
    policy = await get_policy(session, policy_id)
    if not policy:
        return None
    for key, val in kwargs.items():
        if key == "rule_definition" and isinstance(val, dict):
            setattr(policy, key, json.dumps(val))
        elif hasattr(policy, key) and val is not None:
            setattr(policy, key, val)
    policy.updated_at = datetime.utcnow()
    await session.flush()
    return policy


async def delete_policy(session: AsyncSession, policy_id: str) -> bool:
    policy = await get_policy(session, policy_id)
    if not policy:
        return False
    await session.delete(policy)
    await session.flush()
    return True


# ---------------------------------------------------------------------------
# Compliance evaluation engine
# ---------------------------------------------------------------------------

# Supported rule types:
# {
#   "type": "require_audit_log",          -- flag changes must be audit-logged
#   "type": "require_approval",           -- production changes need approval
#   "type": "max_rollout_step",           -- max % increase per rollout step
#     "max_step": 25,
#   "type": "require_owner",              -- flags must have an assigned owner
#   "type": "max_flag_age_days",          -- flags must not exceed age
#     "max_days": 90,
#   "type": "require_description",        -- flags must have descriptions
#   "type": "pii_restriction",            -- no PII attributes in targeting
#     "restricted_attributes": ["ssn", "dob", "credit_card"]
# }


def _evaluate_rule(
    rule_def: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """Evaluate a single policy rule against a context.

    Context contains information about the flag/change being checked:
    {
        "flag_key": "...",
        "has_audit_log": true,
        "has_approval": false,
        "rollout_step": 50,
        "has_owner": true,
        "flag_age_days": 120,
        "has_description": true,
        "targeting_attributes": ["country", "email"],
    }
    """
    rule_type = rule_def.get("type", "")
    result = {"rule_type": rule_type, "passed": True, "details": ""}

    if rule_type == "require_audit_log":
        if not context.get("has_audit_log", False):
            result["passed"] = False
            result["details"] = "Audit logging is required but not enabled."

    elif rule_type == "require_approval":
        if not context.get("has_approval", False):
            result["passed"] = False
            result["details"] = "Production change requires approval."

    elif rule_type == "max_rollout_step":
        max_step = rule_def.get("max_step", 25)
        actual = context.get("rollout_step", 0)
        if actual > max_step:
            result["passed"] = False
            result["details"] = f"Rollout step {actual}% exceeds maximum {max_step}%."

    elif rule_type == "require_owner":
        if not context.get("has_owner", False):
            result["passed"] = False
            result["details"] = "Flag must have an assigned owner."

    elif rule_type == "max_flag_age_days":
        max_days = rule_def.get("max_days", 90)
        age = context.get("flag_age_days", 0)
        if age > max_days:
            result["passed"] = False
            result["details"] = f"Flag age ({age} days) exceeds maximum ({max_days} days)."

    elif rule_type == "require_description":
        if not context.get("has_description", False):
            result["passed"] = False
            result["details"] = "Flag must have a description."

    elif rule_type == "pii_restriction":
        restricted = set(rule_def.get("restricted_attributes", []))
        used = set(context.get("targeting_attributes", []))
        overlap = restricted & used
        if overlap:
            result["passed"] = False
            result["details"] = f"PII attributes used in targeting: {sorted(overlap)}"

    else:
        result["details"] = f"Unknown rule type: {rule_type}"

    return result


async def evaluate_compliance(
    session: AsyncSession,
    organization_id: str,
    context: Dict[str, Any],
    framework: Optional[str] = None,
) -> Dict[str, Any]:
    """Evaluate all active policies against a context.

    Returns a compliance report with pass/fail per policy.
    """
    policies = await list_policies(session, organization_id, framework)
    active_policies = [p for p in policies if p.is_active]

    results = []
    all_passed = True

    for policy in active_policies:
        rule_def = json.loads(policy.rule_definition)
        evaluation = _evaluate_rule(rule_def, context)
        evaluation["policy_id"] = policy.id
        evaluation["policy_name"] = policy.name
        evaluation["framework"] = policy.framework
        evaluation["severity"] = policy.severity
        results.append(evaluation)
        if not evaluation["passed"]:
            all_passed = False

    return {
        "compliant": all_passed,
        "total_policies": len(active_policies),
        "passed": sum(1 for r in results if r["passed"]),
        "failed": sum(1 for r in results if not r["passed"]),
        "results": results,
    }


# ---------------------------------------------------------------------------
# Evidence generation
# ---------------------------------------------------------------------------

async def generate_evidence(
    session: AsyncSession,
    organization_id: str,
    framework: str,
    evidence_type: str,
    title: str,
    data: Dict[str, Any],
    description: Optional[str] = None,
    policy_id: Optional[str] = None,
) -> ComplianceEvidence:
    evidence = ComplianceEvidence(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        policy_id=policy_id,
        framework=framework,
        evidence_type=evidence_type,
        title=title,
        description=description,
        data=json.dumps(data),
        status="collected",
        collected_at=datetime.utcnow(),
    )
    session.add(evidence)
    await session.flush()
    return evidence


async def list_evidence(
    session: AsyncSession,
    organization_id: str,
    framework: Optional[str] = None,
    limit: int = 100,
) -> List[ComplianceEvidence]:
    conditions = [ComplianceEvidence.organization_id == organization_id]
    if framework:
        conditions.append(ComplianceEvidence.framework == framework)
    stmt = (
        select(ComplianceEvidence)
        .where(and_(*conditions))
        .order_by(ComplianceEvidence.collected_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def review_evidence(
    session: AsyncSession, evidence_id: str, reviewer: str, status: str = "reviewed"
) -> Optional[ComplianceEvidence]:
    stmt = select(ComplianceEvidence).where(ComplianceEvidence.id == evidence_id)
    result = await session.execute(stmt)
    evidence = result.scalar_one_or_none()
    if not evidence:
        return None
    evidence.status = status
    evidence.reviewed_by = reviewer
    evidence.reviewed_at = datetime.utcnow()
    await session.flush()
    return evidence


# ---------------------------------------------------------------------------
# Data retention
# ---------------------------------------------------------------------------

async def create_retention_rule(
    session: AsyncSession,
    organization_id: str,
    data_type: str,
    retention_days: int,
    action: str = "delete",
) -> DataRetentionRule:
    rule = DataRetentionRule(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        data_type=data_type,
        retention_days=retention_days,
        action=action,
        is_active=1,
        created_at=datetime.utcnow(),
    )
    session.add(rule)
    await session.flush()
    return rule


async def list_retention_rules(
    session: AsyncSession, organization_id: str
) -> List[DataRetentionRule]:
    stmt = (
        select(DataRetentionRule)
        .where(DataRetentionRule.organization_id == organization_id)
        .order_by(DataRetentionRule.data_type)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def apply_retention(
    session: AsyncSession, organization_id: str
) -> Dict[str, Any]:
    """Evaluate retention rules and report which data would be affected.

    In a real system this would delete/anonymize old records. Here we
    calculate the cutoff dates and mark the rules as applied.
    """
    rules = await list_retention_rules(session, organization_id)
    applied: List[Dict[str, Any]] = []

    for rule in rules:
        if not rule.is_active:
            continue
        cutoff = datetime.utcnow() - timedelta(days=rule.retention_days)
        applied.append({
            "rule_id": rule.id,
            "data_type": rule.data_type,
            "action": rule.action,
            "retention_days": rule.retention_days,
            "cutoff_date": cutoff.isoformat(),
        })
        rule.last_applied_at = datetime.utcnow()

    await session.flush()
    return {"applied_rules": len(applied), "details": applied}
