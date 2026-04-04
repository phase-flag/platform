<?php

declare(strict_types=1);

namespace PhaseFlag;

use PhaseFlag\Models\EvaluationContext;
use PhaseFlag\Models\EvaluationResult;
use PhaseFlag\Models\FlagDefinition;
use PhaseFlag\Models\PercentageRollout;
use PhaseFlag\Models\TargetingCondition;
use PhaseFlag\Models\Variation;

/**
 * Local feature flag evaluation engine.
 *
 * Mirrors the server-side evaluation logic so that flags can be resolved
 * entirely in-process without a network round-trip. Supports targeting
 * conditions (9 operators), percentage rollouts using DJB2 hashing, and
 * priority-ordered rule matching.
 */
final class Evaluator
{
    /**
     * Evaluate a flag definition against an evaluation context.
     *
     * Rules are checked in priority order (ascending). The first rule whose
     * conditions all match determines the result. If no rule matches the
     * default variation is returned.
     */
    public static function evaluate(FlagDefinition $flag, ?EvaluationContext $ctx): EvaluationResult
    {
        $ctx ??= new EvaluationContext();

        /** @var array<string, Variation> $variationsById */
        $variationsById = [];
        foreach ($flag->variations as $variation) {
            $variationsById[$variation->id] = $variation;
        }

        $makeResult = static function (string $variationId, string $reason) use ($flag, $variationsById): EvaluationResult {
            $v = $variationsById[$variationId] ?? null;
            return new EvaluationResult(
                flagKey: $flag->key,
                variationId: $variationId,
                variationKey: $v?->key,
                value: $v?->value,
                reason: $reason,
            );
        };

        // Sort targeting rules by priority (lower number = higher priority).
        $rules = $flag->targetingRules;
        usort($rules, static fn ($a, $b) => $a->priority <=> $b->priority);

        foreach ($rules as $rule) {
            // All conditions must match (AND logic).
            $allMatch = true;
            foreach ($rule->conditions as $condition) {
                if (!self::matchCondition($condition, $ctx)) {
                    $allMatch = false;
                    break;
                }
            }

            if (!$allMatch) {
                continue;
            }

            // 1. Explicit variation.
            if ($rule->variationId !== null) {
                return $makeResult($rule->variationId, 'targeting_match');
            }

            // 2. Percentage rollout.
            if ($rule->percentageRollout !== null) {
                $userId = $ctx->userId ?? $ctx->sessionId ?? '';
                $vid = self::resolvePercentageRollout($rule->percentageRollout, $flag->key, $userId);
                if ($vid !== null) {
                    return $makeResult($vid, 'percentage_rollout');
                }
            }
        }

        // No rule matched -- return the default variation.
        return $makeResult($flag->defaultVariationId, 'default');
    }

    /**
     * Evaluate a single targeting condition against an evaluation context.
     *
     * Supported operators:
     *  - is, is_not
     *  - contains, not_contains
     *  - one_of, not_one_of
     *  - gt, lt
     *  - matches_regex
     */
    public static function matchCondition(TargetingCondition $cond, ?EvaluationContext $ctx): bool
    {
        $ctx ??= new EvaluationContext();
        $actual = $ctx->get($cond->attribute);
        $operator = $cond->operator;
        $target = $cond->value;

        // Missing attribute never matches except negation operators.
        if ($actual === null) {
            return in_array($operator, ['is_not', 'not_contains', 'not_one_of'], true);
        }

        return match ($operator) {
            'is'            => (string) $actual === (string) $target,
            'is_not'        => (string) $actual !== (string) $target,
            'contains'      => str_contains((string) $actual, (string) $target),
            'not_contains'  => !str_contains((string) $actual, (string) $target),
            'one_of'        => self::matchOneOf($actual, $target),
            'not_one_of'    => !self::matchOneOf($actual, $target),
            'gt'            => self::compareNumeric($actual, $target, '>'),
            'lt'            => self::compareNumeric($actual, $target, '<'),
            'matches_regex' => self::matchRegex($actual, $target),
            default         => false,
        };
    }

    /**
     * DJB2 string hash returning an unsigned 32-bit integer.
     *
     * Mirrors the server-side implementation used for deterministic
     * percentage rollout bucketing.
     */
    public static function djb2Hash(string $input): int
    {
        $hash = 5381;

        for ($i = 0, $len = strlen($input); $i < $len; $i++) {
            $hash = (($hash << 5) + $hash + ord($input[$i])) & 0xFFFFFFFF;
        }

        return $hash;
    }

    /**
     * Determine the variation ID via percentage rollout using DJB2 hashing.
     *
     * Returns null if the user ID is empty or no bucket matches.
     */
    public static function resolvePercentageRollout(
        PercentageRollout $rollout,
        string $flagKey,
        string $userId,
    ): ?string {
        if ($userId === '') {
            return null;
        }

        $bucket = self::djb2Hash("{$flagKey}:{$userId}") % 100;

        $cumulative = 0;
        foreach ($rollout->variations as $entry) {
            $cumulative += $entry->weight;
            if ($bucket < $cumulative) {
                return $entry->variationId;
            }
        }

        return null;
    }

    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------

    /**
     * Check whether the actual value is contained in the target list.
     */
    private static function matchOneOf(mixed $actual, mixed $target): bool
    {
        if (is_array($target)) {
            return in_array((string) $actual, array_map('strval', $target), true);
        }

        return (string) $actual === (string) $target;
    }

    /**
     * Numeric comparison.  Returns false if either side is not numeric.
     */
    private static function compareNumeric(mixed $actual, mixed $target, string $op): bool
    {
        if (!is_numeric($actual) || !is_numeric($target)) {
            return false;
        }

        $a = (float) $actual;
        $b = (float) $target;

        return match ($op) {
            '>'     => $a > $b,
            '<'     => $a < $b,
            default => false,
        };
    }

    /**
     * Regex match with error suppression for invalid patterns.
     */
    private static function matchRegex(mixed $actual, mixed $target): bool
    {
        $pattern = '/' . str_replace('/', '\\/', (string) $target) . '/';

        // Suppress warnings from malformed patterns.
        $result = @preg_match($pattern, (string) $actual);

        return $result === 1;
    }
}
