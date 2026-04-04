# frozen_string_literal: true

module PhaseFlag
  # User/request attributes sent to targeting-rule evaluation.
  #
  # @attr_accessor user_id    [String, nil] Stable user identifier used for percentage rollouts.
  # @attr_accessor session_id [String, nil] Fallback identifier when +user_id+ is unavailable.
  # @attr_accessor attributes [Hash]        Arbitrary key-value pairs checked by targeting conditions.
  class EvaluationContext
    attr_accessor :user_id, :session_id, :attributes

    def initialize(user_id: nil, session_id: nil, attributes: {})
      @user_id    = user_id
      @session_id = session_id
      @attributes = attributes
    end

    # Look up a value by +key+ -- checks standard fields first, then
    # falls back to +attributes+.
    def get(key)
      case key
      when "user_id"    then @user_id
      when "session_id" then @session_id
      else @attributes[key]
      end
    end

    def to_h
      {
        "user_id"    => @user_id,
        "session_id" => @session_id,
        "attributes" => @attributes
      }
    end
  end

  # A single variation of a feature flag.
  Variation = Struct.new(:id, :key, :name, :value, :description, keyword_init: true)

  # A single condition within a targeting rule.
  TargetingCondition = Struct.new(:attribute, :operator, :value, keyword_init: true)

  # One slice of a percentage rollout.
  PercentageRolloutEntry = Struct.new(:variation_id, :weight, keyword_init: true)

  # Percentage-based traffic allocation among variations.
  PercentageRollout = Struct.new(:variations, keyword_init: true) do
    def initialize(variations: [])
      super(variations: variations)
    end
  end

  # A targeting rule with conditions, an optional explicit variation,
  # and an optional percentage rollout.
  TargetingRule = Struct.new(
    :priority, :conditions, :variation_id, :percentage_rollout, :segment_id,
    keyword_init: true
  ) do
    def initialize(priority: 0, conditions: [], variation_id: nil, percentage_rollout: nil, segment_id: nil)
      super(
        priority:            priority,
        conditions:          conditions,
        variation_id:        variation_id,
        percentage_rollout:  percentage_rollout,
        segment_id:          segment_id
      )
    end
  end

  # A complete flag definition as received from the API ruleset.
  FlagDefinition = Struct.new(
    :id, :key, :name, :flag_type, :status, :environment,
    :default_variation_id, :variations, :targeting_rules, :tags,
    keyword_init: true
  ) do
    def initialize(
      id:, key:, name:, flag_type: "boolean", status: "active",
      environment: "development", default_variation_id: "",
      variations: [], targeting_rules: [], tags: []
    )
      super(
        id:                   id,
        key:                  key,
        name:                 name,
        flag_type:            flag_type,
        status:               status,
        environment:          environment,
        default_variation_id: default_variation_id,
        variations:           variations,
        targeting_rules:      targeting_rules,
        tags:                 tags
      )
    end
  end

  # The result of evaluating a flag.
  EvaluationResult = Struct.new(
    :flag_key, :variation_id, :variation_key, :value, :reason,
    keyword_init: true
  ) do
    def initialize(flag_key:, variation_id: nil, variation_key: nil, value: nil, reason: "default")
      super(
        flag_key:      flag_key,
        variation_id:  variation_id,
        variation_key: variation_key,
        value:         value,
        reason:        reason
      )
    end
  end

  # An evaluation event to be sent for analytics.
  EvaluationEvent = Struct.new(
    :flag_key, :variation_key, :user_id, :timestamp, :metadata,
    keyword_init: true
  ) do
    def initialize(flag_key:, variation_key: nil, user_id: nil, timestamp: nil, metadata: {})
      super(
        flag_key:      flag_key,
        variation_key: variation_key,
        user_id:       user_id,
        timestamp:     timestamp,
        metadata:      metadata
      )
    end

    def to_h
      {
        "flag_key"      => flag_key,
        "variation_key" => variation_key,
        "user_id"       => user_id,
        "timestamp"     => timestamp,
        "metadata"      => metadata
      }
    end
  end
end
