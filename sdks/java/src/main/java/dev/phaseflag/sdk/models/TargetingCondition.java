package dev.phaseflag.sdk.models;

public final class TargetingCondition {
    private final String attribute;
    private final String operator;
    private final Object value;

    public TargetingCondition(String attribute, String operator, Object value) {
        this.attribute = attribute;
        this.operator = operator;
        this.value = value;
    }

    public String getAttribute() { return attribute; }
    public String getOperator() { return operator; }
    public Object getValue() { return value; }
}
