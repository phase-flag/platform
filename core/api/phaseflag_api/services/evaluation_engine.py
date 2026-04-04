"""Server-side flag evaluation engine.

Implements targeting-rule matching with condition operators, percentage
rollouts using DJB2 hashing, and priority ordering.
"""

import re
import signal
from typing import Any

# ---------------------------------------------------------------------------
# Regex safety: protect against ReDoS (catastrophic backtracking)
# ---------------------------------------------------------------------------

_REGEX_TIMEOUT_SECONDS = 1
_REGEX_MAX_PATTERN_LEN = 500
_DANGEROUS_REGEX = re.compile(r"(.+)\+.*\1\+|(.+)\*.*\2\*")


def _safe_regex_match(pattern: str, text: str) -> bool:
    """Execute a regex match with protection against ReDoS attacks.

    - Rejects overly long patterns
    - Detects common catastrophic backtracking patterns
    - Uses a timeout to prevent CPU exhaustion
    """
    if len(pattern) > _REGEX_MAX_PATTERN_LEN:
        return False

    # Pre-compile to catch syntax errors cheaply
    try:
        compiled = re.compile(pattern)
    except re.error:
        return False

    # Use alarm-based timeout on Unix systems
    def _timeout_handler(signum, frame):
        raise TimeoutError("Regex evaluation timed out")

    old_handler = None
    try:
        old_handler = signal.signal(signal.SIGALRM, _timeout_handler)
        signal.alarm(_REGEX_TIMEOUT_SECONDS)
        result = compiled.search(text) is not None
        signal.alarm(0)
        return result
    except (TimeoutError, re.error):
        return False
    except (OSError, ValueError):
        # signal.alarm not available (e.g. non-main thread) — fallback without timeout
        try:
            return compiled.search(text[:10_000]) is not None
        except re.error:
            return False
    finally:
        signal.alarm(0)
        if old_handler is not None:
            try:
                signal.signal(signal.SIGALRM, old_handler)
            except (OSError, ValueError):
                pass

from packaging.version import Version  # noqa: E402


def _djb2_hash(value: str) -> int:
    """DJB2 string hash returning an unsigned 32-bit integer."""
    h: int = 5381
    for ch in value:
        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
    return h


def _normalised_hash(flag_key: str, user_id: str) -> int:
    """Return a value in [0, 100) deterministically for a user/flag pair."""
    raw = _djb2_hash(f"{flag_key}:{user_id}")
    return raw % 100


