# frozen_string_literal: true

module PhaseFlag
  # Local evaluation engine that mirrors the server-side evaluation service.
  #
  # Supports 9 targeting operators, DJB2-based percentage rollout, and
  # priority-ordered rule matching.
  module Evaluator
    module_function

    # Evaluate a flag definition against an evaluation context.
    #
    # @param flag    [FlagDefinition]   The flag to evaluate.
    # @param context [EvaluationContext] The user/request context.
    # @return [EvaluationResult]
    def evaluate(flag, context)
      variations_by_id = flag.variations.each_with_object({}) { |v, h| h[v.id] = v }

      make_result = lambda do |variation_id, reason|
        v = variations_by_id[variation_id]
        EvaluationResult.new(
          flag_key:      flag.key,
          variation_id:  variation_id,
          variation_key: v&.key,
          value:         v&.value,
          reason:        reason
        )
      end

      # Sort targeting rules by priority (lower number = higher priority).
      rules = flag.targeting_rules.sort_by(&:priority)

      rules.each do |rule|
        next unless evaluate_conditions(rule.conditions, context)

        # 1. Explicit variation
        if rule.variation_id
          return make_result.call(rule.variation_id, "targeting_match")
        end

        # 2. Percentage rollout
        if rule.percentage_rollout
          vid = resolve_percentage_rollout(rule.percentage_rollout, flag.key, context.user_id || context.session_id || "")
          return make_result.call(vid, "percentage_rollout") if vid
        end
      end

      # No rule matched -- return default variation.
      make_result.call(flag.default_variation_id, "default")
    end

    # ------------------------------------------------------------------
    # Condition matching
    # ------------------------------------------------------------------

    # Evaluate a single targeting condition against an evaluation context.
    #
    # Supported operators: is, is_not, contains, not_contains, one_of,
    # not_one_of, gt, lt, matches_regex.
    #
    # @param condition [TargetingCondition]
    # @param context   [EvaluationContext]
    # @return [Boolean]
    def match_condition(condition, context)
      actual       = context.get(condition.attribute)
      operator     = condition.operator
      target_value = condition.value

      # Missing attribute never matches (except negation operators).
      if actual.nil?
        return %w[is_not not_contains not_one_of].include?(operator)
      end

      case operator
      when "is"
        actual.to_s == target_value.to_s
      when "is_not"
        actual.to_s != target_value.to_s
      when "contains"
        actual.to_s.include?(target_value.to_s)
      when "not_contains"
        !actual.to_s.include?(target_value.to_s)
      when "one_of"
        list = target_value.is_a?(Array) ? target_value.map(&:to_s) : [target_value.to_s]
        list.include?(actual.to_s)
      when "not_one_of"
        list = target_value.is_a?(Array) ? target_value.map(&:to_s) : [target_value.to_s]
        !list.include?(actual.to_s)
      when "gt"
        a = coerce_numeric(actual)
        b = coerce_numeric(target_value)
        !a.nil? && !b.nil? && a > b
      when "lt"
        a = coerce_numeric(actual)
        b = coerce_numeric(target_value)
        !a.nil? && !b.nil? && a < b
      when "matches_regex"
        begin
          Regexp.new(target_value.to_s).match?(actual.to_s)
        rescue RegexpError
          false
        end
      else
        false
      end
    end

    # ------------------------------------------------------------------
    # DJB2 hashing
    # ------------------------------------------------------------------

    # DJB2 string hash returning an unsigned 32-bit integer.
    #
    # Algorithm: seed 5381, +hash = ((hash << 5) + hash) + byte+.
    #
    # @param input [String]
    # @return [Integer] Hash value masked to 32 bits.
    def djb2_hash(input)
      h = 5381
      input.each_byte do |byte|
        h = ((h << 5) + h + byte) & 0xFFFFFFFF
      end
      h
    end

    # ------------------------------------------------------------------
    # Percentage rollout
    # ------------------------------------------------------------------

    # Determine the variation ID via percentage rollout using DJB2.
    #
    # @param rollout  [PercentageRollout]
    # @param flag_key [String]
    # @param user_id  [String]
    # @return [String, nil] The matched variation ID, or nil.
    def resolve_percentage_rollout(rollout, flag_key, user_id)
      return nil if user_id.nil? || user_id.empty?

      bucket     = djb2_hash("#{flag_key}:#{user_id}") % 100
      cumulative = 0

      rollout.variations.each do |entry|
        cumulative += entry.weight
        return entry.variation_id if bucket < cumulative
      end

      nil
    end

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    # Evaluate all conditions in a rule (AND logic).
    def evaluate_conditions(conditions, context)
      conditions.all? { |c| match_condition(c, context) }
    end

    # Attempt to coerce a value to a Float; returns nil on failure.
    def coerce_numeric(value)
      Float(value)
    rescue ArgumentError, TypeError
      nil
    end

    private_class_method :evaluate_conditions, :coerce_numeric
  end
end
