using System.Text.Json.Serialization;

namespace PhaseFlag.Models;

/// <summary>
/// A targeting rule with conditions, an optional explicit variation,
/// and an optional percentage rollout.
/// </summary>
public sealed class TargetingRule
{
    /// <summary>
    /// Rule priority. Lower numbers are evaluated first.
    /// </summary>
    [JsonPropertyName("priority")]
    public int Priority { get; set; }

    /// <summary>
    /// All conditions must match (AND logic) for the rule to apply.
    /// </summary>
    [JsonPropertyName("conditions")]
    public List<TargetingCondition> Conditions { get; set; } = [];

    /// <summary>
    /// Explicit variation to serve when the rule matches. Mutually exclusive
    /// with <see cref="PercentageRollout"/>.
    /// </summary>
    [JsonPropertyName("variation_id")]
    public string? VariationId { get; set; }

    /// <summary>
    /// Percentage rollout configuration when no explicit variation is set.
    /// </summary>
    [JsonPropertyName("percentage_rollout")]
    public PercentageRollout? PercentageRollout { get; set; }

    /// <summary>
    /// Optional segment identifier for segment-based targeting.
    /// </summary>
    [JsonPropertyName("segment_id")]
    public string? SegmentId { get; set; }
}
