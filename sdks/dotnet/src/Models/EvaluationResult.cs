using System.Text.Json;
using System.Text.Json.Serialization;

namespace PhaseFlag.Models;

/// <summary>
/// The result of evaluating a feature flag, whether locally or via the remote API.
/// </summary>
public sealed class EvaluationResult
{
    /// <summary>The key of the flag that was evaluated.</summary>
    [JsonPropertyName("flag_key")]
    public string FlagKey { get; set; } = string.Empty;

    /// <summary>The identifier of the resolved variation, if any.</summary>
    [JsonPropertyName("variation_id")]
    public string? VariationId { get; set; }

    /// <summary>The key of the resolved variation, if any.</summary>
    [JsonPropertyName("variation_key")]
    public string? VariationKey { get; set; }

    /// <summary>
    /// The resolved value. This is a <see cref="JsonElement"/> representing the
    /// underlying JSON value (boolean, string, number, or object).
    /// </summary>
    [JsonPropertyName("value")]
    public JsonElement Value { get; set; }

    /// <summary>
    /// The reason the value was resolved: <c>default</c>, <c>targeting_match</c>,
    /// <c>percentage_rollout</c>, or <c>error</c>.
    /// </summary>
    [JsonPropertyName("reason")]
    public string Reason { get; set; } = "default";
}
