"""Verification service — simplified constraint solver for flag rules.

Checks for:
- Contradictions: two rules with identical conditions but different outcomes
- Dead rules: rules that can never match because a higher-priority rule
  has strictly more permissive (superset) conditions
- Unreachable rules: rules whose conditions are logically impossible
  (e.g. attribute > 100 AND attribute < 50)
- Overlapping rules: rules whose conditions partially overlap but serve
  different variations (potential non-determinism)
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import VerificationResult


# ---------------------------------------------------------------------------
# Types for rules
# ---------------------------------------------------------------------------
# A rule is a dict like:
# {
#   "priority": 1,
#   "conditions": [
#     {"attribute": "country", "operator": "is", "value": "US"},
#     {"attribute": "age", "operator": "gt", "value": 18}
#   ],
#   "variation": "variant_a",
#   "rollout_percentage": 100.0
# }

_COMPARISON_OPS = {"gt", "lt", "gte", "lte"}
_EQUALITY_OPS = {"is", "is_not"}
_SET_OPS = {"one_of", "not_one_of", "contains", "not_contains"}
_ALL_OPS = _COMPARISON_OPS | _EQUALITY_OPS | _SET_OPS | {"matches_regex", "version_gt", "version_lt"}


def _conditions_key(conditions: List[Dict[str, Any]]) -> str:
    """Canonical string key for a set of conditions (for easy comparison)."""
    normalized = sorted(conditions, key=lambda c: (c.get("attribute", ""), c.get("operator", "")))
    return json.dumps(normalized, sort_keys=True)


def _is_impossible_condition(cond: Dict[str, Any]) -> bool:
    """Detect trivially impossible single conditions."""
    op = cond.get("operator", "")
    val = cond.get("value")
    # A regex of empty string, or negative numeric thresholds, etc.
    if op == "matches_regex" and val == "(?!.*)":
        return True
    return False


def _conditions_are_impossible(conditions: List[Dict[str, Any]]) -> Optional[str]:
    """Detect logically impossible condition sets (AND logic).

    Returns a human-readable reason if impossible, else None.
    """
    if not conditions:
        return None

    for c in conditions:
        if _is_impossible_condition(c):
            return f"Condition on '{c.get('attribute')}' with operator '{c.get('operator')}' can never match"

    # Group by attribute
    by_attr: Dict[str, List[Dict[str, Any]]] = {}
    for c in conditions:
        attr = c.get("attribute", "")
        by_attr.setdefault(attr, []).append(c)

    for attr, conds in by_attr.items():
        # Check for contradictory equality: is X AND is_not X on same value
        is_vals = {c["value"] for c in conds if c.get("operator") == "is"}
        is_not_vals = {c["value"] for c in conds if c.get("operator") == "is_not"}
        if is_vals and is_not_vals and is_vals & is_not_vals:
            return f"Attribute '{attr}': 'is' and 'is_not' on same value '{is_vals & is_not_vals}'"

        # Multiple 'is' with different values
        if len(is_vals) > 1:
            return f"Attribute '{attr}': multiple 'is' conditions with different values {is_vals}"

        # Check for contradictory numeric bounds: gt X AND lt Y where Y <= X
        gt_vals = [c["value"] for c in conds if c.get("operator") in ("gt", "gte")]
        lt_vals = [c["value"] for c in conds if c.get("operator") in ("lt", "lte")]
        if gt_vals and lt_vals:
            try:
                max_lower = max(float(v) for v in gt_vals)
                min_upper = min(float(v) for v in lt_vals)
                # For strict gt/lt the range is empty if min_upper <= max_lower
                if min_upper <= max_lower:
                    return f"Attribute '{attr}': numeric range impossible (lower={max_lower}, upper={min_upper})"
            except (ValueError, TypeError):
                pass

        # one_of AND not_one_of with complete overlap
        one_of_sets = [set(c["value"]) for c in conds if c.get("operator") == "one_of" and isinstance(c.get("value"), list)]
        not_one_of_sets = [set(c["value"]) for c in conds if c.get("operator") == "not_one_of" and isinstance(c.get("value"), list)]
        if one_of_sets and not_one_of_sets:
            allowed = one_of_sets[0]
            for s in one_of_sets[1:]:
                allowed &= s
            for s in not_one_of_sets:
                allowed -= s
            if not allowed:
                return f"Attribute '{attr}': one_of/not_one_of leaves no valid values"

    return None


def _conditions_overlap(
    conds_a: List[Dict[str, Any]], conds_b: List[Dict[str, Any]]
) -> bool:
    """Heuristic check: do two condition sets possibly match the same user?"""
    attrs_a = {c.get("attribute") for c in conds_a}
    attrs_b = {c.get("attribute") for c in conds_b}
    shared = attrs_a & attrs_b

    for attr in shared:
        a_conds = [c for c in conds_a if c.get("attribute") == attr]
        b_conds = [c for c in conds_b if c.get("attribute") == attr]

        a_is = {c["value"] for c in a_conds if c.get("operator") == "is"}
        b_is = {c["value"] for c in b_conds if c.get("operator") == "is"}
        if a_is and b_is and not (a_is & b_is):
            return False  # Mutually exclusive equality checks

        a_is_not = {c["value"] for c in a_conds if c.get("operator") == "is_not"}
        if a_is and a_is_not and a_is.issubset(a_is_not):
            return False

    return True


def _is_superset(broader: List[Dict[str, Any]], narrower: List[Dict[str, Any]]) -> bool:
    """Check if broader conditions are a strict superset (more permissive) than narrower.

    Simplified: broader is a superset if it has fewer or equal conditions and
    every condition in broader also appears in narrower.
    """
    if len(broader) >= len(narrower):
        return False

    broader_keys = {_conditions_key([c]) for c in broader}
    narrower_keys = {_conditions_key([c]) for c in narrower}
    return broader_keys.issubset(narrower_keys)


async def verify_flag_rules(
    session: AsyncSession,
    flag_key: str,
    rules: List[Dict[str, Any]],
    environment: str = "production",
) -> VerificationResult:
    """Verify a set of targeting rules for correctness issues."""
    contradictions: List[str] = []
    dead_rules: List[str] = []
    unreachable: List[str] = []
    overlapping: List[str] = []
    warnings: List[str] = []

    if not rules:
        warnings.append("No targeting rules defined; flag will always serve default variation.")

    sorted_rules = sorted(rules, key=lambda r: r.get("priority", 999))

    # 1. Check each rule for impossible conditions
    for i, rule in enumerate(sorted_rules):
        conds = rule.get("conditions", [])
        reason = _conditions_are_impossible(conds)
        if reason:
            unreachable.append(f"Rule {i + 1} (priority {rule.get('priority')}): {reason}")

    # 2. Pairwise comparisons
    for i in range(len(sorted_rules)):
        conds_i = sorted_rules[i].get("conditions", [])
        var_i = sorted_rules[i].get("variation", "")
        key_i = _conditions_key(conds_i)

        for j in range(i + 1, len(sorted_rules)):
            conds_j = sorted_rules[j].get("conditions", [])
            var_j = sorted_rules[j].get("variation", "")
            key_j = _conditions_key(conds_j)

            # Contradiction: same conditions, different outcomes
            if key_i == key_j and var_i != var_j:
                contradictions.append(
                    f"Rules {i + 1} and {j + 1} have identical conditions but serve "
                    f"different variations ('{var_i}' vs '{var_j}')"
                )

            # Dead rule: higher-priority rule is strictly more permissive
            if _is_superset(conds_i, conds_j):
                dead_rules.append(
                    f"Rule {j + 1} (priority {sorted_rules[j].get('priority')}) is shadowed by "
                    f"rule {i + 1} (priority {sorted_rules[i].get('priority')})"
                )

            # Overlapping: conditions can match same user, different variations
            if var_i != var_j and key_i != key_j:
                if _conditions_overlap(conds_i, conds_j):
                    rollout_i = sorted_rules[i].get("rollout_percentage", 100)
                    rollout_j = sorted_rules[j].get("rollout_percentage", 100)
                    if rollout_i < 100 and rollout_j < 100:
                        overlapping.append(
                            f"Rules {i + 1} and {j + 1} have overlapping conditions with "
                            f"partial rollouts — some users may match both"
                        )

    # 3. Warn on 100% rollout covering all traffic before later rules
    for i, rule in enumerate(sorted_rules):
        if not rule.get("conditions") and rule.get("rollout_percentage", 100) == 100:
            if i < len(sorted_rules) - 1:
                warnings.append(
                    f"Rule {i + 1} has no conditions and 100% rollout — "
                    f"all subsequent rules ({i + 2}..{len(sorted_rules)}) are unreachable"
                )

    is_valid = not contradictions and not unreachable
    summary_parts = []
    if contradictions:
        summary_parts.append(f"{len(contradictions)} contradiction(s)")
    if dead_rules:
        summary_parts.append(f"{len(dead_rules)} dead rule(s)")
    if unreachable:
        summary_parts.append(f"{len(unreachable)} unreachable rule(s)")
    if overlapping:
        summary_parts.append(f"{len(overlapping)} overlapping rule(s)")
    if warnings:
        summary_parts.append(f"{len(warnings)} warning(s)")

    summary = "All rules valid." if is_valid and not dead_rules and not overlapping else "Issues found: " + ", ".join(summary_parts)

    result = VerificationResult(
        id=str(uuid.uuid4()),
        flag_key=flag_key,
        environment=environment,
        is_valid=1 if is_valid else 0,
        num_rules=len(rules),
        contradictions=json.dumps(contradictions) if contradictions else None,
        dead_rules=json.dumps(dead_rules) if dead_rules else None,
        unreachable_rules=json.dumps(unreachable) if unreachable else None,
        overlapping_rules=json.dumps(overlapping) if overlapping else None,
        warnings=json.dumps(warnings) if warnings else None,
        summary=summary,
        created_at=datetime.utcnow(),
    )
    session.add(result)
    await session.flush()
    return result


async def get_results(
    session: AsyncSession, flag_key: str
) -> List[VerificationResult]:
    stmt = (
        select(VerificationResult)
        .where(VerificationResult.flag_key == flag_key)
        .order_by(VerificationResult.created_at.desc())
    )
    rows = await session.execute(stmt)
    return list(rows.scalars().all())
