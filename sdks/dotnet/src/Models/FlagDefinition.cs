using System.Text.Json.Serialization;

namespace PhaseFlag.Models;

/// <summary>
/// A complete flag definition as received from the API ruleset endpoint.
/// </summary>
public sealed class FlagDefinition
{
    /// <summary>Unique identifier for this flag.</summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>Machine-readable key used to evaluate this flag.</summary>
    [JsonPropertyName("key")]
    public string Key { get; set; } = string.Empty;

    /// <summary>Human-readable name for this flag.</summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The type of flag: <c>boolean</c>, <c>string</c>, <c>number</c>, or <c>json</c>.
    /// </summary>
    [JsonPropertyName("flag_type")]
    public string FlagType { get; set; } = "boolean";

    /// <summary>
    /// Flag lifecycle status: <c>active</c>, <c>inactive</c>, or <c>archived</c>.
    /// </summary>
    [JsonPropertyName("status")]
    public string Status { get; set; } = "active";

    /// <summary>The environment this flag belongs to (e.g. "production", "development").</summary>
    [JsonPropertyName("environment")]
    public string Environment { get; set; } = string.Empty;

    /// <summary>
    /// The variation ID to serve when no targeting rules match.
    /// </summary>
    [JsonPropertyName("default_variation_id")]
    public string DefaultVariationId { get; set; } = string.Empty;

    /// <summary>All possible variations for this flag.</summary>
    [JsonPropertyName("variations")]
    public List<Variation> Variations { get; set; } = [];

    /// <summary>Ordered targeting rules evaluated top-down by priority.</summary>
    [JsonPropertyName("targeting_rules")]
    public List<TargetingRule> TargetingRules { get; set; } = [];

    /// <summary>Tags associated with this flag for filtering and organization.</summary>
    [JsonPropertyName("tags")]
    public List<string> Tags { get; set; } = [];
}
