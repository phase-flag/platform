"""Governance service — policy engine, freeze windows, break-glass.

Policy rule_definition JSON schemas:

freeze_window:
  {"start": "2026-12-20T00:00:00", "end": "2026-12-31T23:59:59", "reason": "Holiday freeze"}

require_approval:
  {"min_approvals": 2, "approver_roles": ["admin", "editor"]}

two_person_rule:
  {"require_different_actor": true}

break_glass:
  {"allowed_roles": ["admin"], "require_reason": true, "notify": ["ops@example.com"]}

role_restriction:
  {"allowed_roles": ["admin"], "actions": ["flag.delete", "flag.archive"]}

change_window:
  {"allowed_days": ["monday", "tuesday", "wednesday", "thursday", "friday"],
   "allowed_hours_start": 9, "allowed_hours_end": 17, "timezone": "UTC"}
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import AuditTrail, PolicyRule


# ---------------------------------------------------------------------------
# Policy CRUD
# ---------------------------------------------------------------------------

async def create_policy(
    session: AsyncSession,
    organization_id: str,
    name: str,
    policy_type: str,
    rule_definition: Dict[str, Any],
    environment: Optional[str] = None,
    description: Optional[str] = None,
    priority: int = 100,
    created_by: Optional[str] = None,
) -> PolicyRule:
    policy = PolicyRule(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        environment=environment,
        name=name,
        description=description,
        policy_type=policy_type,
        rule_definition=json.dumps(rule_definition),
        is_active=1,
        priority=priority,
        created_by=created_by,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    session.add(policy)
    await session.flush()
    return policy


async def get_policy(session: AsyncSession, policy_id: str) -> Optional[PolicyRule]:
    stmt = select(PolicyRule).where(PolicyRule.id == policy_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def list_policies(
    session: AsyncSession,
    organization_id: str,
    environment: Optional[str] = None,
    policy_type: Optional[str] = None,
) -> List[PolicyRule]:
    conditions = [PolicyRule.organization_id == organization_id]
    if environment:
        conditions.append(
            (PolicyRule.environment == environment) | (PolicyRule.environment.is_(None))
        )
    if policy_type:
        conditions.append(PolicyRule.policy_type == policy_type)
    stmt = select(PolicyRule).where(and_(*conditions)).order_by(PolicyRule.priority)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def update_policy(
    session: AsyncSession, policy_id: str, **kwargs: Any
) -> Optional[PolicyRule]:
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
# Policy evaluation engine
# ---------------------------------------------------------------------------

def _evaluate_freeze_window(rule_def: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    """Check if current time is within a freeze window."""
    start_str = rule_def.get("start", "")
    end_str = rule_def.get("end", "")
    try:
        start = datetime.fromisoformat(start_str)
        end = datetime.fromisoformat(end_str)
    except ValueError:
        return {"allowed": True, "reason": "Invalid freeze window dates"}

    if start <= now <= end:
        reason = rule_def.get("reason", "Environment is frozen")
        return {"allowed": False, "reason": f"Frozen: {reason} (until {end_str})"}
    return {"allowed": True, "reason": "Not in freeze window"}


def _evaluate_change_window(rule_def: Dict[str, Any], now: datetime) -> Dict[str, Any]:
    """Check if current time is within allowed change hours."""
    allowed_days = [d.lower() for d in rule_def.get("allowed_days", [])]
    start_hour = rule_def.get("allowed_hours_start", 0)
    end_hour = rule_def.get("allowed_hours_end", 24)

    day_name = now.strftime("%A").lower()
    if allowed_days and day_name not in allowed_days:
        return {"allowed": False, "reason": f"Changes not allowed on {day_name}"}

    if not (start_hour <= now.hour < end_hour):
        return {"allowed": False, "reason": f"Changes only allowed between {start_hour}:00 and {end_hour}:00"}

    return {"allowed": True, "reason": "Within change window"}


def _evaluate_role_restriction(
    rule_def: Dict[str, Any], context: Dict[str, Any]
) -> Dict[str, Any]:
    """Check if the actor's role is allowed for the action."""
    allowed_roles = rule_def.get("allowed_roles", [])
    restricted_actions = rule_def.get("actions", [])
    actor_role = context.get("actor_role", "")
    action = context.get("action", "")

    if restricted_actions and action not in restricted_actions:
        return {"allowed": True, "reason": "Action not restricted by this policy"}

    if actor_role in allowed_roles:
        return {"allowed": True, "reason": f"Role '{actor_role}' is allowed"}

    return {"allowed": False, "reason": f"Role '{actor_role}' is not authorized. Requires one of: {allowed_roles}"}


def _evaluate_require_approval(
    rule_def: Dict[str, Any], context: Dict[str, Any]
) -> Dict[str, Any]:
    """Check if required approvals are met."""
    min_approvals = rule_def.get("min_approvals", 1)
    approvals = context.get("approvals", 0)

    if approvals >= min_approvals:
        return {"allowed": True, "reason": f"Has {approvals}/{min_approvals} approvals"}
    return {"allowed": False, "reason": f"Needs {min_approvals} approvals, has {approvals}"}


