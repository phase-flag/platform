package dev.phaseflag.sdk.models;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * User/request attributes sent to targeting-rule evaluation.
 *
 * <p>The {@code userId} is used for deterministic percentage rollouts.
 * When absent, {@code sessionId} is used as a fallback.
 * Arbitrary key-value pairs in {@code attributes} are checked by targeting conditions.
 */
public final class EvaluationContext {

    private final String userId;
    private final String sessionId;
    private final Map<String, Object> attributes;

    public EvaluationContext(String userId, String sessionId, Map<String, Object> attributes) {
        this.userId = userId;
        this.sessionId = sessionId;
        this.attributes = attributes != null
                ? Collections.unmodifiableMap(new HashMap<>(attributes))
                : Collections.emptyMap();
    }

    public String getUserId() { return userId; }
    public String getSessionId() { return sessionId; }
    public Map<String, Object> getAttributes() { return attributes; }

    public Object get(String key) {
        if ("user_id".equals(key)) return userId;
        if ("session_id".equals(key)) return sessionId;
        return attributes.get(key);
    }

    public Map<String, Object> toMap() {
        var map = new HashMap<String, Object>();
        map.put("user_id", userId);
        map.put("session_id", sessionId);
        map.put("attributes", attributes);
        return map;
    }

    public static EvaluationContext empty() {
        return new EvaluationContext(null, null, null);
    }

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private String userId;
        private String sessionId;
        private Map<String, Object> attributes = new HashMap<>();
        private Builder() {}
        public Builder userId(String userId) { this.userId = userId; return this; }
        public Builder sessionId(String sessionId) { this.sessionId = sessionId; return this; }
        public Builder attribute(String key, Object value) { this.attributes.put(key, value); return this; }
        public Builder attributes(Map<String, Object> attributes) { this.attributes = new HashMap<>(attributes); return this; }
        public EvaluationContext build() { return new EvaluationContext(userId, sessionId, attributes); }
    }
}
