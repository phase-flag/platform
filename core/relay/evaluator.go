package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// EvaluationResult is the outcome of evaluating a flag for a context.
type EvaluationResult struct {
	VariationID  string      `json:"variation_id"`
	VariationKey string      `json:"variation_key"`
	Value        interface{} `json:"value"`
	Reason       string      `json:"reason"`
}

// Flag represents a feature flag definition from the ruleset.
type Flag struct {
	Key                string            `json:"key"`
	Name               string            `json:"name"`
	FlagType           string            `json:"flag_type"`
	Status             string            `json:"status"`
	DefaultVariationID string            `json:"default_variation_id"`
	Variations         []Variation       `json:"variations"`
	TargetingRules     []TargetingRule   `json:"targeting_rules"`
}

// Variation is a possible value a flag can return.
type Variation struct {
	ID    string      `json:"id"`
	Key   string      `json:"key"`
	Name  string      `json:"name"`
	Value interface{} `json:"value"`
}

// TargetingRule defines conditions for serving a specific variation.
type TargetingRule struct {
	Priority          int                `json:"priority"`
	Conditions        []Condition        `json:"conditions"`
	VariationID       string             `json:"variation_id,omitempty"`
	PercentageRollout *PercentageRollout `json:"percentage_rollout,omitempty"`
}

// Condition is a single targeting condition.
type Condition struct {
	Attribute string      `json:"attribute"`
	Operator  string      `json:"operator"`
	Value     interface{} `json:"value"`
}

// PercentageRollout distributes traffic across variations by weight.
type PercentageRollout struct {
	Variations []RolloutEntry `json:"variations"`
}

// RolloutEntry maps a variation to a weight (0-100).
type RolloutEntry struct {
	VariationID string `json:"variation_id"`
	Weight      int    `json:"weight"`
}

// Ruleset is the compiled set of flags from the control plane.
type Ruleset struct {
	Flags []Flag `json:"flags"`
}

// ParseRuleset parses JSON ruleset data into a Ruleset struct.
func ParseRuleset(data []byte) (*Ruleset, error) {
	var rs Ruleset
	if err := json.Unmarshal(data, &rs); err != nil {
		// Try parsing as array of flags directly
		var flags []Flag
		if err2 := json.Unmarshal(data, &flags); err2 != nil {
			return nil, fmt.Errorf("invalid ruleset format: %w", err)
		}
		rs.Flags = flags
	}
	return &rs, nil
}

// Evaluate runs the evaluation engine on a flag for a given context.
func Evaluate(flag Flag, context map[string]interface{}) EvaluationResult {
	variationsByID := make(map[string]Variation)
	for _, v := range flag.Variations {
		variationsByID[v.ID] = v
	}

	makeResult := func(variationID, reason string) EvaluationResult {
		v := variationsByID[variationID]
		return EvaluationResult{
			VariationID:  variationID,
			VariationKey: v.Key,
			Value:        v.Value,
			Reason:       reason,
		}
	}

	// Check flag status
	if flag.Status != "active" {
		return makeResult(flag.DefaultVariationID, "flag_inactive")
	}

	// Sort rules by priority (lower = higher priority)
	rules := make([]TargetingRule, len(flag.TargetingRules))
	copy(rules, flag.TargetingRules)
	sortRulesByPriority(rules)

	// Evaluate each rule
	for _, rule := range rules {
		if !evaluateConditions(rule.Conditions, context) {
			continue
		}

		// Direct variation match
		if rule.VariationID != "" {
			return makeResult(rule.VariationID, "targeting_match")
		}

		// Percentage rollout
		if rule.PercentageRollout != nil {
			userID := getContextString(context, "user_id")
			if userID == "" {
				userID = getContextString(context, "session_id")
			}
			if userID != "" {
				vid := resolvePercentageRollout(rule.PercentageRollout, flag.Key, userID)
				if vid != "" {
					return makeResult(vid, "percentage_rollout")
				}
			}
		}
	}

	return makeResult(flag.DefaultVariationID, "default")
}

// EvaluateAll evaluates all flags in a ruleset for a given context.
func EvaluateAll(rs *Ruleset, context map[string]interface{}) map[string]EvaluationResult {
	results := make(map[string]EvaluationResult)
	for _, flag := range rs.Flags {
		results[flag.Key] = Evaluate(flag, context)
	}
	return results
}

