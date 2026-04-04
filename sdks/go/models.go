// Package phaseflag provides a Go SDK for the Phase Flag feature flag platform.
//
// It supports local flag evaluation with background polling, server-side
// evaluation fallback, event batching, bootstrap loading, offline mode,
// flag mocking, and change listeners -- all backed by the standard library
// with no external dependencies.
package phaseflag

// ---------------------------------------------------------------------------
// Evaluation context
// ---------------------------------------------------------------------------

// EvaluationContext carries user/request attributes used during targeting
// rule evaluation. UserID is the primary identifier for percentage rollouts;
// SessionID is a fallback when UserID is unavailable.
type EvaluationContext struct {
	UserID     string                 `json:"user_id,omitempty"`
	SessionID  string                 `json:"session_id,omitempty"`
	Attributes map[string]interface{} `json:"attributes,omitempty"`
}

// Get looks up a value by key. It checks the well-known fields (user_id,
// session_id) first, then falls back to the Attributes map. Returns nil
// when the key is not found.
func (c *EvaluationContext) Get(key string) interface{} {
	if c == nil {
		return nil
	}
	switch key {
	case "user_id":
		if c.UserID != "" {
			return c.UserID
		}
		return nil
	case "session_id":
		if c.SessionID != "" {
			return c.SessionID
		}
		return nil
	default:
		if c.Attributes != nil {
			return c.Attributes[key]
		}
		return nil
	}
}

// ---------------------------------------------------------------------------
// Flag & variation structures (as returned by GET /sdk/ruleset)
// ---------------------------------------------------------------------------

// Variation represents a single variation of a feature flag.
type Variation struct {
	ID          string      `json:"id"`
	Key         string      `json:"key"`
	Name        string      `json:"name"`
	Value       interface{} `json:"value"`
	Description string      `json:"description,omitempty"`
}

// TargetingCondition is a single condition within a targeting rule.
// Supported operators: is, is_not, contains, not_contains, one_of,
// not_one_of, gt, lt, matches_regex.
type TargetingCondition struct {
	Attribute string      `json:"attribute"`
	Operator  string      `json:"operator"`
	Value     interface{} `json:"value"`
}

// PercentageRolloutEntry represents one slice of a percentage rollout.
type PercentageRolloutEntry struct {
	VariationID string `json:"variation_id"`
	Weight      int    `json:"weight"`
}

// PercentageRollout defines percentage-based traffic allocation among
// variations.
type PercentageRollout struct {
	Variations []PercentageRolloutEntry `json:"variations"`
}

// TargetingRule is a single targeting rule with conditions, an optional
// explicit variation, and an optional percentage rollout.
type TargetingRule struct {
	Priority          int                `json:"priority"`
	Conditions        []TargetingCondition `json:"conditions"`
	VariationID       string             `json:"variation_id,omitempty"`
	PercentageRollout *PercentageRollout `json:"percentage_rollout,omitempty"`
	SegmentID         string             `json:"segment_id,omitempty"`
}

// FlagDefinition is a complete flag definition as received from the API
// ruleset endpoint.
type FlagDefinition struct {
	ID                 string          `json:"id"`
	Key                string          `json:"key"`
	Name               string          `json:"name"`
	FlagType           string          `json:"flag_type"`
	Status             string          `json:"status"`
	Environment        string          `json:"environment"`
	DefaultVariationID string          `json:"default_variation_id"`
	Variations         []Variation     `json:"variations"`
	TargetingRules     []TargetingRule `json:"targeting_rules"`
	Tags               []string        `json:"tags"`
}

// ---------------------------------------------------------------------------
// Evaluation result (returned by POST /evaluate and local evaluation)
// ---------------------------------------------------------------------------

// EvaluationResult is the result of evaluating a flag, whether locally or
// via the remote API.
type EvaluationResult struct {
	FlagKey      string      `json:"flag_key"`
	VariationID  string      `json:"variation_id,omitempty"`
	VariationKey string      `json:"variation_key,omitempty"`
	Value        interface{} `json:"value"`
	Reason       string      `json:"reason"`
}

// ---------------------------------------------------------------------------
// Event types (sent to POST /sdk/events)
// ---------------------------------------------------------------------------

// EvaluationEvent is an evaluation event to be sent for analytics.
type EvaluationEvent struct {
	FlagKey      string                 `json:"flag_key"`
	VariationKey string                 `json:"variation_key,omitempty"`
	UserID       string                 `json:"user_id,omitempty"`
	Timestamp    string                 `json:"timestamp,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}