def _evaluate_two_person_rule(
    rule_def: Dict[str, Any], context: Dict[str, Any]
) -> Dict[str, Any]:
    """Ensure the actor is not the same as the author of the change."""
    if not rule_def.get("require_different_actor", True):
        return {"allowed": True, "reason": "Two-person rule disabled"}

    actor = context.get("actor", "")
    author = context.get("change_author", "")

    if actor and author and actor == author:
        return {"allowed": False, "reason": "Two-person rule: actor cannot approve their own change"}
    return {"allowed": True, "reason": "Two-person rule satisfied"}


async def evaluate_policy(
    session: AsyncSession,
    organization_id: str,
    action: str,
    context: Dict[str, Any],
    environment: Optional[str] = None,
) -> Dict[str, Any]:
    """Evaluate all active policies for an action.

    Context should include:
    - actor: who is performing the action
    - actor_role: their role
    - action: the action being performed
    - approvals: number of approvals (if applicable)
    - change_author: who authored the change (for two-person rule)
    - is_break_glass: whether this is a break-glass override
    """
    policies = await list_policies(session, organization_id, environment)
    active_policies = [p for p in policies if p.is_active]

    now = datetime.utcnow()
    context["action"] = action
    results: List[Dict[str, Any]] = []
    overall_allowed = True
    is_break_glass = context.get("is_break_glass", False)

    for policy in active_policies:
        rule_def = json.loads(policy.rule_definition)
        evaluation: Dict[str, Any] = {"policy_id": policy.id, "policy_name": policy.name, "type": policy.policy_type}

        if policy.policy_type == "freeze_window":
            evaluation.update(_evaluate_freeze_window(rule_def, now))
        elif policy.policy_type == "change_window":
            evaluation.update(_evaluate_change_window(rule_def, now))
        elif policy.policy_type == "role_restriction":
            evaluation.update(_evaluate_role_restriction(rule_def, context))
        elif policy.policy_type == "require_approval":
            evaluation.update(_evaluate_require_approval(rule_def, context))
        elif policy.policy_type == "two_person_rule":
            evaluation.update(_evaluate_two_person_rule(rule_def, context))
        elif policy.policy_type == "break_glass":
            # Break glass policies define who can use break glass
            if is_break_glass:
                allowed_roles = rule_def.get("allowed_roles", [])
                actor_role = context.get("actor_role", "")
                if actor_role in allowed_roles:
                    evaluation["allowed"] = True
                    evaluation["reason"] = "Break-glass authorized"
                else:
                    evaluation["allowed"] = False
                    evaluation["reason"] = f"Break-glass requires role: {allowed_roles}"
            else:
                evaluation["allowed"] = True
                evaluation["reason"] = "Break-glass not invoked"
        else:
            evaluation["allowed"] = True
            evaluation["reason"] = f"Unknown policy type: {policy.policy_type}"

        results.append(evaluation)
        if not evaluation.get("allowed", True):
            overall_allowed = False

    # Break-glass override: if invoked and a break_glass policy allows it, override denials.
    # SECURITY: Break-glass requires a documented reason and is always audit-logged.
    if is_break_glass and not overall_allowed:
        break_glass_reason = context.get("break_glass_reason", "").strip()
        if not break_glass_reason:
            return {
                "allowed": False,
                "is_break_glass": True,
                "error": "Break-glass override requires a documented reason (break_glass_reason field)",
                "total_policies": len(active_policies),
                "results": results,
            }

        break_glass_authorized = any(
            r.get("type") == "break_glass" and r.get("allowed", False)
            for r in results
        )
        if break_glass_authorized:
            overall_allowed = True
            for r in results:
                if not r.get("allowed"):
                    r["overridden_by_break_glass"] = True

            # Audit-log the break-glass override
            await log_action(
                session,
                organization_id=organization_id,
                action="break_glass_override",
                resource_type="policy",
                actor=context.get("actor", "unknown"),
                environment=environment,
                actor_role=context.get("actor_role"),
                details={
                    "reason": break_glass_reason,
                    "overridden_policies": [
                        r["policy_name"] for r in results if r.get("overridden_by_break_glass")
                    ],
                },
            )

    return {
        "allowed": overall_allowed,
        "is_break_glass": is_break_glass,
        "total_policies": len(active_policies),
        "results": results,
    }


# ---------------------------------------------------------------------------
# Audit trail
# ---------------------------------------------------------------------------

async def log_action(
    session: AsyncSession,
    organization_id: str,
    action: str,
    resource_type: str,
    actor: str,
    resource_id: Optional[str] = None,
    environment: Optional[str] = None,
    actor_role: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    policy_id: Optional[str] = None,
    policy_result: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> AuditTrail:
    entry = AuditTrail(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        environment=environment,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        actor=actor,
        actor_role=actor_role,
        details=json.dumps(details) if details else None,
        policy_id=policy_id,
        policy_result=policy_result,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.utcnow(),
    )
    session.add(entry)
    await session.flush()
    return entry


async def get_audit_trail(
    session: AsyncSession,
    organization_id: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    actor: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> List[AuditTrail]:
    conditions = [AuditTrail.organization_id == organization_id]
    if resource_type:
        conditions.append(AuditTrail.resource_type == resource_type)
    if resource_id:
        conditions.append(AuditTrail.resource_id == resource_id)
    if actor:
        conditions.append(AuditTrail.actor == actor)
    if action:
        conditions.append(AuditTrail.action == action)

    stmt = (
        select(AuditTrail)
        .where(and_(*conditions))
        .order_by(AuditTrail.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
