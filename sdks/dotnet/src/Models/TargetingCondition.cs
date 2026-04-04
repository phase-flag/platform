using System.Text.Json;
using System.Text.Json.Serialization;

namespace PhaseFlag.Models;

/// <summary>
/// A single condition within a targeting rule.
/// <para>
/// Supported operators: <c>is</c>, <c>is_not</c>, <c>contains</c>,
/// <c>not_contains</c>, <c>one_of</c>, <c>not_one_of</c>, <c>gt</c>,
/// <c>lt</c>, <c>matches_regex</c>.
/// </para>
/// </summary>
public sealed class TargetingCondition
{
    /// <summary>The context attribute to evaluate (e.g. "user_id", "country").</summary>
    [JsonPropertyName("attribute")]
    public string Attribute { get; set; } = string.Empty;

    /// <summary>The comparison operator.</summary>
    [JsonPropertyName("operator")]
    public string Operator { get; set; } = string.Empty;

    /// <summary>The target value to compare against.</summary>
    [JsonPropertyName("value")]
    public JsonElement Value { get; set; }
}
