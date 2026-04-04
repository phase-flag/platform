using System.Text.Json;
using System.Text.RegularExpressions;
using PhaseFlag.Models;

namespace PhaseFlag;

/// <summary>
/// Local feature flag evaluation engine.
/// <para>
/// Evaluates a <see cref="FlagDefinition"/> against an <see cref="EvaluationContext"/>
/// using targeting rules, condition matching, and deterministic percentage rollouts
/// (DJB2 hashing). Rules are evaluated in ascending priority order; the first match wins.
/// </para>
/// </summary>
public static class Evaluator
{
    // -----------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------

    /// <summary>
    /// Evaluate a flag definition locally against the given context.
    /// </summary>
    /// <param name="flag">The flag definition to evaluate.</param>
    /// <param name="ctx">
    /// Optional evaluation context. When <c>null</c>, an empty context is used.
    /// </param>
    /// <returns>
    /// An <see cref="EvaluationResult"/> with the resolved variation, or <c>null</c>
    /// if the flag has no variations at all.
    /// </returns>
    public static EvaluationResult? Evaluate(FlagDefinition flag, EvaluationContext? ctx)
    {
        ctx ??= new EvaluationContext();

        var variationsById = new Dictionary<string, Variation>(flag.Variations.Count);
        foreach (var v in flag.Variations)
        {
            variationsById[v.Id] = v;
        }

        EvaluationResult MakeResult(string variationId, string reason)
        {
            variationsById.TryGetValue(variationId, out var variation);
            return new EvaluationResult
            {
                FlagKey = flag.Key,
                VariationId = variationId,
                VariationKey = variation?.Key,
                Value = variation?.Value ?? default,
                Reason = reason,
            };
        }

        // Sort targeting rules by priority (ascending -- lower number = higher priority)
        var rules = flag.TargetingRules
            .OrderBy(r => r.Priority)
            .ToList();

        foreach (var rule in rules)
        {
            if (!MatchAllConditions(rule.Conditions, ctx))
                continue;

            // 1. Explicit variation
            if (!string.IsNullOrEmpty(rule.VariationId))
            {
                return MakeResult(rule.VariationId, "targeting_match");
            }

            // 2. Percentage rollout
            if (rule.PercentageRollout is not null)
            {
                var userId = ctx.UserId ?? ctx.SessionId ?? string.Empty;
                var resolvedId = ResolvePercentageRollout(rule.PercentageRollout, flag.Key, userId);
                if (resolvedId is not null)
                {
                    return MakeResult(resolvedId, "percentage_rollout");
                }
            }
        }

        // No rule matched -- return default variation
        return MakeResult(flag.DefaultVariationId, "default");
    }

    // -----------------------------------------------------------------
    // Condition matching
    // -----------------------------------------------------------------

    /// <summary>
    /// Evaluate a single targeting condition against an evaluation context.
    /// </summary>
    /// <param name="cond">The condition to evaluate.</param>
    /// <param name="ctx">
    /// Optional evaluation context. When <c>null</c>, only negation operators match.
    /// </param>
    /// <returns><c>true</c> if the condition is satisfied.</returns>
    public static bool MatchCondition(TargetingCondition cond, EvaluationContext? ctx)
    {
        var actual = ctx?.Get(cond.Attribute);
        var op = cond.Operator;
        var target = cond.Value;

        // Missing attribute never matches (except negation operators)
        if (actual is null)
        {
            return op is "is_not" or "not_contains" or "not_one_of";
        }

        var actualStr = ConvertToString(actual);

        return op switch
        {
            "is" => actualStr == JsonElementToString(target),
            "is_not" => actualStr != JsonElementToString(target),
            "contains" => actualStr.Contains(JsonElementToString(target), StringComparison.Ordinal),
            "not_contains" => !actualStr.Contains(JsonElementToString(target), StringComparison.Ordinal),
            "one_of" => MatchOneOf(actualStr, target),
            "not_one_of" => !MatchOneOf(actualStr, target),
            "gt" => CompareNumeric(actualStr, target, gt: true),
            "lt" => CompareNumeric(actualStr, target, gt: false),
            "matches_regex" => MatchRegex(actualStr, target),
            _ => false,
        };
    }

