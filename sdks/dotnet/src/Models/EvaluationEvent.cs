using System.Text.Json.Serialization;

namespace PhaseFlag.Models;

/// <summary>
/// An evaluation event to be sent for analytics via <c>POST /sdk/events</c>.
/// </summary>
public sealed class EvaluationEvent
{
    /// <summary>The key of the flag this event relates to.</summary>
    [JsonPropertyName("flag_key")]
    public string FlagKey { get; set; } = string.Empty;

    /// <summary>The key of the variation that was served.</summary>
    [JsonPropertyName("variation_key")]
    public string? VariationKey { get; set; }

    /// <summary>The user identifier associated with this evaluation.</summary>
    [JsonPropertyName("user_id")]
    public string? UserId { get; set; }

    /// <summary>ISO 8601 timestamp of when the event occurred.</summary>
    [JsonPropertyName("timestamp")]
    public string? Timestamp { get; set; }

    /// <summary>Arbitrary metadata attached to this event.</summary>
    [JsonPropertyName("metadata")]
    public Dictionary<string, object?> Metadata { get; set; } = [];
}
