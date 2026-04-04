/// Data models for the PhaseFlag Swift SDK.
///
/// All structs use `Codable` with `CodingKeys` to map between Swift's
/// `camelCase` naming convention and the API's `snake_case` JSON format.
import Foundation

// MARK: - Configuration

/// Configuration for a ``PhaseFlagClient`` instance.
public struct PhaseFlagConfig {
    /// Base URL of the PhaseFlag API (e.g. `"https://api.example.com/api/v1"`).
    public let baseURL: String

    /// API key for authentication (sent as `X-API-Key` header).
    public let apiKey: String

    /// Interval in seconds between background ruleset polls. Defaults to 30.
    public let pollingInterval: TimeInterval

    /// Interval in seconds between automatic event flushes. Defaults to 30.
    public let eventFlushInterval: TimeInterval

    /// Maximum queued events before an automatic flush is triggered. Defaults to 100.
    public let eventBatchSize: Int

    public init(
        baseURL: String,
        apiKey: String,
        pollingInterval: TimeInterval = 30,
        eventFlushInterval: TimeInterval = 30,
        eventBatchSize: Int = 100
    ) {
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.pollingInterval = pollingInterval
        self.eventFlushInterval = eventFlushInterval
        self.eventBatchSize = eventBatchSize
    }
}

// MARK: - Evaluation Context

/// User/request attributes sent to targeting-rule evaluation.
///
/// `userId` is the primary identifier for percentage rollouts;
/// `sessionId` is a fallback when `userId` is unavailable.
public struct EvaluationContext: Codable {
    public let userId: String?
    public let sessionId: String?
    public let attributes: [String: AnyCodable]

    public init(
        userId: String? = nil,
        sessionId: String? = nil,
        attributes: [String: AnyCodable] = [:]
    ) {
        self.userId = userId
        self.sessionId = sessionId
        self.attributes = attributes
    }

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case sessionId = "session_id"
        case attributes
    }

    /// Look up a value by key. Checks standard fields first, then falls
    /// back to the `attributes` dictionary.
    public func get(_ key: String) -> AnyCodable? {
        switch key {
        case "user_id":
            return userId.map { AnyCodable($0) }
        case "session_id":
            return sessionId.map { AnyCodable($0) }
        default:
            return attributes[key]
        }
    }
}

// MARK: - Variation

/// A single variation of a feature flag.
public struct Variation: Codable, Equatable {
    public let id: String
    public let key: String
    public let name: String
    public let value: AnyCodable
    public let description: String?

    public init(id: String, key: String, name: String, value: AnyCodable, description: String? = nil) {
        self.id = id
        self.key = key
        self.name = name
        self.value = value
        self.description = description
    }
}

// MARK: - Targeting Condition

/// A single condition within a targeting rule.
///
/// Supported operators: `is`, `is_not`, `contains`, `not_contains`,
/// `one_of`, `not_one_of`, `gt`, `lt`, `matches_regex`.
public struct TargetingCondition: Codable, Equatable {
    public let attribute: String
    public let `operator`: String
    public let value: AnyCodable

    public init(attribute: String, operator: String, value: AnyCodable) {
        self.attribute = attribute
        self.`operator` = `operator`
        self.value = value
    }

    enum CodingKeys: String, CodingKey {
        case attribute
        case `operator`
        case value
    }
}

// MARK: - Percentage Rollout

/// One slice of a percentage rollout.
public struct PercentageRolloutEntry: Codable, Equatable {
    public let variationId: String
    public let weight: Int

    public init(variationId: String, weight: Int) {
        self.variationId = variationId
        self.weight = weight
    }

    enum CodingKeys: String, CodingKey {
        case variationId = "variation_id"
        case weight
    }
}

/// Percentage-based traffic allocation among variations.
public struct PercentageRollout: Codable, Equatable {
    public let variations: [PercentageRolloutEntry]

