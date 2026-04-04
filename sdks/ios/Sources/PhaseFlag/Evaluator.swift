/// Local feature flag evaluation engine.
///
/// `Evaluator` provides deterministic, offline evaluation of flag
/// definitions against an ``EvaluationContext``. It mirrors the
/// server-side evaluation logic so that results are consistent
/// regardless of whether evaluation happens locally or remotely.
import Foundation

public enum Evaluator {

    // MARK: - Public API

    /// Evaluate a flag definition against the provided context.
    ///
    /// Rules are sorted by priority (ascending); the first matching
    /// rule wins. If no rule matches, the default variation is returned.
    ///
    /// - Parameters:
    ///   - flag: The flag definition to evaluate.
    ///   - context: The user/request context.
    /// - Returns: An ``EvaluationResult``, or `nil` if the flag has
    ///   no variations at all.
    public static func evaluate(flag: FlagDefinition, context: EvaluationContext) -> EvaluationResult? {
        // Build a lookup table from variation ID to variation.
        var variationsById: [String: Variation] = [:]
        for variation in flag.variations {
            variationsById[variation.id] = variation
        }

        func makeResult(variationId: String, reason: String) -> EvaluationResult {
            let variation = variationsById[variationId]
            return EvaluationResult(
                flagKey: flag.key,
                variationId: variationId,
                variationKey: variation?.key,
                value: variation?.value ?? AnyCodable.null,
                reason: reason
            )
        }

        // Sort targeting rules by priority (lower number = higher priority).
        let sortedRules = flag.targetingRules.sorted { $0.priority < $1.priority }

        for rule in sortedRules {
            // All conditions must match (AND logic).
            let allMatch = rule.conditions.allSatisfy { matchCondition($0, context: context) }
            guard allMatch else { continue }

            // 1. Explicit variation.
            if let variationId = rule.variationId, !variationId.isEmpty {
                return makeResult(variationId: variationId, reason: "targeting_match")
            }

            // 2. Percentage rollout.
            if let rollout = rule.percentageRollout {
                let userId = context.userId ?? context.sessionId ?? ""
                if let variationId = resolvePercentageRollout(rollout, flagKey: flag.key, userId: userId) {
                    return makeResult(variationId: variationId, reason: "percentage_rollout")
                }
            }
        }

        // No rule matched -- return the default variation.
        return makeResult(variationId: flag.defaultVariationId, reason: "default")
    }

    // MARK: - Condition Matching

    /// Evaluate a single targeting condition against the context.
    ///
    /// Supports 9 operators: `is`, `is_not`, `contains`, `not_contains`,
    /// `one_of`, `not_one_of`, `gt`, `lt`, `matches_regex`.
    public static func matchCondition(_ condition: TargetingCondition, context: EvaluationContext) -> Bool {
        let actual = context.get(condition.attribute)
        let op = condition.operator
        let target = condition.value

        // Missing attribute never matches (except negation operators).
        guard let actual = actual else {
            return op == "is_not" || op == "not_contains" || op == "not_one_of"
        }

        let actualStr = stringRepresentation(actual)
        let targetStr = stringRepresentation(target)

        switch op {
        case "is":
            return actualStr == targetStr

        case "is_not":
            return actualStr != targetStr

        case "contains":
            return actualStr.contains(targetStr)

        case "not_contains":
            return !actualStr.contains(targetStr)

        case "one_of":
            let values = toStringArray(target)
            return values.contains(actualStr)

        case "not_one_of":
            let values = toStringArray(target)
            return !values.contains(actualStr)

        case "gt":
            guard let a = coerceNumeric(actual), let b = coerceNumeric(target) else { return false }
            return a > b

        case "lt":
            guard let a = coerceNumeric(actual), let b = coerceNumeric(target) else { return false }
            return a < b

        case "matches_regex":
            guard let regex = try? NSRegularExpression(pattern: targetStr) else { return false }
            let range = NSRange(actualStr.startIndex..., in: actualStr)
            return regex.firstMatch(in: actualStr, range: range) != nil

        default:
            return false
        }
    }

    // MARK: - DJB2 Hash

    /// Compute the DJB2 hash of a string.
    ///
    /// Uses the classic algorithm: seed 5381, then for each UTF-8 byte
    /// `hash = ((hash << 5) &+ hash) &+ byte`. The `&+` and `&*`
    /// operators provide wrapping arithmetic on `UInt32`.
    public static func djb2Hash(_ input: String) -> UInt32 {
        var hash: UInt32 = 5381
        for byte in input.utf8 {
            hash = ((hash &<< 5) &+ hash) &+ UInt32(byte)
        }
        return hash
    }

    // MARK: - Percentage Rollout

    /// Determine the variation ID for a user via percentage rollout.
    ///
    /// Hashes `"{flagKey}:{userId}"` with DJB2, takes modulo 100, then
    /// walks the rollout entries cumulatively until the bucket is covered.
    ///
    /// - Returns: The matched variation ID, or `nil` if the rollout
    ///   cannot be resolved (e.g. empty `userId`).
    public static func resolvePercentageRollout(
        _ rollout: PercentageRollout,
        flagKey: String,
        userId: String
    ) -> String? {
        guard !userId.isEmpty else { return nil }

        let bucket = djb2Hash("\(flagKey):\(userId)") % 100
        var cumulative: UInt32 = 0
        for entry in rollout.variations {
            cumulative += UInt32(entry.weight)
            if bucket < cumulative {
                return entry.variationId
            }
        }
        return nil
    }

    // MARK: - Private Helpers

    /// Convert an `AnyCodable` to its string representation.
    private static func stringRepresentation(_ value: AnyCodable) -> String {
        if let s = value.stringValue { return s }
        if let b = value.boolValue { return String(b) }
        if let i = value.intValue { return String(i) }
        if let d = value.doubleValue { return String(d) }
        return value.description
    }

    /// Attempt to coerce an `AnyCodable` to a `Double` for numeric comparisons.
    private static func coerceNumeric(_ value: AnyCodable) -> Double? {
        if let d = value.doubleValue { return d }
        if let s = value.stringValue { return Double(s) }
        return nil
    }

    /// Convert an `AnyCodable` to an array of strings for set-membership checks.
    ///
    /// If the value is an array, each element is converted to its string
    /// representation. Otherwise, the single value is wrapped in an array.
    private static func toStringArray(_ value: AnyCodable) -> [String] {
        if let array = value.arrayValue {
            return array.map { stringRepresentation($0) }
        }
        return [stringRepresentation(value)]
    }
}
