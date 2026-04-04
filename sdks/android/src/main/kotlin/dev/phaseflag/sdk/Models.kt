package dev.phaseflag.sdk

/**
 * Configuration for the PhaseFlagClient.
 */
data class PhaseFlagConfig(
    val baseUrl: String,
    val apiKey: String,
    val pollingIntervalMs: Long = 30_000,
    val eventFlushIntervalMs: Long = 30_000,
    val eventBatchSize: Int = 100,
)

/**
 * User/request attributes for targeting evaluation.
 */
data class EvaluationContext(
    val userId: String? = null,
    val sessionId: String? = null,
    val attributes: Map<String, Any?> = emptyMap(),
) {
    fun get(key: String): Any? = when (key) {
        "user_id" -> userId
        "session_id" -> sessionId
        else -> attributes[key]
    }

    fun toMap(): Map<String, Any?> = mapOf(
        "user_id" to userId,
        "session_id" to sessionId,
        "attributes" to attributes,
    )
}

/**
 * A single variation of a feature flag.
 */
data class Variation(
    val id: String,
    val key: String,
    val name: String,
    val value: Any?,
    val description: String? = null,
)

/**
 * A single condition within a targeting rule.
 */
data class TargetingCondition(
    val attribute: String,
    val operator: String,
    val value: Any?,
)

/**
 * One slice of a percentage rollout.
 */
data class PercentageRolloutEntry(
    val variationId: String,
    val weight: Int,
)

/**
 * Percentage-based traffic allocation among variations.
 */
data class PercentageRollout(
    val variations: List<PercentageRolloutEntry>,
)

/**
 * A targeting rule with conditions, an optional explicit variation,
 * and an optional percentage rollout.
 */
data class TargetingRule(
    val priority: Int,
    val conditions: List<TargetingCondition>,
    val variationId: String? = null,
    val percentageRollout: PercentageRollout? = null,
    val segmentId: String? = null,
)

/**
 * A complete flag definition as received from the API ruleset.
 */
data class FlagDefinition(
    val id: String,
    val key: String,
    val name: String,
    val flagType: String = "boolean",
    val status: String = "active",
    val environment: String = "development",
    val defaultVariationId: String = "",
    val variations: List<Variation> = emptyList(),
    val targetingRules: List<TargetingRule> = emptyList(),
    val tags: List<String> = emptyList(),
) {
    companion object {
        @Suppress("UNCHECKED_CAST")
        fun fromMap(raw: Map<String, Any?>): FlagDefinition {
            val variations = (raw["variations"] as? List<Map<String, Any?>>)?.map { v ->
                Variation(
                    id = v["id"]?.toString() ?: "",
                    key = v["key"]?.toString() ?: "",
                    name = v["name"]?.toString() ?: v["key"]?.toString() ?: "",
                    value = v["value"],
                    description = v["description"]?.toString(),
                )
            } ?: emptyList()

            val targetingRules = (raw["targeting_rules"] as? List<Map<String, Any?>>)?.map { r ->
                val conditions = (r["conditions"] as? List<Map<String, Any?>>)?.map { c ->
                    TargetingCondition(
                        attribute = c["attribute"]?.toString() ?: "",
                        operator = c["operator"]?.toString() ?: "",
                        value = c["value"],
                    )
                } ?: emptyList()

                val rollout = (r["percentage_rollout"] as? Map<String, Any?>)?.let { pr ->
                    val entries = (pr["variations"] as? List<Map<String, Any?>>)?.map { e ->
                        PercentageRolloutEntry(
                            variationId = e["variation_id"]?.toString() ?: "",
                            weight = (e["weight"] as? Number)?.toInt() ?: 0,
                        )
                    } ?: emptyList()
                    PercentageRollout(variations = entries)
                }

                TargetingRule(
                    priority = (r["priority"] as? Number)?.toInt() ?: 0,
                    conditions = conditions,
                    variationId = r["variation_id"]?.toString(),
                    percentageRollout = rollout,
                    segmentId = r["segment_id"]?.toString(),
                )
            } ?: emptyList()

            val tags = (raw["tags"] as? List<Any?>)?.mapNotNull { it?.toString() } ?: emptyList()

            return FlagDefinition(
                id = raw["id"]?.toString() ?: "",
                key = raw["key"]?.toString() ?: "",
                name = raw["name"]?.toString() ?: raw["key"]?.toString() ?: "",
                flagType = raw["flag_type"]?.toString() ?: "boolean",
                status = raw["status"]?.toString() ?: "active",
                environment = raw["environment"]?.toString() ?: "development",
                defaultVariationId = raw["default_variation_id"]?.toString() ?: "",
                variations = variations,
                targetingRules = targetingRules,
                tags = tags,
            )
        }
    }
}

/**
 * The result of evaluating a flag.
 */
data class EvaluationResult(
    val flagKey: String,
    val variationId: String? = null,
    val variationKey: String? = null,
    val value: Any? = null,
    val reason: String = "default",
)

/**
 * An evaluation event for analytics.
 */
data class EvaluationEvent(
    val flagKey: String,
    val variationKey: String? = null,
    val userId: String? = null,
    val timestamp: String? = null,
    val metadata: Map<String, Any?> = emptyMap(),
) {
    fun toMap(): Map<String, Any?> = mapOf(
        "flag_key" to flagKey,
        "variation_key" to variationKey,
        "user_id" to userId,
        "timestamp" to timestamp,
        "metadata" to metadata,
    )
}
