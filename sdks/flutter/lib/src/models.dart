/// Configuration for the PhaseFlagClient.
class PhaseFlagConfig {
  final String baseUrl;
  final String apiKey;
  final Duration pollingInterval;
  final Duration eventFlushInterval;
  final int eventBatchSize;

  PhaseFlagConfig({
    required this.baseUrl,
    required this.apiKey,
    this.pollingInterval = const Duration(seconds: 30),
    this.eventFlushInterval = const Duration(seconds: 30),
    this.eventBatchSize = 100,
  });
}

/// User/request attributes for targeting evaluation.
class EvaluationContext {
  final String? userId;
  final String? sessionId;
  final Map<String, dynamic> attributes;

  EvaluationContext({
    this.userId,
    this.sessionId,
    this.attributes = const {},
  });

  dynamic get(String key) {
    if (key == 'user_id') return userId;
    if (key == 'session_id') return sessionId;
    return attributes[key];
  }

  Map<String, dynamic> toMap() => {
        'user_id': userId,
        'session_id': sessionId,
        'attributes': attributes,
      };
}

/// A single variation of a feature flag.
class Variation {
  final String id;
  final String key;
  final String name;
  final dynamic value;
  final String? description;

  Variation({
    required this.id,
    required this.key,
    required this.name,
    this.value,
    this.description,
  });

  factory Variation.fromMap(Map<String, dynamic> map) => Variation(
        id: map['id']?.toString() ?? '',
        key: map['key']?.toString() ?? '',
        name: map['name']?.toString() ?? map['key']?.toString() ?? '',
        value: map['value'],
        description: map['description']?.toString(),
      );
}

/// A single condition within a targeting rule.
class TargetingCondition {
  final String attribute;
  final String operator;
  final dynamic value;

  TargetingCondition({
    required this.attribute,
    required this.operator,
    this.value,
  });

  factory TargetingCondition.fromMap(Map<String, dynamic> map) =>
      TargetingCondition(
        attribute: map['attribute']?.toString() ?? '',
        operator: map['operator']?.toString() ?? '',
        value: map['value'],
      );
}

/// One slice of a percentage rollout.
class PercentageRolloutEntry {
  final String variationId;
  final int weight;

  PercentageRolloutEntry({required this.variationId, required this.weight});

  factory PercentageRolloutEntry.fromMap(Map<String, dynamic> map) =>
      PercentageRolloutEntry(
        variationId: map['variation_id']?.toString() ?? '',
        weight: (map['weight'] as num?)?.toInt() ?? 0,
      );
}

/// Percentage-based traffic allocation among variations.
class PercentageRollout {
  final List<PercentageRolloutEntry> variations;

  PercentageRollout({required this.variations});

  factory PercentageRollout.fromMap(Map<String, dynamic> map) {
    final entries = (map['variations'] as List?)
            ?.map((e) =>
                PercentageRolloutEntry.fromMap(Map<String, dynamic>.from(e)))
            .toList() ??
        [];
    return PercentageRollout(variations: entries);
  }
}

/// A targeting rule with conditions.
class TargetingRule {
  final int priority;
  final List<TargetingCondition> conditions;
  final String? variationId;
  final PercentageRollout? percentageRollout;
  final String? segmentId;

  TargetingRule({
    required this.priority,
    required this.conditions,
    this.variationId,
    this.percentageRollout,
    this.segmentId,
  });

  factory TargetingRule.fromMap(Map<String, dynamic> map) {
    final conditions = (map['conditions'] as List?)
            ?.map(
                (c) => TargetingCondition.fromMap(Map<String, dynamic>.from(c)))
            .toList() ??
        [];

    PercentageRollout? rollout;
    if (map['percentage_rollout'] != null) {
      rollout = PercentageRollout.fromMap(
          Map<String, dynamic>.from(map['percentage_rollout']));
    }

    return TargetingRule(
      priority: (map['priority'] as num?)?.toInt() ?? 0,
      conditions: conditions,
      variationId: map['variation_id']?.toString(),
      percentageRollout: rollout,
      segmentId: map['segment_id']?.toString(),
    );
  }
}

/// A complete flag definition.
class FlagDefinition {
  final String id;
  final String key;
  final String name;
  final String flagType;
  final String status;
  final String environment;
  final String defaultVariationId;
  final List<Variation> variations;
  final List<TargetingRule> targetingRules;
  final List<String> tags;

  FlagDefinition({
    required this.id,
    required this.key,
    required this.name,
    this.flagType = 'boolean',
    this.status = 'active',
    this.environment = 'development',
    this.defaultVariationId = '',
    this.variations = const [],
    this.targetingRules = const [],
    this.tags = const [],
  });

  factory FlagDefinition.fromMap(Map<String, dynamic> map) => FlagDefinition(
        id: map['id']?.toString() ?? '',
        key: map['key']?.toString() ?? '',
        name: map['name']?.toString() ?? map['key']?.toString() ?? '',
        flagType: map['flag_type']?.toString() ?? 'boolean',
        status: map['status']?.toString() ?? 'active',
        environment: map['environment']?.toString() ?? 'development',
        defaultVariationId: map['default_variation_id']?.toString() ?? '',
        variations: (map['variations'] as List?)
                ?.map((v) => Variation.fromMap(Map<String, dynamic>.from(v)))
                .toList() ??
            [],
        targetingRules: (map['targeting_rules'] as List?)
                ?.map(
                    (r) => TargetingRule.fromMap(Map<String, dynamic>.from(r)))
                .toList() ??
            [],
        tags: (map['tags'] as List?)?.map((t) => t.toString()).toList() ?? [],
      );
}

/// The result of evaluating a flag.
class EvaluationResult {
  final String flagKey;
  final String? variationId;
  final String? variationKey;
  final dynamic value;
  final String reason;

  EvaluationResult({
    required this.flagKey,
    this.variationId,
    this.variationKey,
    this.value,
    this.reason = 'default',
  });
}

/// An evaluation event for analytics.
class EvaluationEvent {
  final String flagKey;
  final String? variationKey;
  final String? userId;
  final String? timestamp;
  final Map<String, dynamic> metadata;

  EvaluationEvent({
    required this.flagKey,
    this.variationKey,
    this.userId,
    this.timestamp,
    this.metadata = const {},
  });

  Map<String, dynamic> toMap() => {
        'flag_key': flagKey,
        'variation_key': variationKey,
        'user_id': userId,
        'timestamp': timestamp ?? DateTime.now().toUtc().toIso8601String(),
        'metadata': metadata,
      };
}