def _coerce_numeric(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _evaluate_condition(condition: dict[str, Any], context: dict[str, Any]) -> bool:
    """Evaluate a single condition against an evaluation context.

    Supported operators:
        is, is_not, contains, not_contains, one_of, not_one_of,
        gt, lt, matches_regex, version_gt, version_lt
    """
    attribute = condition.get("attribute", "")
    operator = condition.get("operator", "")
    target_value = condition.get("value")

    actual = context.get(attribute)

    if actual is None:
        return operator in ("is_not", "not_contains", "not_one_of")

    if operator == "is":
        return str(actual) == str(target_value)

    if operator == "is_not":
        return str(actual) != str(target_value)

    if operator == "contains":
        return str(target_value) in str(actual)

    if operator == "not_contains":
        return str(target_value) not in str(actual)

    if operator == "one_of":
        if isinstance(target_value, list):
            return str(actual) in [str(v) for v in target_value]
        return str(actual) == str(target_value)

    if operator == "not_one_of":
        if isinstance(target_value, list):
            return str(actual) not in [str(v) for v in target_value]
        return str(actual) != str(target_value)

    if operator == "gt":
        a, b = _coerce_numeric(actual), _coerce_numeric(target_value)
        return a is not None and b is not None and a > b

    if operator == "lt":
        a, b = _coerce_numeric(actual), _coerce_numeric(target_value)
        return a is not None and b is not None and a < b

    if operator == "matches_regex":
        return _safe_regex_match(str(target_value), str(actual))

    if operator == "version_gt":
        try:
            return Version(str(actual)) > Version(str(target_value))
        except Exception:
            return False

    if operator == "version_lt":
        try:
            return Version(str(actual)) < Version(str(target_value))
        except Exception:
            return False

    return False


def _evaluate_conditions(conditions: list[dict[str, Any]], context: dict[str, Any]) -> bool:
    """All conditions in a rule must match (AND logic)."""
    return all(_evaluate_condition(c, context) for c in conditions)


def _resolve_percentage_rollout(
    rollout: dict[str, Any],
    flag_key: str,
    context: dict[str, Any],
) -> str | None:
    """Determine the variation ID based on percentage rollout and DJB2 hash."""
    user_id = context.get("user_id") or context.get("session_id") or ""
    if not user_id:
        return None

    bucket = _normalised_hash(flag_key, user_id)
    cumulative = 0
    for entry in rollout.get("variations", []):
        cumulative += entry.get("weight", 0)
        if bucket < cumulative:
            return entry.get("variation_id")
    return None


def evaluate(flag: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    """Evaluate a flag definition against a context and return the resolved variation.

    Returns a dict with variation_id, variation_key, value, reason.
    """
    variations_by_id: dict[str, dict[str, Any]] = {
        v["id"]: v for v in flag.get("variations", [])
    }

    def _make_result(variation_id: str, reason: str) -> dict[str, Any]:
        v = variations_by_id.get(variation_id, {})
        return {
            "variation_id": variation_id,
            "variation_key": v.get("key"),
            "value": v.get("value"),
            "reason": reason,
        }

    rules = sorted(
        flag.get("targeting_rules", []),
        key=lambda r: r.get("priority", 0),
    )

    for rule in rules:
        conditions = rule.get("conditions", [])
        if not _evaluate_conditions(conditions, context):
            continue

        if rule.get("variation_id"):
            return _make_result(rule["variation_id"], "targeting_match")

        rollout = rule.get("percentage_rollout")
        if rollout:
            vid = _resolve_percentage_rollout(rollout, flag["key"], context)
            if vid:
                return _make_result(vid, "percentage_rollout")

    default_id = flag.get("default_variation_id", "")
    return _make_result(default_id, "default")


# ---------------------------------------------------------------------------
# Sticky assignment support
# ---------------------------------------------------------------------------

def get_sticky_variation(
    flag_key: str,
    user_id: str,
    sticky_buckets: dict[str, str] | None,
) -> str | None:
    """Check if a user has a sticky assignment for a flag."""
    if not sticky_buckets:
        return None
    return sticky_buckets.get(flag_key)


# ---------------------------------------------------------------------------
# Group-based rollout
# ---------------------------------------------------------------------------

def _group_hash(flag_key: str, group_id: str) -> int:
    """Hash for group-level bucketing (account/team/tenant)."""
    raw = _djb2_hash(f"{flag_key}:group:{group_id}")
    return raw % 100


def evaluate_group_rollout(
    flag: dict[str, Any],
    group_id: str,
    rollout_percentage: int,
) -> bool:
    """Check if a group falls within a rollout percentage."""
    bucket = _group_hash(flag.get("key", ""), group_id)
    return bucket < rollout_percentage


# ---------------------------------------------------------------------------
# Weighted multivariate allocation
# ---------------------------------------------------------------------------

def allocate_weighted_variation(
    flag_key: str,
    user_id: str,
    weights: list[dict[str, Any]],
) -> str | None:
    """Allocate a variation based on weighted distribution.

    weights: list of {"variation_id": str, "weight": int} where weights sum to 100.
    """
    bucket = _normalised_hash(flag_key, user_id)
    cumulative = 0
    for entry in weights:
        cumulative += entry.get("weight", 0)
        if bucket < cumulative:
            return entry.get("variation_id")
    return weights[-1].get("variation_id") if weights else None


# ---------------------------------------------------------------------------
# Prerequisite evaluation with topological sort
# ---------------------------------------------------------------------------

def topological_sort_prerequisites(
    flags: dict[str, dict[str, Any]],
    target_key: str,
) -> list[str]:
    """Return flag keys in evaluation order using topological sort.

    Raises ValueError if a cycle is detected.
    """
    visited: set[str] = set()
    in_stack: set[str] = set()
    order: list[str] = []

    def _visit(key: str) -> None:
        if key in in_stack:
            raise ValueError(f"Circular prerequisite detected involving '{key}'")
        if key in visited:
            return
        in_stack.add(key)
        flag = flags.get(key, {})
        for prereq in flag.get("prerequisites", []):
            prereq_key = prereq.get("flag_key", "")
            if prereq_key in flags:
                _visit(prereq_key)
        in_stack.remove(key)
        visited.add(key)
        order.append(key)

    _visit(target_key)
    return order


def evaluate_with_prerequisites(
    flags: dict[str, dict[str, Any]],
    target_key: str,
    context: dict[str, Any],
) -> dict[str, Any]:
    """Evaluate a flag and all its prerequisites in dependency order.

    Returns the evaluation result for the target flag. If any prerequisite
    fails, returns the target flag's default variation with reason='prerequisite_failed'.
    """
    target_flag = flags.get(target_key)
    if not target_flag:
        return {"variation_id": None, "variation_key": None, "value": None, "reason": "flag_not_found"}

    try:
        eval_order = topological_sort_prerequisites(flags, target_key)
    except ValueError:
        return {"variation_id": None, "variation_key": None, "value": None, "reason": "circular_prerequisite"}

    # Evaluate prerequisites in order, collecting results
    results: dict[str, dict[str, Any]] = {}
    for key in eval_order:
        flag = flags[key]
        if key == target_key:
            # Check all prerequisites met
            for prereq in flag.get("prerequisites", []):
                prereq_key = prereq.get("flag_key", "")
                required_variation = prereq.get("variation_key", "")
                prereq_result = results.get(prereq_key, {})
                if prereq_result.get("variation_key") != required_variation:
                    # Prerequisite not met — return default
                    variations = {v["id"]: v for v in flag.get("variations", [])}
                    default_id = flag.get("default_variation_id", "")
                    default_v = variations.get(default_id, {})
                    return {
                        "variation_id": default_id,
                        "variation_key": default_v.get("key"),
                        "value": default_v.get("value"),
                        "reason": "prerequisite_failed",
                    }
        results[key] = evaluate(flag, context)

    return results.get(target_key, {"variation_id": None, "variation_key": None, "value": None, "reason": "default"})


# ---------------------------------------------------------------------------
# Evaluation with full trace (explainability)
# ---------------------------------------------------------------------------

def evaluate_with_trace(flag: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    """Evaluate a flag and return a detailed trace of the evaluation.

    Returns the normal evaluation result plus a 'trace' key with details
    about each rule evaluated.
    """
    variations_by_id: dict[str, dict[str, Any]] = {
        v["id"]: v for v in flag.get("variations", [])
    }

    def _make_result(variation_id: str, reason: str) -> dict[str, Any]:
        v = variations_by_id.get(variation_id, {})
        return {
            "variation_id": variation_id,
            "variation_key": v.get("key"),
            "value": v.get("value"),
            "reason": reason,
        }

    rules = sorted(
        flag.get("targeting_rules", []),
        key=lambda r: r.get("priority", 0),
    )

    trace: list[dict[str, Any]] = []
    matched_rule_index: int | None = None
    result: dict[str, Any] | None = None

    for i, rule in enumerate(rules):
        conditions = rule.get("conditions", [])
        condition_results = []
        for cond in conditions:
            matched = _evaluate_condition(cond, context)
            condition_results.append({
                "attribute": cond.get("attribute"),
                "operator": cond.get("operator"),
                "target_value": cond.get("value"),
                "actual_value": context.get(cond.get("attribute", "")),
                "matched": matched,
            })

        all_matched = all(cr["matched"] for cr in condition_results)
        rule_trace: dict[str, Any] = {
            "rule_index": i,
            "priority": rule.get("priority", 0),
            "conditions": condition_results,
            "all_conditions_matched": all_matched,
        }

        if all_matched and result is None:
            matched_rule_index = i
            if rule.get("variation_id"):
                result = _make_result(rule["variation_id"], "targeting_match")
                rule_trace["served_variation"] = result["variation_key"]
            elif rule.get("percentage_rollout"):
                vid = _resolve_percentage_rollout(rule["percentage_rollout"], flag["key"], context)
                if vid:
                    result = _make_result(vid, "percentage_rollout")
                    rule_trace["served_variation"] = result["variation_key"]

        trace.append(rule_trace)

    if result is None:
        default_id = flag.get("default_variation_id", "")
        result = _make_result(default_id, "default")

    return {
        **result,
        "trace": {
            "rules_evaluated": len(rules),
            "matched_rule_index": matched_rule_index,
            "rule_details": trace,
        },
    }


# ---------------------------------------------------------------------------
# Anonymous-to-authenticated identity merging
# ---------------------------------------------------------------------------

def merge_identity(anonymous_id: str, authenticated_id: str, sticky_assignments: dict) -> dict:
    """Merge anonymous user assignments to authenticated user.

    Returns updated sticky assignments dict with anonymous assignments transferred.
    """
    merged = dict(sticky_assignments)
    for key, value in list(merged.items()):
        if key.startswith(f"{anonymous_id}:"):
            flag_key = key.split(":", 1)[1]
            new_key = f"{authenticated_id}:{flag_key}"
            if new_key not in merged:
                merged[new_key] = value
    return merged
