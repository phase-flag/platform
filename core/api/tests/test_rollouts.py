"""Tests for rollout-related functionality (targeting conditions, percentage rollouts)."""

from phaseflag_api.services.evaluation_engine import (
    _evaluate_condition,
    _normalised_hash,
    allocate_weighted_variation,
    evaluate_group_rollout,
)


def test_condition_is():
    """The 'is' operator matches exact string equality."""
    cond = {"attribute": "plan", "operator": "is", "value": "pro"}
    assert _evaluate_condition(cond, {"plan": "pro"}) is True
    assert _evaluate_condition(cond, {"plan": "free"}) is False


def test_condition_is_not():
    """The 'is_not' operator matches inequality."""
    cond = {"attribute": "plan", "operator": "is_not", "value": "free"}
    assert _evaluate_condition(cond, {"plan": "pro"}) is True
    assert _evaluate_condition(cond, {"plan": "free"}) is False


def test_condition_contains():
    """The 'contains' operator matches substring."""
    cond = {"attribute": "email", "operator": "contains", "value": "@example.com"}
    assert _evaluate_condition(cond, {"email": "user@example.com"}) is True
    assert _evaluate_condition(cond, {"email": "user@other.com"}) is False


def test_condition_not_contains():
    """The 'not_contains' operator matches absence of substring."""
    cond = {"attribute": "email", "operator": "not_contains", "value": "test"}
    assert _evaluate_condition(cond, {"email": "real@example.com"}) is True
    assert _evaluate_condition(cond, {"email": "test@example.com"}) is False


def test_condition_one_of():
    """The 'one_of' operator matches any value in the list."""
    cond = {"attribute": "country", "operator": "one_of", "value": ["US", "CA", "UK"]}
    assert _evaluate_condition(cond, {"country": "US"}) is True
    assert _evaluate_condition(cond, {"country": "DE"}) is False


def test_condition_not_one_of():
    """The 'not_one_of' operator matches values not in the list."""
    cond = {"attribute": "country", "operator": "not_one_of", "value": ["CN", "RU"]}
    assert _evaluate_condition(cond, {"country": "US"}) is True
    assert _evaluate_condition(cond, {"country": "CN"}) is False


def test_condition_gt():
    """The 'gt' operator compares numeric values."""
    cond = {"attribute": "age", "operator": "gt", "value": "18"}
    assert _evaluate_condition(cond, {"age": "25"}) is True
    assert _evaluate_condition(cond, {"age": "16"}) is False


def test_condition_lt():
    """The 'lt' operator compares numeric values."""
    cond = {"attribute": "score", "operator": "lt", "value": "100"}
    assert _evaluate_condition(cond, {"score": "50"}) is True
    assert _evaluate_condition(cond, {"score": "150"}) is False


def test_condition_matches_regex():
    """The 'matches_regex' operator matches a regex pattern."""
    cond = {
        "attribute": "email",
        "operator": "matches_regex",
        "value": r".*@company\.com$",
    }
    assert _evaluate_condition(cond, {"email": "user@company.com"}) is True
    assert _evaluate_condition(cond, {"email": "user@other.com"}) is False


def test_condition_version_gt():
    """The 'version_gt' operator compares semver versions."""
    cond = {"attribute": "app_version", "operator": "version_gt", "value": "2.0.0"}
    assert _evaluate_condition(cond, {"app_version": "2.1.0"}) is True
    assert _evaluate_condition(cond, {"app_version": "1.9.0"}) is False


def test_condition_version_lt():
    """The 'version_lt' operator compares semver versions."""
    cond = {"attribute": "app_version", "operator": "version_lt", "value": "3.0.0"}
    assert _evaluate_condition(cond, {"app_version": "2.5.0"}) is True
    assert _evaluate_condition(cond, {"app_version": "3.1.0"}) is False


def test_condition_missing_attribute():
    """Missing attributes return True for negation operators."""
    cond_is = {"attribute": "plan", "operator": "is", "value": "pro"}
    cond_is_not = {"attribute": "plan", "operator": "is_not", "value": "pro"}

    assert _evaluate_condition(cond_is, {}) is False
    assert _evaluate_condition(cond_is_not, {}) is True


def test_hash_consistency():
    """The same user+flag always gets the same bucket."""
    bucket1 = _normalised_hash("flag-1", "user-123")
    bucket2 = _normalised_hash("flag-1", "user-123")
    assert bucket1 == bucket2


def test_weighted_allocation():
    """Weighted allocation distributes correctly."""
    weights = [
        {"variation_id": "a", "weight": 50},
        {"variation_id": "b", "weight": 30},
        {"variation_id": "c", "weight": 20},
    ]

    counts = {"a": 0, "b": 0, "c": 0}
    for i in range(1000):
        vid = allocate_weighted_variation("test-flag", f"user-{i}", weights)
        if vid:
            counts[vid] += 1

    # Each should be roughly proportional, allow generous margin
    assert counts["a"] > 300
    assert counts["b"] > 150
    assert counts["c"] > 50


def test_group_rollout():
    """Group-based rollout hashes at the group level."""
    flag = {"key": "group-flag"}
    assert isinstance(evaluate_group_rollout(flag, "acme-corp", 50), bool)
    # Same group always gets same result
    r1 = evaluate_group_rollout(flag, "acme-corp", 50)
    r2 = evaluate_group_rollout(flag, "acme-corp", 50)
    assert r1 == r2
