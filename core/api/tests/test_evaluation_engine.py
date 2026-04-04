"""Tests for the evaluation engine (unit tests, no HTTP)."""

import pytest

from phaseflag_api.services.evaluation_engine import (
    _djb2_hash,
    _normalised_hash,
    evaluate,
    evaluate_with_prerequisites,
    evaluate_with_trace,
    topological_sort_prerequisites,
)


def _make_flag(key="test-flag", status="active", rules=None, default_var_id="v-off"):
    """Helper to build a flag dict for evaluation tests."""
    return {
        "key": key,
        "status": status,
        "default_variation_id": default_var_id,
        "variations": [
            {"id": "v-on", "key": "on", "value": True},
            {"id": "v-off", "key": "off", "value": False},
        ],
        "targeting_rules": rules or [],
        "prerequisites": [],
    }


def test_djb2_hash_deterministic():
    """DJB2 hash returns the same value for the same input."""
    assert _djb2_hash("test") == _djb2_hash("test")
    assert _djb2_hash("a") != _djb2_hash("b")


def test_normalised_hash_range():
    """Normalised hash returns values in [0, 100)."""
    for i in range(100):
        result = _normalised_hash("flag", f"user-{i}")
        assert 0 <= result < 100


def test_evaluate_default_no_rules():
    """A flag with no targeting rules returns the default variation."""
    flag = _make_flag()
    result = evaluate(flag, {"user_id": "user1"})

    assert result["variation_key"] == "off"
    assert result["value"] is False
    assert result["reason"] == "default"


def test_evaluate_targeting_match():
    """A matching targeting rule serves the specified variation."""
    flag = _make_flag(
        rules=[
            {
                "priority": 1,
                "conditions": [{"attribute": "plan", "operator": "is", "value": "pro"}],
                "variation_id": "v-on",
            }
        ]
    )

    result = evaluate(flag, {"user_id": "user1", "plan": "pro"})
    assert result["variation_key"] == "on"
    assert result["value"] is True
    assert result["reason"] == "targeting_match"


def test_evaluate_targeting_no_match():
    """A non-matching targeting rule falls through to default."""
    flag = _make_flag(
        rules=[
            {
                "priority": 1,
                "conditions": [
                    {"attribute": "plan", "operator": "is", "value": "enterprise"}
                ],
                "variation_id": "v-on",
            }
        ]
    )

    result = evaluate(flag, {"user_id": "user1", "plan": "free"})
    assert result["variation_key"] == "off"
    assert result["reason"] == "default"


def test_evaluate_percentage_rollout():
    """Percentage rollout distributes users deterministically."""
    flag = _make_flag(
        rules=[
            {
                "priority": 1,
                "conditions": [],
                "percentage_rollout": {
                    "variations": [
                        {"variation_id": "v-on", "weight": 50},
                        {"variation_id": "v-off", "weight": 50},
                    ],
                },
            }
        ]
    )

    on_count = 0
    total = 1000
    for i in range(total):
        result = evaluate(flag, {"user_id": f"user-{i}"})
        if result["variation_key"] == "on":
            on_count += 1

    # Should be roughly 50%, allow generous margin
    assert 350 < on_count < 650


def test_evaluate_priority_ordering():
    """Higher priority (lower number) rules are evaluated first."""
    flag = _make_flag(
        rules=[
            {
                "priority": 2,
                "conditions": [
                    {"attribute": "country", "operator": "is", "value": "US"}
                ],
                "variation_id": "v-off",
            },
            {
                "priority": 1,
                "conditions": [{"attribute": "plan", "operator": "is", "value": "pro"}],
                "variation_id": "v-on",
            },
        ]
    )

    result = evaluate(flag, {"user_id": "user1", "plan": "pro", "country": "US"})
    assert result["variation_key"] == "on"
    assert result["reason"] == "targeting_match"


def test_evaluate_multiple_conditions_and():
    """All conditions in a rule must match (AND logic)."""
    flag = _make_flag(
        rules=[
            {
                "priority": 1,
                "conditions": [
                    {"attribute": "plan", "operator": "is", "value": "pro"},
                    {"attribute": "country", "operator": "is", "value": "US"},
                ],
                "variation_id": "v-on",
            }
        ]
    )

    # Both match
    result = evaluate(flag, {"user_id": "u1", "plan": "pro", "country": "US"})
    assert result["variation_key"] == "on"

    # Only one matches
    result = evaluate(flag, {"user_id": "u1", "plan": "pro", "country": "UK"})
    assert result["variation_key"] == "off"


def test_evaluate_with_trace_returns_trace():
    """evaluate_with_trace includes a trace with rule evaluation details."""
    flag = _make_flag(
        rules=[
            {
                "priority": 1,
                "conditions": [{"attribute": "plan", "operator": "is", "value": "pro"}],
                "variation_id": "v-on",
            }
        ]
    )

    result = evaluate_with_trace(flag, {"user_id": "u1", "plan": "pro"})
    assert "trace" in result
    assert result["trace"]["rules_evaluated"] == 1
    assert result["trace"]["matched_rule_index"] == 0


def test_topological_sort_simple():
    """Topological sort orders prerequisites before dependents."""
    flags = {
        "flag-a": {
            "key": "flag-a",
            "prerequisites": [{"flag_key": "flag-b", "variation_key": "on"}],
            "variations": [],
            "targeting_rules": [],
        },
        "flag-b": {
            "key": "flag-b",
            "prerequisites": [],
            "variations": [],
            "targeting_rules": [],
        },
    }

    order = topological_sort_prerequisites(flags, "flag-a")
    assert order.index("flag-b") < order.index("flag-a")


def test_topological_sort_circular_raises():
    """Circular prerequisites raise ValueError."""
    flags = {
        "flag-a": {
            "key": "flag-a",
            "prerequisites": [{"flag_key": "flag-b", "variation_key": "on"}],
            "variations": [],
            "targeting_rules": [],
        },
        "flag-b": {
            "key": "flag-b",
            "prerequisites": [{"flag_key": "flag-a", "variation_key": "on"}],
            "variations": [],
            "targeting_rules": [],
        },
    }

    with pytest.raises(ValueError, match="Circular"):
        topological_sort_prerequisites(flags, "flag-a")


def test_evaluate_with_prerequisites_met():
    """When all prerequisites are met, the target flag evaluates normally."""
    flags = {
        "prereq": _make_flag(
            key="prereq",
            rules=[
                {
                    "priority": 1,
                    "conditions": [],
                    "variation_id": "v-on",
                }
            ],
        ),
        "target": {
            **_make_flag(
                key="target",
                rules=[
                    {
                        "priority": 1,
                        "conditions": [],
                        "variation_id": "v-on",
                    }
                ],
            ),
            "prerequisites": [{"flag_key": "prereq", "variation_key": "on"}],
        },
    }

    result = evaluate_with_prerequisites(flags, "target", {"user_id": "u1"})
    assert result["variation_key"] == "on"


def test_evaluate_with_prerequisites_failed():
    """When a prerequisite is not met, the default variation is returned."""
    flags = {
        "prereq": _make_flag(key="prereq"),  # No rules -> default (off)
        "target": {
            **_make_flag(
                key="target",
                rules=[
                    {
                        "priority": 1,
                        "conditions": [],
                        "variation_id": "v-on",
                    }
                ],
            ),
            "prerequisites": [{"flag_key": "prereq", "variation_key": "on"}],
        },
    }

    result = evaluate_with_prerequisites(flags, "target", {"user_id": "u1"})
    assert result["reason"] == "prerequisite_failed"