// FindFlag looks up a flag by key in a ruleset.
func FindFlag(rs *Ruleset, key string) *Flag {
	for i := range rs.Flags {
		if rs.Flags[i].Key == key {
			return &rs.Flags[i]
		}
	}
	return nil
}

// --- DJB2 hashing (matching the Python/SDK implementation) ---

func djb2Hash(value string) uint32 {
	var h uint32 = 5381
	for _, ch := range value {
		h = ((h << 5) + h + uint32(ch)) & 0xFFFFFFFF
	}
	return h
}

func normalisedHash(flagKey, userID string) int {
	raw := djb2Hash(flagKey + ":" + userID)
	return int(raw % 100)
}

func resolvePercentageRollout(rollout *PercentageRollout, flagKey, userID string) string {
	bucket := normalisedHash(flagKey, userID)
	cumulative := 0
	for _, entry := range rollout.Variations {
		cumulative += entry.Weight
		if bucket < cumulative {
			return entry.VariationID
		}
	}
	return ""
}

// --- Condition evaluation ---

func evaluateConditions(conditions []Condition, context map[string]interface{}) bool {
	for _, cond := range conditions {
		if !evaluateCondition(cond, context) {
			return false
		}
	}
	return true
}

func evaluateCondition(cond Condition, context map[string]interface{}) bool {
	actual, exists := context[cond.Attribute]

	if !exists || actual == nil {
		return cond.Operator == "is_not" || cond.Operator == "not_contains" || cond.Operator == "not_one_of"
	}

	actualStr := fmt.Sprintf("%v", actual)
	targetStr := fmt.Sprintf("%v", cond.Value)

	switch cond.Operator {
	case "is":
		return actualStr == targetStr
	case "is_not":
		return actualStr != targetStr
	case "contains":
		return strings.Contains(actualStr, targetStr)
	case "not_contains":
		return !strings.Contains(actualStr, targetStr)
	case "one_of":
		return isOneOf(actualStr, cond.Value)
	case "not_one_of":
		return !isOneOf(actualStr, cond.Value)
	case "gt":
		a, errA := strconv.ParseFloat(actualStr, 64)
		b, errB := strconv.ParseFloat(targetStr, 64)
		return errA == nil && errB == nil && a > b
	case "lt":
		a, errA := strconv.ParseFloat(actualStr, 64)
		b, errB := strconv.ParseFloat(targetStr, 64)
		return errA == nil && errB == nil && a < b
	case "matches_regex":
		matched, err := regexp.MatchString(targetStr, actualStr)
		return err == nil && matched
	case "version_gt":
		return compareVersions(actualStr, targetStr) > 0
	case "version_lt":
		return compareVersions(actualStr, targetStr) < 0
	default:
		return false
	}
}

func isOneOf(actual string, target interface{}) bool {
	switch v := target.(type) {
	case []interface{}:
		for _, item := range v {
			if fmt.Sprintf("%v", item) == actual {
				return true
			}
		}
		return false
	case []string:
		for _, item := range v {
			if item == actual {
				return true
			}
		}
		return false
	default:
		return actual == fmt.Sprintf("%v", target)
	}
}

func compareVersions(a, b string) int {
	aParts := strings.Split(a, ".")
	bParts := strings.Split(b, ".")

	maxLen := len(aParts)
	if len(bParts) > maxLen {
		maxLen = len(bParts)
	}

	for i := 0; i < maxLen; i++ {
		var aNum, bNum int
		if i < len(aParts) {
			aNum, _ = strconv.Atoi(aParts[i])
		}
		if i < len(bParts) {
			bNum, _ = strconv.Atoi(bParts[i])
		}
		if aNum < bNum {
			return -1
		}
		if aNum > bNum {
			return 1
		}
	}
	return 0
}

func getContextString(context map[string]interface{}, key string) string {
	v, ok := context[key]
	if !ok || v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}

func sortRulesByPriority(rules []TargetingRule) {
	// Simple insertion sort (small lists)
	for i := 1; i < len(rules); i++ {
		key := rules[i]
		j := i - 1
		for j >= 0 && rules[j].Priority > key.Priority {
			rules[j+1] = rules[j]
			j--
		}
		rules[j+1] = key
	}
}