    // -----------------------------------------------------------------
    // DJB2 hashing
    // -----------------------------------------------------------------

    /// <summary>
    /// Compute a DJB2 hash of the input string, returning an unsigned 32-bit integer.
    /// <para>
    /// The algorithm seeds at 5381 and for each character computes
    /// <c>hash = ((hash &lt;&lt; 5) + hash) + char</c>.
    /// </para>
    /// </summary>
    /// <param name="input">The string to hash.</param>
    /// <returns>An unsigned 32-bit hash value.</returns>
    public static uint Djb2Hash(string input)
    {
        uint hash = 5381;
        foreach (var ch in input)
        {
            hash = unchecked(((hash << 5) + hash) + (uint)ch);
        }
        return hash;
    }

    /// <summary>
    /// Determine the variation ID via percentage rollout using DJB2 hashing.
    /// </summary>
    /// <param name="rollout">The percentage rollout configuration.</param>
    /// <param name="flagKey">The flag key, combined with <paramref name="userId"/> for hashing.</param>
    /// <param name="userId">The user identifier for deterministic bucketing.</param>
    /// <returns>
    /// The resolved variation ID, or <c>null</c> if no user ID is available
    /// or the bucket falls outside all slices.
    /// </returns>
    public static string? ResolvePercentageRollout(PercentageRollout rollout, string flagKey, string userId)
    {
        if (string.IsNullOrEmpty(userId))
            return null;

        var bucket = Djb2Hash($"{flagKey}:{userId}") % 100;
        uint cumulative = 0;

        foreach (var entry in rollout.Variations)
        {
            cumulative += (uint)entry.Weight;
            if (bucket < cumulative)
            {
                return entry.VariationId;
            }
        }

        return null;
    }

    // -----------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------

    private static bool MatchAllConditions(List<TargetingCondition> conditions, EvaluationContext ctx)
    {
        // All conditions must match (AND logic)
        foreach (var condition in conditions)
        {
            if (!MatchCondition(condition, ctx))
                return false;
        }
        return true;
    }

    /// <summary>
    /// Convert an arbitrary object to its string representation.
    /// </summary>
    private static string ConvertToString(object? value)
    {
        return value?.ToString() ?? string.Empty;
    }

    /// <summary>
    /// Convert a <see cref="JsonElement"/> to a plain string for comparison.
    /// </summary>
    private static string JsonElementToString(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString() ?? string.Empty,
            JsonValueKind.Number => element.GetRawText(),
            JsonValueKind.True => "True",
            JsonValueKind.False => "False",
            JsonValueKind.Null => string.Empty,
            _ => element.GetRawText(),
        };
    }

    /// <summary>
    /// Check whether <paramref name="actual"/> is contained in the target list.
    /// The target may be a JSON array or a single value.
    /// </summary>
    private static bool MatchOneOf(string actual, JsonElement target)
    {
        if (target.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in target.EnumerateArray())
            {
                if (actual == JsonElementToString(item))
                    return true;
            }
            return false;
        }

        // Single value fallback
        return actual == JsonElementToString(target);
    }

    /// <summary>
    /// Numeric comparison. When <paramref name="gt"/> is true, checks actual &gt; target;
    /// otherwise checks actual &lt; target.
    /// </summary>
    private static bool CompareNumeric(string actual, JsonElement target, bool gt)
    {
        if (!double.TryParse(actual, System.Globalization.NumberStyles.Float,
                System.Globalization.CultureInfo.InvariantCulture, out var a))
            return false;

        double b;
        if (target.ValueKind == JsonValueKind.Number)
        {
            b = target.GetDouble();
        }
        else
        {
            var targetStr = JsonElementToString(target);
            if (!double.TryParse(targetStr, System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out b))
                return false;
        }

        return gt ? a > b : a < b;
    }

    /// <summary>
    /// Check whether <paramref name="actual"/> matches the regex pattern in <paramref name="target"/>.
    /// </summary>
    private static bool MatchRegex(string actual, JsonElement target)
    {
        try
        {
            var pattern = JsonElementToString(target);
            return Regex.IsMatch(actual, pattern);
        }
        catch (RegexParseException)
        {
            return false;
        }
    }
}
