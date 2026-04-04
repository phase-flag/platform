using System.Text.Json;
using System.Text.Json.Serialization;

namespace PhaseFlag.Models;

/// <summary>
/// A single variation of a feature flag.
/// </summary>
public sealed class Variation
{
    /// <summary>Unique identifier for this variation.</summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>Machine-readable key for this variation.</summary>
    [JsonPropertyName("key")]
    public string Key { get; set; } = string.Empty;

    /// <summary>Human-readable name for this variation.</summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>The variation value (boolean, string, number, or JSON object).</summary>
    [JsonPropertyName("value")]
    public JsonElement Value { get; set; }

    /// <summary>Optional description of this variation.</summary>
    [JsonPropertyName("description")]
    public string? Description { get; set; }
}
