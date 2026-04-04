package dev.phaseflag.sdk.models;

public final class Variation {
    private final String id;
    private final String key;
    private final String name;
    private final Object value;
    private final String description;

    public Variation(String id, String key, String name, Object value, String description) {
        this.id = id;
        this.key = key;
        this.name = name;
        this.value = value;
        this.description = description;
    }

    public String getId() { return id; }
    public String getKey() { return key; }
    public String getName() { return name; }
    public Object getValue() { return value; }
    public String getDescription() { return description; }
}
