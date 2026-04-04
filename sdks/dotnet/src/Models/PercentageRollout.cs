using System.Text.Json.Serialization;

namespace PhaseFlag.Models;

/// <summary>
/// Percentage-based traffic allocation among variations.
/// </summary>
public sealed class PercentageRollout
{
    /// <summary>Ordered list of variation slices that together span 0-100%.</summary>
    [JsonPropertyName("variations")]
    public List<PercentageRolloutEntry> Variations { get; set; } = [];
}
