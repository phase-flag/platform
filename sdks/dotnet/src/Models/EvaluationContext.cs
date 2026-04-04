using System.Text.Json.Serialization;

namespace PhaseFlag.Models;

/// <summary>
/// User/request attributes sent to targeting-rule evaluation.
/// <para>
/// <see cref="UserId"/> is the primary identifier for percentage rollouts;
/// <see cref="SessionId"/> is a fallback when <see cref="UserId"/> is unavailable.
/// </para>
/// </summary>
public sealed class EvaluationContext
{
    /// <summary>Stable user identifier used for percentage rollouts.</summary>
    [JsonPropertyName("user_id")]
    public string? UserId { get; set; }

    /// <summary>Fallback identifier when <see cref="UserId"/> is unavailable.</summary>
    [JsonPropertyName("session_id")]
    public string? SessionId { get; set; }

    /// <summary>Arbitrary key-value pairs checked by targeting conditions.</summary>
    [JsonPropertyName("attributes")]
    public Dictionary<string, object?> Attributes { get; set; } = [];

    /// <summary>
    /// Look up a value by <paramref name="key"/>. Checks well-known fields
    /// (<c>user_id</c>, <c>session_id</c>) first, then falls back to
    /// <see cref="Attributes"/>.
    /// </summary>
    public object? Get(string key)
    {
        return key switch
        {
            "user_id" => UserId,
            "session_id" => SessionId,
            _ => Attributes.TryGetValue(key, out var value) ? value : null,
        };
    }
}
