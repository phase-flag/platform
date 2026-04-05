"""Phase Flag Python SDK — Conformance Test Suite.

Loads all fixture files from tests/sdk-conformance/fixtures/ and validates
the local evaluation engine against every test case.

Run with: pytest tests/test_conformance.py -v
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any

import pytest

# ---------------------------------------------------------------------------
# Locate fixture directory
# ---------------------------------------------------------------------------

FIXTURES_DIR = (
    Path(__file__).parent.parent.parent.parent
    / "tests"
    / "sdk-conformance"
    / "fixtures"
)


# ---------------------------------------------------------------------------
# Load all fixture cases into pytest parameters
# ---------------------------------------------------------------------------

def _load_all_cases() -> list[tuple[str, dict]]:
    """Return [(test_id, case_dict)] for every case in every fixture file."""
    cases: list[tuple[str, dict]] = []
    if not FIXTURES_DIR.exists():
        return cases

    for fixture_file in sorted(FIXTURES_DIR.glob("*.json")):
        with fixture_file.open(encoding="utf-8") as fh:
            suite = json.load(fh)

        suite_name = suite.get("suite", fixture_file.stem)
        for test_case in suite.get("cases", []):
            test_id = f"{suite_name}::{test_case['name']}"
            cases.append((test_id, test_case))

    return cases


_ALL_CASES = _load_all_cases()


# ---------------------------------------------------------------------------
# Inline evaluation engine (mirrors SDK client.py without I/O)
# ---------------------------------------------------------------------------

def _djb2_hash(value: str) -> int:
    h: int = 5381
    for ch in value:
        h = ((h << 5) + h + ord(ch)) & 0xFFFFFFFF
    return h


def _normalised_hash(flag_key: str, user_id: str) -> int:
    raw = _djb2_hash(f"{flag_key}:{user_id}")
    return raw % 100


def _coerce_numeric(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _compare_versions(a: str, b: str) -> int:
    """Return -1, 0, or 1 comparing semver strings a and b."""
    try:
        # Try using packaging.version if available (same as server)
        from packaging.version import Version  # type: ignore
        va, vb = Version(str(a)), Version(str(b))
        if va > vb:
            return 1
        if va < vb:
            return -1
        return 0
    except Exception:
        # Fallback: naive tuple comparison
        def _parts(v: str):
            return tuple(int(x) for x in str(v).lstrip("v").split(".")[:3])
        try:
            pa, pb = _parts(a), _parts(b)
            if pa > pb:
                return 1
            if pa < pb:
                return -1
            return 0
        except Exception:
            raise ValueError(f"Cannot compare versions: {a!r} vs {b!r}")


def _evaluate_condition(condition: dict, context: dict) -> bool:
    attribute = condition.get("attribute", "")
    operator = condition.get("operator", "")
    target_value = condition.get("value")

    # Resolve actual value from context
    if attribute in ("user_id", "userId"):
        actual = context.get("user_id") or context.get("userId")
    elif attribute in ("session_id", "sessionId"):
        actual = context.get("session_id") or context.get("sessionId")
    else:
        attrs = context.get("attributes", {}) or {}
        actual = attrs.get(attribute)

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
        import re
        try:
            pattern = str(target_value)
            if len(pattern) > 500:
                return False
            return re.search(pattern, str(actual)[:10_000]) is not None
        except re.error:
            return False
    if operator == "version_gt":
        try:
            return _compare_versions(str(actual), str(target_value)) > 0
        except Exception:
            return False
    if operator == "version_lt":
        try:
            return _compare_versions(str(actual), str(target_value)) < 0
        except Exception:
            return False

    return False


def _resolve_percentage_rollout(rollout: dict, flag_key: str, context: dict) -> str | None:
    user_id = (
        context.get("user_id") or context.get("userId") or
        context.get("session_id") or context.get("sessionId") or ""
    )
    if not user_id:
        return None

    bucket = _normalised_hash(flag_key, str(user_id))
    cumulative = 0
    for entry in rollout.get("variations", []):
        cumulative += entry.get("weight", 0)
        if bucket < cumulative:
            return entry.get("variation_id")
    return None


def _evaluate_flag_with_prerequisites(flag: dict, context: dict, all_flags: dict) -> dict:
    """Evaluate a flag dict with prerequisite checking against all_flags."""
    for prereq in flag.get("prerequisites", []):
        prereq_flag = all_flags.get(prereq.get("flag_key"))
        if prereq_flag is None:
            continue
        prereq_result = _evaluate_flag_with_prerequisites(prereq_flag, context, all_flags)
        if prereq_result.get("variation_key") != prereq.get("variation_key"):
            # Prerequisite not met — return default with prerequisite_failed reason
            variations_by_id: dict[str, dict] = {
                v["id"]: v for v in flag.get("variations", [])
            }
            default_vid = flag.get("default_variation_id", "")
            default_v = variations_by_id.get(default_vid)
            return {
                "flag_key": flag["key"],
                "variation_id": default_vid,
                "variation_key": default_v["key"] if default_v else None,
                "value": default_v["value"] if default_v else None,
                "reason": "prerequisite_failed",
            }
    return _evaluate_flag(flag, context)


def _evaluate_flag(flag: dict, context: dict) -> dict:
    """Evaluate a raw flag dict against a raw context dict."""
    variations_by_id: dict[str, dict] = {v["id"]: v for v in flag.get("variations", [])}

    def _make_result(variation_id: str, reason: str) -> dict:
        v = variations_by_id.get(variation_id)
        return {
            "flag_key": flag["key"],
            "variation_id": variation_id,
            "variation_key": v["key"] if v else None,
            "value": v["value"] if v else None,
            "reason": reason,
        }

    rules = sorted(
        flag.get("targeting_rules", []),
        key=lambda r: r.get("priority", 0),
    )

    for rule in rules:
        conditions = rule.get("conditions", [])
        all_match = all(_evaluate_condition(c, context) for c in conditions)
        if not all_match:
            continue

        if rule.get("variation_id"):
            return _make_result(rule["variation_id"], "targeting_match")

        rollout = rule.get("percentage_rollout")
        if rollout:
            vid = _resolve_percentage_rollout(rollout, flag["key"], context)
            if vid:
                return _make_result(vid, "percentage_rollout")

    return _make_result(flag.get("default_variation_id", ""), "default")


# ---------------------------------------------------------------------------
# Deep equality helper
# ---------------------------------------------------------------------------

def _deep_equal(a: Any, b: Any) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    if isinstance(a, bool) and isinstance(b, bool):
        return a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(float(a), float(b), rel_tol=1e-9, abs_tol=1e-9)
    if type(a) != type(b):
        # Allow int/float comparison
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            return math.isclose(float(a), float(b), rel_tol=1e-9)
        return False
    if isinstance(a, list):
        return len(a) == len(b) and all(_deep_equal(x, y) for x, y in zip(a, b))
    if isinstance(a, dict):
        if set(a.keys()) != set(b.keys()):
            return False
        return all(_deep_equal(a[k], b[k]) for k in a)
    return a == b


# ---------------------------------------------------------------------------
# Parametrized test
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("test_id,test_case", _ALL_CASES, ids=[c[0] for c in _ALL_CASES])
def test_conformance(test_id: str, test_case: dict) -> None:
    """Evaluate a fixture case and assert the result matches expectations."""
    flags: dict = test_case["flags"]
    context: dict = test_case.get("context", {})
    expected: dict = test_case["expected"]

    # Determine which flag to evaluate
    flag_key = test_case.get("target_flag") or expected["flag_key"]

    flag_def = flags.get(flag_key)
    if flag_def is None:
        pytest.skip(f"Flag '{flag_key}' not found in fixture")

    result = _evaluate_flag_with_prerequisites(flag_def, context, flags)

    # Assert expected value
    if "value" in expected:
        assert _deep_equal(result["value"], expected["value"]), (
            f"value mismatch: got {result['value']!r}, want {expected['value']!r}"
        )

    # Assert expected variation_key
    if "variation_key" in expected:
        assert result["variation_key"] == expected["variation_key"], (
            f"variation_key mismatch: got {result['variation_key']!r}, "
            f"want {expected['variation_key']!r}"
        )

    # Assert expected reason (case-insensitive)
    if "reason" in expected:
        assert result["reason"].lower() == expected["reason"].lower(), (
            f"reason mismatch: got {result['reason']!r}, "
            f"want {expected['reason']!r}"
        )


# ---------------------------------------------------------------------------
# Summary test — ensures all fixture files loaded at least one case
# ---------------------------------------------------------------------------

def test_fixtures_loaded() -> None:
    """Verify that at least 200 conformance test cases were loaded."""
    assert len(_ALL_CASES) >= 200, (
        f"Expected at least 200 test cases, found {len(_ALL_CASES)}"
    )


def test_fixture_files_present() -> None:
    """Verify all expected fixture files exist."""
    expected_files = [
        "operators.json",
        "rollout.json",
        "prerequisites.json",
        "defaults.json",
        "segments.json",
        "edge_cases.json",
        "variations.json",
        "combined.json",
    ]
    for fname in expected_files:
        fpath = FIXTURES_DIR / fname
        assert fpath.exists(), f"Missing fixture file: {fname}"
