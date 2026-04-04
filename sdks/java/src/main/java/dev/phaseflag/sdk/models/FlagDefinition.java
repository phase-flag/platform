package dev.phaseflag.sdk.models;

import java.util.Collections;
import java.util.List;

public final class FlagDefinition {
    private final String id;
    private final String key;
    private final String name;
    private final String flagType;
    private final String status;
    private final String environment;
    private final String defaultVariationId;
    private final List<Variation> variations;
    private final List<TargetingRule> targetingRules;
    private final List<String> tags;

    public FlagDefinition(String id, String key, String name, String flagType, String status,
                          String environment, String defaultVariationId,
                          List<Variation> variations, List<TargetingRule> targetingRules,
                          List<String> tags) {
        this.id = id;
        this.key = key;
        this.name = name;
        this.flagType = flagType;
        this.status = status;
        this.environment = environment;
        this.defaultVariationId = defaultVariationId;
        this.variations = variations != null ? Collections.unmodifiableList(variations) : Collections.emptyList();
        this.targetingRules = targetingRules != null ? Collections.unmodifiableList(targetingRules) : Collections.emptyList();
        this.tags = tags != null ? Collections.unmodifiableList(tags) : Collections.emptyList();
    }

    public String getId() { return id; }
    public String getKey() { return key; }
    public String getName() { return name; }
    public String getFlagType() { return flagType; }
    public String getStatus() { return status; }
    public String getEnvironment() { return environment; }
    public String getDefaultVariationId() { return defaultVariationId; }
    public List<Variation> getVariations() { return variations; }
    public List<TargetingRule> getTargetingRules() { return targetingRules; }
    public List<String> getTags() { return tags; }
}
