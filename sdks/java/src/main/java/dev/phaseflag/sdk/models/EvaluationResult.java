package dev.phaseflag.sdk.models;

public final class EvaluationResult {
    private final String flagKey;
    private final String variationId;
    private final String variationKey;
    private final Object value;
    private final String reason;

    public EvaluationResult(String flagKey, String variationId, String variationKey,
                            Object value, String reason) {
        this.flagKey = flagKey;
        this.variationId = variationId;
        this.variationKey = variationKey;
        this.value = value;
        this.reason = reason;
    }

    public String getFlagKey() { return flagKey; }
    public String getVariationId() { return variationId; }
    public String getVariationKey() { return variationKey; }
    public Object getValue() { return value; }
    public String getReason() { return reason; }

    @Override
    public String toString() {
        return "EvaluationResult{flagKey='" + flagKey + "', variationKey='" + variationKey
                + "', value=" + value + ", reason='" + reason + "'}";
    }
}
