using System.Text.Json.Serialization;

namespace PhaseFlag.Models;

/// <summary>
/// One slice of a percentage rollout, mapping a variation to a weight.
/// </summary>
public sealed class PercentageRolloutEntry
{
    /// <summary>The variation identifier for this rollout slice.</summary>
    [JsonPropertyName("variation_id")]
    public string VariationId { get; set; } = string.Empty;

    /// <summary>
    /// The weight of this slice as an integer percentage point (0-100).
    /// The sum of all weights in a rollout should equal 100.
    /// </summary>
    [JsonPropertyName("weight")]
    public int Weight { get; set; }
}
