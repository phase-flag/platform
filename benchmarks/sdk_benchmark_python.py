#!/usr/bin/env python3
"""
Phase Flag Python SDK Local Evaluation Benchmark
=================================================
Measures in-process evaluation throughput with no network I/O.
Uses timeit for accurate timing.

Tests:
  1. Simple boolean flag (no targeting rules)
  2. Flag with 5 targeting rules (attribute matching — match path)
  3. Flag with 5 targeting rules (attribute matching — no-match path)
  4. Flag with percentage rollout (50/50 split)
  5. Flag with 10 targeting rules (worst case)

Usage:
    python benchmarks/sdk_benchmark_python.py

No external dependencies beyond the stdlib.
The evaluation engine is inlined directly from the server-side
core/api/phaseflag_api/services/evaluation_engine.py.
"""

import timeit
from dataclasses import dataclass, field
from typing import Any, Optional

# ---------------------------------------------------------------------------
# Inline evaluation engine (mirrors evaluation_engine.py)
# ---------------------------------------------------------------------------

def _djb2_hash(value: str) -> int:
    h: int = 5381
    for ch in value:
        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
    return h


def _normalised_hash(flag_key: str, user_id: str) -> int:
    return _djb2_hash(f"{flag_key}:{user_id}") % 100


def _coerce_numeric(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _evaluate_condition(condition: dict, context: dict) -> bool:
    attribute = condition.get("attribute", "")
    operator  = condition.get("operator", "")
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

    return False


def _evaluate_conditions(conditions: list, context: dict) -> bool:
    return all(_evaluate_condition(c, context) for c in conditions)


def _resolve_percentage_rollout(rollout: dict, flag_key: str, context: dict) -> Optional[str]:
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


def evaluate(flag: dict, context: dict) -> dict:
    variations_by_id = {v["id"]: v for v in flag.get("variations", [])}

    def _make_result(variation_id: str, reason: str) -> dict:
        v = variations_by_id.get(variation_id, {})
        return {
            "variation_id": variation_id,
            "variation_key": v.get("key"),
            "value": v.get("value"),
            "reason": reason,
        }

    rules = sorted(flag.get("targeting_rules", []), key=lambda r: r.get("priority", 0))

    for rule in rules:
        if not _evaluate_conditions(rule.get("conditions", []), context):
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
# Test fixtures
# ---------------------------------------------------------------------------

SIMPLE_BOOLEAN_FLAG = {
    "id": "flag-001",
    "key": "simple-flag",
    "flag_type": "boolean",
    "status": "active",
    "default_variation_id": "v-off",
    "variations": [
        {"id": "v-on",  "key": "on",  "name": "On",  "value": True},
        {"id": "v-off", "key": "off", "name": "Off", "value": False},
    ],
    "targeting_rules": [],
}

FLAG_WITH_5_RULES = {
    "id": "flag-002",
    "key": "flag-5-rules",
    "flag_type": "boolean",
    "status": "active",
    "default_variation_id": "v-off",
    "variations": [
        {"id": "v-on",  "key": "on",  "name": "On",  "value": True},
        {"id": "v-off", "key": "off", "name": "Off", "value": False},
    ],
    "targeting_rules": [
        {
            "priority": 1,
            "conditions": [{"attribute": "plan", "operator": "is", "value": "enterprise"}],
            "variation_id": "v-on",
        },
        {
            "priority": 2,
            "conditions": [{"attribute": "country", "operator": "one_of", "value": ["us", "ca", "gb"]}],
            "variation_id": "v-on",
        },
        {
            "priority": 3,
            "conditions": [
                {"attribute": "user_id", "operator": "is_not", "value": "anonymous"},
                {"attribute": "age",     "operator": "gt",     "value": 18},
            ],
            "variation_id": "v-on",
        },
        {
            "priority": 4,
            "conditions": [{"attribute": "email", "operator": "contains", "value": "@example.com"}],
            "variation_id": "v-on",
        },
        {
            "priority": 5,
            "conditions": [{"attribute": "version", "operator": "is_not", "value": "1.0"}],
            "variation_id": "v-on",
        },
    ],
}

FLAG_WITH_PERCENTAGE_ROLLOUT = {
    "id": "flag-003",
    "key": "flag-percentage-rollout",
    "flag_type": "boolean",
    "status": "active",
    "default_variation_id": "v-off",
    "variations": [
        {"id": "v-on",  "key": "on",  "name": "On",  "value": True},
        {"id": "v-off", "key": "off", "name": "Off", "value": False},
    ],
    "targeting_rules": [
        {
            "priority": 1,
            "conditions": [],
            "percentage_rollout": {
                "variations": [
                    {"variation_id": "v-on",  "weight": 50},
                    {"variation_id": "v-off", "weight": 50},
                ],
            },
        },
    ],
}

FLAG_WITH_10_RULES = {
    "id": "flag-004",
    "key": "flag-10-rules",
    "flag_type": "string",
    "status": "active",
    "default_variation_id": "v-control",
    "variations": [
        {"id": "v-control",   "key": "control",   "name": "Control",   "value": "control"},
        {"id": "v-treatment", "key": "treatment", "name": "Treatment", "value": "treatment"},
    ],
    "targeting_rules": [
        {
            "priority": i + 1,
            "conditions": [
                {"attribute": "segment",   "operator": "is",     "value": f"segment-{i}"},
                {"attribute": "plan",      "operator": "one_of", "value": ["pro", "enterprise"]},
                {"attribute": "cohort_id", "operator": "gt",     "value": i * 10},
            ],
            "variation_id": "v-treatment",
        }
        for i in range(10)
    ],
}

# ---------------------------------------------------------------------------
# Contexts
# ---------------------------------------------------------------------------

CTX_SIMPLE = {"user_id": "user-abc-123"}
CTX_MATCH = {
    "user_id":   "user-abc-123",
    "plan":      "pro",
    "country":   "us",
    "age":       25,
    "email":     "test@example.com",
    "version":   "2.0",
    "segment":   "segment-3",
    "cohort_id": 45,
}
CTX_NO_MATCH = {
    "user_id": "user-xyz-999",
    "plan":    "free",
    "country": "xx",
    "age":     10,
    "email":   "noone@nowhere.tld",
    "version": "1.0",
}


# ---------------------------------------------------------------------------
# Benchmark runner
# ---------------------------------------------------------------------------

def run_benchmark(name: str, flag: dict, context: dict, iterations: int = 100_000) -> dict:
    # Warm-up
    for _ in range(10_000):
        evaluate(flag, context)

    timer = timeit.Timer(lambda: evaluate(flag, context))
    elapsed = timer.timeit(number=iterations)

    ops_per_sec = iterations / elapsed
    ns_per_op   = (elapsed / iterations) * 1_000_000_000

    return {
        "name":       name,
        "iterations": iterations,
        "elapsed_ms": elapsed * 1000,
        "ops_per_sec": ops_per_sec,
        "ns_per_op":  ns_per_op,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    import sys
    import platform

    print("=" * 70)
    print("Phase Flag Python SDK — Local Evaluation Benchmark")
    print("=" * 70)
    print(f"  Python {sys.version}")
    print(f"  Platform: {platform.system()} {platform.machine()}")
    print(f"  Iterations per scenario: 100,000")
    print()

    scenarios = [
        ("Simple boolean (no rules)",       SIMPLE_BOOLEAN_FLAG,           CTX_SIMPLE),
        ("5 rules — matching context",       FLAG_WITH_5_RULES,             CTX_MATCH),
        ("5 rules — no-match context",       FLAG_WITH_5_RULES,             CTX_NO_MATCH),
        ("Percentage rollout (50/50)",       FLAG_WITH_PERCENTAGE_ROLLOUT,  CTX_SIMPLE),
        ("10 rules — matching context",      FLAG_WITH_10_RULES,            CTX_MATCH),
        ("10 rules — no-match context",      FLAG_WITH_10_RULES,            CTX_NO_MATCH),
    ]

    col = 35
    header = f"  {'Scenario':<{col}} {'Ops/sec':>14} {'ns/op':>10} {'Total ms':>10}"
    print(header)
    print("  " + "-" * (col + 38))

    all_results = []
    for name, flag, ctx in scenarios:
        r = run_benchmark(name, flag, ctx)
        all_results.append(r)
        print(
            f"  {name:<{col}} {r['ops_per_sec']:>14,.0f} "
            f"{r['ns_per_op']:>10.1f} "
            f"{r['elapsed_ms']:>10.1f}"
        )

    print()
    print("Markdown snippet for RESULTS.md:")
    print()
    print("| Scenario | Ops/sec | ns/op | Total ms |")
    print("|----------|---------|-------|----------|")
    for r in all_results:
        print(
            f"| {r['name']} | {r['ops_per_sec']:,.0f} | {r['ns_per_op']:.1f} | {r['elapsed_ms']:.1f} |"
        )
    print()


if __name__ == "__main__":
    main()