    public init(variations: [PercentageRolloutEntry]) {
        self.variations = variations
    }
}

// MARK: - Targeting Rule

/// A targeting rule with conditions, an optional explicit variation,
/// and an optional percentage rollout.
public struct TargetingRule: Codable, Equatable {
    public let priority: Int
    public let conditions: [TargetingCondition]
    public let variationId: String?
    public let percentageRollout: PercentageRollout?
    public let segmentId: String?

    public init(
        priority: Int,
        conditions: [TargetingCondition],
        variationId: String? = nil,
        percentageRollout: PercentageRollout? = nil,
        segmentId: String? = nil
    ) {
        self.priority = priority
        self.conditions = conditions
        self.variationId = variationId
        self.percentageRollout = percentageRollout
        self.segmentId = segmentId
    }

    enum CodingKeys: String, CodingKey {
        case priority
        case conditions
        case variationId = "variation_id"
        case percentageRollout = "percentage_rollout"
        case segmentId = "segment_id"
    }
}

// MARK: - Flag Definition

/// A complete flag definition as received from the API ruleset endpoint.
public struct FlagDefinition: Codable, Equatable {
    public let id: String
    public let key: String
    public let name: String
    public let flagType: String
    public let status: String
    public let environment: String
    public let defaultVariationId: String
    public let variations: [Variation]
    public let targetingRules: [TargetingRule]
    public let tags: [String]

    public init(
        id: String,
        key: String,
        name: String,
        flagType: String,
        status: String,
        environment: String,
        defaultVariationId: String,
        variations: [Variation],
        targetingRules: [TargetingRule],
        tags: [String]
    ) {
        self.id = id
        self.key = key
        self.name = name
        self.flagType = flagType
        self.status = status
        self.environment = environment
        self.defaultVariationId = defaultVariationId
        self.variations = variations
        self.targetingRules = targetingRules
        self.tags = tags
    }

    enum CodingKeys: String, CodingKey {
        case id, key, name
        case flagType = "flag_type"
        case status, environment
        case defaultVariationId = "default_variation_id"
        case variations
        case targetingRules = "targeting_rules"
        case tags
    }
}

// MARK: - Evaluation Result

/// The result of evaluating a feature flag (locally or remotely).
public struct EvaluationResult: Codable, Equatable {
    public let flagKey: String
    public let variationId: String?
    public let variationKey: String?
    public let value: AnyCodable
    public let reason: String

    public init(
        flagKey: String,
        variationId: String? = nil,
        variationKey: String? = nil,
        value: AnyCodable,
        reason: String
    ) {
        self.flagKey = flagKey
        self.variationId = variationId
        self.variationKey = variationKey
        self.value = value
        self.reason = reason
    }

    enum CodingKeys: String, CodingKey {
        case flagKey = "flag_key"
        case variationId = "variation_id"
        case variationKey = "variation_key"
        case value
        case reason
    }
}

// MARK: - Evaluation Event

/// An evaluation event to be sent for analytics via `POST /sdk/events`.
public struct EvaluationEvent: Codable, Equatable {
    public let flagKey: String
    public let variationKey: String?
    public let userId: String?
    public let timestamp: String?
    public let metadata: [String: AnyCodable]

    public init(
        flagKey: String,
        variationKey: String? = nil,
        userId: String? = nil,
        timestamp: String? = nil,
        metadata: [String: AnyCodable] = [:]
    ) {
        self.flagKey = flagKey
        self.variationKey = variationKey
        self.userId = userId
        self.timestamp = timestamp
        self.metadata = metadata
    }

    enum CodingKeys: String, CodingKey {
        case flagKey = "flag_key"
        case variationKey = "variation_key"
        case userId = "user_id"
        case timestamp
        case metadata
    }
}

// MARK: - Ruleset Response

/// The top-level response from `GET /sdk/ruleset`.
struct RulesetResponse: Codable {
    let flags: [FlagDefinition]
}
