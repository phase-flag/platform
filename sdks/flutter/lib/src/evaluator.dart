import 'models.dart';

/// Local feature flag evaluation engine for Flutter.
///
/// Mirrors the server-side evaluation logic so that flags can be resolved
/// without a network round-trip after the ruleset has been fetched.
class PhaseFlagEvaluator {
  PhaseFlagEvaluator._();

  /// DJB2 string hash returning an unsigned 32-bit integer.
  static int djb2Hash(String input) {
    int hash = 5381;
    for (int i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash + input.codeUnitAt(i)) & 0xFFFFFFFF;
    }
    return hash;
  }

  /// Return a deterministic bucket in [0, 100) for a user/flag pair.
  static int normalizedHash(String flagKey, String userId) {
    return djb2Hash('$flagKey:$userId') % 100;
  }

  /// Evaluate a flag definition against an evaluation context.
  static EvaluationResult evaluate(FlagDefinition flag, EvaluationContext ctx) {
    final variationsById = <String, Variation>{};
    for (final v in flag.variations) {
      variationsById[v.id] = v;
    }

    EvaluationResult makeResult(String variationId, String reason) {
      final v = variationsById[variationId];
      return EvaluationResult(
        flagKey: flag.key,
        variationId: variationId,
        variationKey: v?.key,
        value: v?.value,
        reason: reason,
      );
    }

    final rules = List<TargetingRule>.from(flag.targetingRules)
      ..sort((a, b) => a.priority.compareTo(b.priority));

    for (final rule in rules) {
      if (!rule.conditions.every((c) => _matchCondition(c, ctx))) continue;

      if (rule.variationId != null && rule.variationId!.isNotEmpty) {
        return makeResult(rule.variationId!, 'targeting_match');
      }

      if (rule.percentageRollout != null) {
        final vid = _resolvePercentageRollout(
            rule.percentageRollout!, flag.key, ctx);
        if (vid != null) {
          return makeResult(vid, 'percentage_rollout');
        }
      }
    }

    return makeResult(flag.defaultVariationId, 'default');
  }

  static String? _resolvePercentageRollout(
      PercentageRollout rollout, String flagKey, EvaluationContext ctx) {
    final userId = ctx.userId ?? ctx.sessionId ?? '';
    if (userId.isEmpty) return null;

    final bucket = normalizedHash(flagKey, userId);
    int cumulative = 0;
    for (final entry in rollout.variations) {
      cumulative += entry.weight;
      if (bucket < cumulative) return entry.variationId;
    }
    return null;
  }

  static bool _matchCondition(TargetingCondition cond, EvaluationContext ctx) {
    final actual = ctx.get(cond.attribute);
    final operator = cond.operator;
    final target = cond.value;

    if (actual == null) {
      return ['is_not', 'not_contains', 'not_one_of'].contains(operator);
    }

    final actualStr = actual.toString();
    final targetStr = target?.toString() ?? '';

    switch (operator) {
      case 'is':
        return actualStr == targetStr;
      case 'is_not':
        return actualStr != targetStr;
      case 'contains':
        return actualStr.contains(targetStr);
      case 'not_contains':
        return !actualStr.contains(targetStr);
      case 'one_of':
        final values = target is List
            ? target.map((e) => e.toString()).toList()
            : [targetStr];
        return values.contains(actualStr);
      case 'not_one_of':
        final values = target is List
            ? target.map((e) => e.toString()).toList()
            : [targetStr];
        return !values.contains(actualStr);
      case 'gt':
        final a = double.tryParse(actualStr);
        final b = double.tryParse(targetStr);
        return a != null && b != null && a > b;
      case 'lt':
        final a = double.tryParse(actualStr);
        final b = double.tryParse(targetStr);
        return a != null && b != null && a < b;
      case 'matches_regex':
        try {
          return RegExp(targetStr).hasMatch(actualStr);
        } catch (_) {
          return false;
        }
      default:
        return false;
    }
  }
}
