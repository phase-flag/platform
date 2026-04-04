package dev.phaseflag.sdk.models;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class EvaluationEvent {
    private final String flagKey;
    private final String variationKey;
    private final String userId;
    private final String timestamp;
    private final Map<String, Object> metadata;

    public EvaluationEvent(String flagKey, String variationKey, String userId,
                           String timestamp, Map<String, Object> metadata) {
        this.flagKey = flagKey;
        this.variationKey = variationKey;
        this.userId = userId;
        this.timestamp = timestamp;
        this.metadata = metadata != null
                ? Collections.unmodifiableMap(new HashMap<>(metadata))
                : Collections.emptyMap();
    }

    public String getFlagKey() { return flagKey; }
    public String getVariationKey() { return variationKey; }
    public String getUserId() { return userId; }
    public String getTimestamp() { return timestamp; }
    public Map<String, Object> getMetadata() { return metadata; }

    public Map<String, Object> toMap() {
        var map = new HashMap<String, Object>();
        map.put("flag_key", flagKey);
        map.put("variation_key", variationKey);
        map.put("user_id", userId);
        map.put("timestamp", timestamp);
        map.put("metadata", metadata);
        return map;
    }
}
