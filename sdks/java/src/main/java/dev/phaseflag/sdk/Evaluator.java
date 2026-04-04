package dev.phaseflag.sdk;

import dev.phaseflag.sdk.models.EvaluationContext;
import dev.phaseflag.sdk.models.EvaluationResult;
import dev.phaseflag.sdk.models.FlagDefinition;
import dev.phaseflag.sdk.models.PercentageRollout;
import dev.phaseflag.sdk.models.TargetingCondition;
import dev.phaseflag.sdk.models.TargetingRule;
import dev.phaseflag.sdk.models.Variation;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * Local evaluation engine for feature flags.
 *
 * <p>Mirrors the server-side evaluation logic so that flags can be resolved
 * without a network round-trip after the ruleset has been fetched.
 *
 * <p>This class is stateless and thread-safe.
 */
public final class Evaluator {

    private Evaluator() {
    }

    /**
     * Evaluate a flag definition against an evaluation context.
     *
     * <p>Rules are evaluated in ascending priority order. The first matching rule
     * determines the result. If no rules match, the default variation is returned.
     *
     * @param flag the flag definition
     * @param ctx  the evaluation context
     * @return the evaluation result (never {@code null})
     */
    public static EvaluationResult evaluate(FlagDefinition flag, EvaluationContext ctx) {
        // Build a lookup of variation ID -> Variation
        Map<String, Variation> variationsById = new HashMap<>();
        for (Variation v : flag.getVariations()) {
            variationsById.put(v.getId(), v);
        }

        // Sort targeting rules by priority (ascending — lower number = higher priority)
        List<TargetingRule> rules = new ArrayList<>(flag.getTargetingRules());
        rules.sort((a, b) -> Integer.compare(a.getPriority(), b.getPriority()));

        for (TargetingRule rule : rules) {
            if (!evaluateConditions(rule.getConditions(), ctx)) {
                continue;
            }

            // 1. Explicit variation
            if (rule.getVariationId() != null && !rule.getVariationId().isEmpty()) {
                return makeResult(flag.getKey(), rule.getVariationId(), variationsById,
                        "targeting_match");
            }

            // 2. Percentage rollout
            if (rule.getPercentageRollout() != null) {
                String vid = resolvePercentageRollout(
                        rule.getPercentageRollout(), flag.getKey(), ctx);
                if (vid != null) {
                    return makeResult(flag.getKey(), vid, variationsById,
                            "percentage_rollout");
                }
            }
        }

        // No rule matched — return default variation
        return makeResult(flag.getKey(), flag.getDefaultVariationId(), variationsById, "default");
    }

    // ── Condition evaluation ────────────────────────────────────────────────

    /**
     * Evaluate all conditions (AND logic). Returns {@code true} only if every
     * condition matches.
     */
    private static boolean evaluateConditions(List<TargetingCondition> conditions,
                                               EvaluationContext ctx) {
        for (TargetingCondition condition : conditions) {
            if (!evaluateCondition(condition, ctx)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Evaluate a single targeting condition against an evaluation context.
     *
     * <p>Supported operators: {@code is}, {@code is_not}, {@code contains},
     * {@code not_contains}, {@code one_of}, {@code not_one_of}, {@code gt},
     * {@code lt}, {@code matches_regex}.
     */
    @SuppressWarnings("unchecked")
    private static boolean evaluateCondition(TargetingCondition condition,
                                              EvaluationContext ctx) {
        Object actual = ctx.get(condition.getAttribute());
        String operator = condition.getOperator();
        Object targetValue = condition.getValue();

        // Missing attribute never matches (except negation operators)
        if (actual == null) {
            return "is_not".equals(operator)
                    || "not_contains".equals(operator)
                    || "not_one_of".equals(operator);
        }

        switch (operator) {
            case "is":
                return String.valueOf(actual).equals(String.valueOf(targetValue));

            case "is_not":
                return !String.valueOf(actual).equals(String.valueOf(targetValue));

            case "contains":
                return String.valueOf(actual).contains(String.valueOf(targetValue));

            case "not_contains":
                return !String.valueOf(actual).contains(String.valueOf(targetValue));

            case "one_of":
                if (targetValue instanceof List) {
                    List<Object> list = (List<Object>) targetValue;
                    String actualStr = String.valueOf(actual);
                    for (Object item : list) {
                        if (actualStr.equals(String.valueOf(item))) {
                            return true;
                        }
                    }
                    return false;
                }
                return String.valueOf(actual).equals(String.valueOf(targetValue));

            case "not_one_of":
                if (targetValue instanceof List) {
                    List<Object> list = (List<Object>) targetValue;
                    String actualStr = String.valueOf(actual);
                    for (Object item : list) {
                        if (actualStr.equals(String.valueOf(item))) {
                            return false;
                        }
                    }
                    return true;
                }
                return !String.valueOf(actual).equals(String.valueOf(targetValue));

            case "gt": {
                Double a = coerceNumeric(actual);
                Double b = coerceNumeric(targetValue);
                return a != null && b != null && a > b;
            }

            case "lt": {
                Double a = coerceNumeric(actual);
                Double b = coerceNumeric(targetValue);
                return a != null && b != null && a < b;
            }

            case "matches_regex":
                try {
                    return Pattern.compile(String.valueOf(targetValue))
                            .matcher(String.valueOf(actual))
                            .find();
                } catch (PatternSyntaxException e) {
                    return false;
                }

            default:
                return false;
        }
    }

    // ── Percentage rollout ──────────────────────────────────────────────────

    /**
     * DJB2 hash function returning an unsigned 32-bit integer.
     *
     * <p>Seed: 5381. Update: {@code hash = ((hash << 5) + hash) + c}.
     */
    static long djb2Hash(String value) {
        long hash = 5381;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            hash = ((hash << 5) + hash + c) & 0xFFFFFFFFL;
        }
        return hash;
    }

    /**
     * Return a value in [0, 100) deterministically for a user/flag pair.
     */
    static int normalizedHash(String flagKey, String userId) {
        long raw = djb2Hash(flagKey + ":" + userId);
        return (int) (raw % 100);
    }

    /**
     * Determine the variation ID via percentage rollout using DJB2 hashing.
     */
    private static String resolvePercentageRollout(PercentageRollout rollout,
                                                    String flagKey,
                                                    EvaluationContext ctx) {
        String userId = ctx.getUserId();
        if (userId == null || userId.isEmpty()) {
            userId = ctx.getSessionId();
        }
        if (userId == null || userId.isEmpty()) {
            return null;
        }

        int bucket = normalizedHash(flagKey, userId);
        int cumulative = 0;
        for (PercentageRollout.Entry entry : rollout.getVariations()) {
            cumulative += entry.getWeight();
            if (bucket < cumulative) {
                return entry.getVariationId();
            }
        }
        return null;
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static EvaluationResult makeResult(String flagKey, String variationId,
                                                Map<String, Variation> variationsById,
                                                String reason) {
        Variation v = variationsById.get(variationId);
        return new EvaluationResult(
                flagKey,
                variationId,
                v != null ? v.getKey() : null,
                v != null ? v.getValue() : null,
                reason
        );
    }

    private static Double coerceNumeric(Object value) {
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
