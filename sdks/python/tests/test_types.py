"""Basic unit tests for the Phase Flag Python SDK."""

from phaseflag import (
    EvaluationContext,
    EvaluationResult,
    FlagDefinition,
    Variation,
)


def test_evaluation_context_get_user_id():
    ctx = EvaluationContext(user_id="u-123", attributes={"plan": "pro"})
    assert ctx.get("user_id") == "u-123"
    assert ctx.get("plan") == "pro"
    assert ctx.get("missing", "default") == "default"


def test_evaluation_context_to_dict():
    ctx = EvaluationContext(user_id="u-1", session_id="s-1", attributes={"x": 1})
    d = ctx.to_dict()
    assert d["user_id"] == "u-1"
    assert d["session_id"] == "s-1"
    assert d["attributes"] == {"x": 1}


def test_evaluation_result_defaults():
    result = EvaluationResult(flag_key="my-flag")
    assert result.reason == "default"
    assert result.value is None


def test_variation_creation():
    v = Variation(id="v-1", key="on", name="On", value=True)
    assert v.value is True


def test_flag_definition_empty_rules():
    flag = FlagDefinition(
        id="f-1",
        key="feature-x",
        name="Feature X",
        flag_type="boolean",
        status="active",
        environment="production",
        default_variation_id="v-off",
    )
    assert flag.targeting_rules == []
    assert flag.variations == []
