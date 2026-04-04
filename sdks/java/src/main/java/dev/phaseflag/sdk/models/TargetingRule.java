package dev.phaseflag.sdk.models;

import java.util.Collections;
import java.util.List;

public final class TargetingRule {
    private final int priority;
    private final List<TargetingCondition> conditions;
    private final String variationId;
    private final PercentageRollout percentageRollout;
    private final String segmentId;

    public TargetingRule(int priority, List<TargetingCondition> conditions, String variationId,
                         PercentageRollout percentageRollout, String segmentId) {
        this.priority = priority;
        this.conditions = conditions != null ? Collections.unmodifiableList(conditions) : Collections.emptyList();
        this.variationId = variationId;
        this.percentageRollout = percentageRollout;
        this.segmentId = segmentId;
    }

    public int getPriority() { return priority; }
    public List<TargetingCondition> getConditions() { return conditions; }
    public String getVariationId() { return variationId; }
    public PercentageRollout getPercentageRollout() { return percentageRollout; }
    public String getSegmentId() { return segmentId; }
}
