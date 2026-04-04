package dev.phaseflag.sdk;

import java.time.Duration;
import java.util.Objects;

/**
 * Immutable configuration for the {@link PhaseFlagClient}.
 *
 * <p>Use the {@link Builder} to construct instances:
 * <pre>{@code
 * PhaseFlagConfig config = PhaseFlagConfig.builder()
 *     .baseUrl("https://api.example.com/api/v1")
 *     .apiKey("your-api-key")
 *     .pollingInterval(Duration.ofSeconds(60))
 *     .build();
 * }</pre>
 */
public final class PhaseFlagConfig {

    private final String baseUrl;
    private final String apiKey;
    private final Duration pollingInterval;
    private final Duration eventFlushInterval;
    private final int eventBatchSize;

    private PhaseFlagConfig(Builder builder) {
        this.baseUrl = Objects.requireNonNull(builder.baseUrl, "baseUrl is required")
                .replaceAll("/+$", "");
        this.apiKey = Objects.requireNonNull(builder.apiKey, "apiKey is required");
        this.pollingInterval = builder.pollingInterval;
        this.eventFlushInterval = builder.eventFlushInterval;
        this.eventBatchSize = builder.eventBatchSize;
    }

    /** Base URL of the Phase Flag API (e.g. {@code "https://api.example.com/api/v1"}). */
    public String getBaseUrl() {
        return baseUrl;
    }

    /** API key used for authentication via the {@code X-API-Key} header. */
    public String getApiKey() {
        return apiKey;
    }

    /** Interval between background polling requests for the flag ruleset. Default: 30 seconds. */
    public Duration getPollingInterval() {
        return pollingInterval;
    }

    /** Interval between automatic event flushes. Default: 30 seconds. */
    public Duration getEventFlushInterval() {
        return eventFlushInterval;
    }

    /** Maximum number of queued events before an automatic flush is triggered. Default: 100. */
    public int getEventBatchSize() {
        return eventBatchSize;
    }

    /** Create a new {@link Builder}. */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for {@link PhaseFlagConfig}.
     */
    public static final class Builder {

        private String baseUrl;
        private String apiKey;
        private Duration pollingInterval = Duration.ofSeconds(30);
        private Duration eventFlushInterval = Duration.ofSeconds(30);
        private int eventBatchSize = 100;

        private Builder() {
        }

        /** Set the base URL of the Phase Flag API (required). */
        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }

        /** Set the API key for authentication (required). */
        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }

        /** Set the background polling interval. Default: 30 seconds. */
        public Builder pollingInterval(Duration pollingInterval) {
            this.pollingInterval = Objects.requireNonNull(pollingInterval);
            return this;
        }

        /** Set the automatic event flush interval. Default: 30 seconds. */
        public Builder eventFlushInterval(Duration eventFlushInterval) {
            this.eventFlushInterval = Objects.requireNonNull(eventFlushInterval);
            return this;
        }

        /** Set the maximum event batch size before automatic flush. Default: 100. */
        public Builder eventBatchSize(int eventBatchSize) {
            if (eventBatchSize < 1) {
                throw new IllegalArgumentException("eventBatchSize must be >= 1");
            }
            this.eventBatchSize = eventBatchSize;
            return this;
        }

        /** Build an immutable {@link PhaseFlagConfig}. */
        public PhaseFlagConfig build() {
            return new PhaseFlagConfig(this);
        }
    }
}
