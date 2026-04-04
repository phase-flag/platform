package dev.phaseflag.sdk.models;

import java.util.Collections;
import java.util.List;

public final class PercentageRollout {
    private final List<Entry> variations;

    public PercentageRollout(List<Entry> variations) {
        this.variations = variations != null ? Collections.unmodifiableList(variations) : Collections.emptyList();
    }

    public List<Entry> getVariations() { return variations; }

    public static final class Entry {
        private final String variationId;
        private final int weight;

        public Entry(String variationId, int weight) {
            this.variationId = variationId;
            this.weight = weight;
        }

        public String getVariationId() { return variationId; }
        public int getWeight() { return weight; }
    }
}
