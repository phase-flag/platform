package dev.phaseflag.sdk.models;

/**
 * Type-safe wrapper for flag values supporting boolean, string, number, and JSON types.
 */
public final class FlagValue {
    private final Object rawValue;

    public FlagValue(Object rawValue) {
        this.rawValue = rawValue;
    }

    public Object getRawValue() { return rawValue; }

    public boolean asBoolean(boolean defaultValue) {
        if (rawValue instanceof Boolean) return (Boolean) rawValue;
        return defaultValue;
    }

    public String asString(String defaultValue) {
        if (rawValue instanceof String) return (String) rawValue;
        return defaultValue;
    }

    public double asNumber(double defaultValue) {
        if (rawValue instanceof Number) return ((Number) rawValue).doubleValue();
        return defaultValue;
    }

    public int asInt(int defaultValue) {
        if (rawValue instanceof Number) return ((Number) rawValue).intValue();
        return defaultValue;
    }

    @SuppressWarnings("unchecked")
    public <T> T asJson(T defaultValue) {
        if (rawValue == null) return defaultValue;
        try {
            return (T) rawValue;
        } catch (ClassCastException e) {
            return defaultValue;
        }
    }

    public boolean isNull() { return rawValue == null; }
}
