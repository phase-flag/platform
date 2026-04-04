package dev.phaseflag.sdk

/**
 * Local feature flag evaluation engine.
 *
 * Mirrors the server-side evaluation logic so that flags can be resolved
 * without a network round-trip after the ruleset has been fetched.
 */
object Evaluator {

    /**
     * Evaluate a flag definition against an evaluation context.
     *
     * Rules are evaluated in ascending priority order. The first matching rule
     * determines the result. If no rules match, the default variation is returned.
     */
    fun evaluate(flag: FlagDefinition, ctx: EvaluationContext): EvaluationResult {
        val variationsById = flag.variations.associateBy { it.id }

        fun makeResult(variationId: String, reason: String): EvaluationResult {
            val v = variationsById[variationId]
            return EvaluationResult(
                flagKey = flag.key,
                variationId = variationId,
                variationKey = v?.key,
                value = v?.value,
                reason = reason
            )
        }

        val rules = flag.targetingRules.sortedBy { it.priority }

        for (rule in rules) {
            if (!rule.conditions.all { matchCondition(it, ctx) }) continue

            rule.variationId?.let { vid ->
                if (vid.isNotEmpty()) return makeResult(vid, "targeting_match")
            }

            rule.percentageRollout?.let { rollout ->
                val userId = ctx.userId ?: ctx.sessionId ?: ""
                resolvePercentageRollout(rollout, flag.key, userId)?.let { vid ->
                    return makeResult(vid, "percentage_rollout")
                }
            }
        }

        return makeResult(flag.defaultVariationId, "default")
    }

    // -- DJB2 hashing --

    fun djb2Hash(input: String): Long {
        var hash = 5381L
        for (c in input) {
            hash = ((hash shl 5) + hash + c.code) and 0xFFFFFFFFL
        }
        return hash
    }

    fun normalizedHash(flagKey: String, userId: String): Int {
        return (djb2Hash("$flagKey:$userId") % 100).toInt()
    }

    // -- Percentage rollout --

    private fun resolvePercentageRollout(
        rollout: PercentageRollout,
        flagKey: String,
        userId: String
    ): String? {
        if (userId.isEmpty()) return null

        val bucket = normalizedHash(flagKey, userId)
        var cumulative = 0
        for (entry in rollout.variations) {
            cumulative += entry.weight
            if (bucket < cumulative) return entry.variationId
        }
        return null
    }

    // -- Condition matching --

    @Suppress("UNCHECKED_CAST")
    private fun matchCondition(condition: TargetingCondition, ctx: EvaluationContext): Boolean {
        val actual = ctx.get(condition.attribute)
        val operator = condition.operator
        val target = condition.value

        if (actual == null) {
            return operator in listOf("is_not", "not_contains", "not_one_of")
        }

        val actualStr = actual.toString()
        val targetStr = target?.toString() ?: ""

        return when (operator) {
            "is" -> actualStr == targetStr
            "is_not" -> actualStr != targetStr
            "contains" -> actualStr.contains(targetStr)
            "not_contains" -> !actualStr.contains(targetStr)
            "one_of" -> {
                val values = if (target is List<*>) target.map { it.toString() } else listOf(targetStr)
                actualStr in values
            }
            "not_one_of" -> {
                val values = if (target is List<*>) target.map { it.toString() } else listOf(targetStr)
                actualStr !in values
            }
            "gt" -> {
                val a = actual.toString().toDoubleOrNull()
                val b = target?.toString()?.toDoubleOrNull()
                a != null && b != null && a > b
            }
            "lt" -> {
                val a = actual.toString().toDoubleOrNull()
                val b = target?.toString()?.toDoubleOrNull()
                a != null && b != null && a < b
            }
            "matches_regex" -> {
                try {
                    Regex(targetStr).containsMatchIn(actualStr)
                } catch (_: Exception) {
                    false
                }
            }
            else -> false
        }
    }
}
