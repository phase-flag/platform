package phaseflag

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// ---------------------------------------------------------------------------
// DJB2 hashing (mirrors server-side implementation)
// ---------------------------------------------------------------------------

// djb2Hash computes the DJB2 hash of the input string, returning an
// unsigned 32-bit integer. The hash is seeded at 5381 and computed as
// hash = ((hash << 5) + hash) + char for each byte.
func djb2Hash(input string) uint32 {
	var hash uint32 = 5381
	for i := 0; i < len(input); i++ {
		hash = ((hash << 5) + hash) + uint32(input[i])
	}
	return hash
}

// ---------------------------------------------------------------------------
// Percentage rollout resolution
// ---------------------------------------------------------------------------

// resolvePercentageRollout determines the variation ID for a user via
// percentage rollout. It hashes "{flagKey}:{userID}", takes mod 100,
// and walks the buckets until the cumulative weight exceeds the hash.
// Returns an empty string if the rollout cannot be resolved.
func resolvePercentageRollout(rollout PercentageRollout, flagKey, userID string) string {
	if userID == "" {
		return ""
	}
	bucket := djb2Hash(fmt.Sprintf("%s:%s", flagKey, userID)) % 100
	var cumulative uint32
	for _, entry := range rollout.Variations {
		cumulative += uint32(entry.Weight)
		if bucket < cumulative {
			return entry.VariationID
		}
	}
	return ""
}

// ---------------------------------------------------------------------------
// Condition matching
// ---------------------------------------------------------------------------

// coerceNumeric attempts to convert an arbitrary value to a float64.
// Returns the float64 value and true on success, or 0 and false on failure.
func coerceNumeric(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case int32:
		return float64(n), true
	case string:
		f, err := strconv.ParseFloat(n, 64)
		if err != nil {
			return 0, false
		}
		return f, true
	default:
		// Try the generic Stringer path via fmt
		s := fmt.Sprintf("%v", v)
		f, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return 0, false
		}
		return f, true
	}
}

// toStringSlice converts a value that may be a []interface{} (from JSON
// unmarshalling) into a []string for set-membership checks.
func toStringSlice(v interface{}) []string {
	switch list := v.(type) {
	case []interface{}:
		out := make([]string, len(list))
		for i, item := range list {
			out[i] = fmt.Sprintf("%v", item)
		}
		return out
	case []string:
		return list
	default:
		return []string{fmt.Sprintf("%v", v)}
	}
}

// matchCondition evaluates a single targeting condition against the
// evaluation context. It supports 9 operators: is, is_not, contains,
// not_contains, one_of, not_one_of, gt, lt, matches_regex.
func matchCondition(cond TargetingCondition, ctx *EvaluationContext) bool {
	actual := ctx.Get(cond.Attribute)
	op := cond.Operator
	target := cond.Value

	// Missing attribute never matches (except negation operators).
	if actual == nil {
		return op == "is_not" || op == "not_contains" || op == "not_one_of"
	}

	actualStr := fmt.Sprintf("%v", actual)
	targetStr := fmt.Sprintf("%v", target)

	switch op {
	case "is":
		return actualStr == targetStr

	case "is_not":
		return actualStr != targetStr

	case "contains":
		return strings.Contains(actualStr, targetStr)

	case "not_contains":
		return !strings.Contains(actualStr, targetStr)

	case "one_of":
		values := toStringSlice(target)
		for _, v := range values {
			if actualStr == v {
				return true
			}
		}
		return false

	case "not_one_of":
		values := toStringSlice(target)
		for _, v := range values {
			if actualStr == v {
				return false
			}
		}
		return true

	case "gt":
		a, okA := coerceNumeric(actual)
		b, okB := coerceNumeric(target)
		return okA && okB && a > b

	case "lt":
		a, okA := coerceNumeric(actual)
		b, okB := coerceNumeric(target)
		return okA && okB && a < b

	case "matches_regex":
		re, err := regexp.Compile(targetStr)
		if err != nil {
			return false
		}
		return re.MatchString(actualStr)

	default:
		return false
	}
}

// ---------------------------------------------------------------------------
// Flag evaluation
// ---------------------------------------------------------------------------

// evaluate performs local evaluation of a flag definition against the
// provided context. Rules are sorted by priority (ascending); the first
// matching rule wins. If no rule matches the default variation is returned.
func evaluate(flag FlagDefinition, ctx *EvaluationContext) *EvaluationResult {
	// Build a variation lookup map.
	variationsByID := make(map[string]Variation, len(flag.Variations))
	for _, v := range flag.Variations {
		variationsByID[v.ID] = v
	}

	makeResult := func(variationID, reason string) *EvaluationResult {
		v, ok := variationsByID[variationID]
		result := &EvaluationResult{
			FlagKey:     flag.Key,
			VariationID: variationID,
			Reason:      reason,
		}
		if ok {
			result.VariationKey = v.Key
			result.Value = v.Value
		}
		return result
	}

	// Sort targeting rules by priority (lower number = higher priority).
	rules := make([]TargetingRule, len(flag.TargetingRules))
	copy(rules, flag.TargetingRules)
	sort.Slice(rules, func(i, j int) bool {
		return rules[i].Priority < rules[j].Priority
	})

	for _, rule := range rules {
		// All conditions must match (AND logic).
		allMatch := true
		for _, cond := range rule.Conditions {
			if !matchCondition(cond, ctx) {
				allMatch = false
				break
			}
		}
		if !allMatch {
			continue
		}

		// 1. Explicit variation.
		if rule.VariationID != "" {
			return makeResult(rule.VariationID, "targeting_match")
		}

		// 2. Percentage rollout.
		if rule.PercentageRollout != nil {
			userID := ctx.UserID
			if userID == "" {
				userID = ctx.SessionID
			}
			vid := resolvePercentageRollout(*rule.PercentageRollout, flag.Key, userID)
			if vid != "" {
				return makeResult(vid, "percentage_rollout")
			}
		}
	}

	// No rule matched -- return the default variation.
	return makeResult(flag.DefaultVariationID, "default")
}
