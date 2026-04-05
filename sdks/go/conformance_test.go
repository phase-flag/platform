package phaseflag

// Conformance test for the Phase Flag Go SDK.
//
// Uses package phaseflag (not phaseflag_test) so we can call the unexported
// evaluate() function directly without a network round-trip.
//
// Run with: go test -run TestConformance -v

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"sort"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Fixture schema types
// ---------------------------------------------------------------------------

type conformanceCase struct {
	Name       string                 `json:"name"`
	Desc       string                 `json:"description"`
	Flags      map[string]rawFlagDef  `json:"flags"`
	Context    map[string]interface{} `json:"context"`
	TargetFlag string                 `json:"target_flag"`
	Expected   conformanceExpected    `json:"expected"`
}

type rawFlagDef struct {
	ID                 string             `json:"id"`
	Key                string             `json:"key"`
	Name               string             `json:"name"`
	FlagType           string             `json:"flag_type"`
	Status             string             `json:"status"`
	Environment        string             `json:"environment"`
	DefaultVariationID string             `json:"default_variation_id"`
	Variations         []rawVariationDef  `json:"variations"`
	TargetingRules     []rawRuleDef       `json:"targeting_rules"`
}

type rawVariationDef struct {
	ID    string      `json:"id"`
	Key   string      `json:"key"`
	Name  string      `json:"name"`
	Value interface{} `json:"value"`
}

type rawRuleDef struct {
	Priority          int                    `json:"priority"`
	Conditions        []rawConditionDef      `json:"conditions"`
	VariationID       string                 `json:"variation_id"`
	PercentageRollout *rawRolloutDef         `json:"percentage_rollout"`
}

type rawConditionDef struct {
	Attribute string      `json:"attribute"`
	Operator  string      `json:"operator"`
	Value     interface{} `json:"value"`
}

type rawRolloutDef struct {
	Variations []rawRolloutEntryDef `json:"variations"`
}

type rawRolloutEntryDef struct {
	VariationID string `json:"variation_id"`
	Weight      int    `json:"weight"`
}

type conformanceExpected struct {
	FlagKey      string      `json:"flag_key"`
	Value        interface{} `json:"value"`
	VariationKey interface{} `json:"variation_key"` // can be string or null
	Reason       string      `json:"reason"`
}

type conformanceSuite struct {
	Suite string            `json:"suite"`
	Cases []conformanceCase `json:"cases"`
}

// ---------------------------------------------------------------------------
// Convert raw fixture types to SDK internal types
// ---------------------------------------------------------------------------

func rawToFlagDefinition(rf rawFlagDef) FlagDefinition {
	variations := make([]Variation, len(rf.Variations))
	for i, v := range rf.Variations {
		variations[i] = Variation{
			ID:    v.ID,
			Key:   v.Key,
			Name:  v.Name,
			Value: v.Value,
		}
	}

	rules := make([]TargetingRule, len(rf.TargetingRules))
	for i, r := range rf.TargetingRules {
		conds := make([]TargetingCondition, len(r.Conditions))
		for j, c := range r.Conditions {
			conds[j] = TargetingCondition{
				Attribute: c.Attribute,
				Operator:  c.Operator,
				Value:     c.Value,
			}
		}

		rule := TargetingRule{
			Priority:    r.Priority,
			Conditions:  conds,
			VariationID: r.VariationID,
		}

		if r.PercentageRollout != nil {
			entries := make([]PercentageRolloutEntry, len(r.PercentageRollout.Variations))
			for k, e := range r.PercentageRollout.Variations {
				entries[k] = PercentageRolloutEntry{
					VariationID: e.VariationID,
					Weight:      e.Weight,
				}
			}
			rule.PercentageRollout = &PercentageRollout{Variations: entries}
		}

		rules[i] = rule
	}

	return FlagDefinition{
		ID:                 rf.ID,
		Key:                rf.Key,
		Name:               rf.Name,
		FlagType:           rf.FlagType,
		Status:             rf.Status,
		Environment:        rf.Environment,
		DefaultVariationID: rf.DefaultVariationID,
		Variations:         variations,
		TargetingRules:     rules,
	}
}

func rawToContext(raw map[string]interface{}) *EvaluationContext {
	if raw == nil {
		return &EvaluationContext{}
	}
	ctx := &EvaluationContext{}

	if uid, ok := raw["user_id"].(string); ok {
		ctx.UserID = uid
	}
	if sid, ok := raw["session_id"].(string); ok {
		ctx.SessionID = sid
	}
	if attrs, ok := raw["attributes"].(map[string]interface{}); ok {
		ctx.Attributes = attrs
	}

	return ctx
}

// ---------------------------------------------------------------------------
// Deep equality helper for JSON-decoded interface{} values
// ---------------------------------------------------------------------------

func conformanceDeepEqual(a, b interface{}) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}

	// JSON numbers are float64; compare numerically
	af, aIsFloat := conformanceToFloat(a)
	bf, bIsFloat := conformanceToFloat(b)
	if aIsFloat && bIsFloat {
		return math.Abs(af-bf) < 1e-9
	}

	// Handle maps (JSON objects)
	aMap, aIsMap := a.(map[string]interface{})
	bMap, bIsMap := b.(map[string]interface{})
	if aIsMap && bIsMap {
		if len(aMap) != len(bMap) {
			return false
		}
		for k, av := range aMap {
			bv, ok := bMap[k]
			if !ok {
				return false
			}
			if !conformanceDeepEqual(av, bv) {
				return false
			}
		}
		return true
	}

	// Handle slices
	aSlice, aIsSlice := toSlice(a)
	bSlice, bIsSlice := toSlice(b)
	if aIsSlice && bIsSlice {
		if len(aSlice) != len(bSlice) {
			return false
		}
		for i := range aSlice {
			if !conformanceDeepEqual(aSlice[i], bSlice[i]) {
				return false
			}
		}
		return true
	}

	return reflect.DeepEqual(a, b)
}

func conformanceToFloat(v interface{}) (float64, bool) {
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
	}
	return 0, false
}

func toSlice(v interface{}) ([]interface{}, bool) {
	if s, ok := v.([]interface{}); ok {
		return s, true
	}
	return nil, false
}

// ---------------------------------------------------------------------------
// Locate fixtures directory (relative to this source file)
// ---------------------------------------------------------------------------

func conformanceFixturesDir() string {
	_, thisFile, _, _ := runtime.Caller(0)
	// thisFile = sdks/go/conformance_test.go
	// repoRoot = ../..
	repoRoot := filepath.Join(filepath.Dir(thisFile), "..", "..")
	return filepath.Join(repoRoot, "tests", "sdk-conformance", "fixtures")
}

// ---------------------------------------------------------------------------
// Load all conformance cases from fixture files
// ---------------------------------------------------------------------------

type conformanceCaseRecord struct {
	suiteName string
	tc        conformanceCase
}

func loadConformanceCases(t *testing.T) []conformanceCaseRecord {
	t.Helper()

	dir := conformanceFixturesDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("Cannot read fixtures dir %s: %v", dir, err)
	}

	var records []conformanceCaseRecord

	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		fpath := filepath.Join(dir, entry.Name())
		data, err := os.ReadFile(fpath)
		if err != nil {
			t.Fatalf("Cannot read fixture %s: %v", fpath, err)
		}
		var suite conformanceSuite
		if err := json.Unmarshal(data, &suite); err != nil {
			t.Fatalf("Cannot parse fixture %s: %v", fpath, err)
		}
		suiteName := suite.Suite
		if suiteName == "" {
			suiteName = strings.TrimSuffix(entry.Name(), ".json")
		}
		for _, tc := range suite.Cases {
			records = append(records, conformanceCaseRecord{suiteName: suiteName, tc: tc})
		}
	}

	sort.Slice(records, func(i, j int) bool {
		if records[i].suiteName != records[j].suiteName {
			return records[i].suiteName < records[j].suiteName
		}
		return records[i].tc.Name < records[j].tc.Name
	})

	return records
}

// ---------------------------------------------------------------------------
// Main conformance test function
// ---------------------------------------------------------------------------

func TestConformance(t *testing.T) {
	records := loadConformanceCases(t)

	if len(records) < 200 {
		t.Errorf("Expected at least 200 conformance test cases, got %d", len(records))
	}

	t.Logf("Running %d conformance cases across %d files", len(records),
		countUniqueSuites(records))

	for _, rec := range records {
		rec := rec // capture
		testName := fmt.Sprintf("%s/%s", rec.suiteName, rec.tc.Name)

		t.Run(testName, func(t *testing.T) {
			tc := rec.tc

			// Determine which flag to evaluate
			flagKey := tc.TargetFlag
			if flagKey == "" {
				flagKey = tc.Expected.FlagKey
			}

			rawF, ok := tc.Flags[flagKey]
			if !ok {
				t.Skipf("Flag %q not found in fixture flags map", flagKey)
				return
			}

			flag := rawToFlagDefinition(rawF)
			ctx := rawToContext(tc.Context)

			// Call the internal evaluate function directly (same package)
			result := evaluate(flag, ctx)

			if result == nil {
				t.Fatalf("evaluate() returned nil")
			}

			// Assert value
			if !conformanceDeepEqual(result.Value, tc.Expected.Value) {
				t.Errorf("value: got %v (%T), want %v (%T)",
					result.Value, result.Value,
					tc.Expected.Value, tc.Expected.Value)
			}

			// Assert variation_key (only when non-null expected)
			if tc.Expected.VariationKey != nil {
				expectedVK, _ := tc.Expected.VariationKey.(string)
				if result.VariationKey != expectedVK {
					t.Errorf("variation_key: got %q, want %q",
						result.VariationKey, expectedVK)
				}
			}

			// Assert reason (case-insensitive)
			if tc.Expected.Reason != "" {
				if !strings.EqualFold(result.Reason, tc.Expected.Reason) {
					t.Errorf("reason: got %q, want %q",
						result.Reason, tc.Expected.Reason)
				}
			}
		})
	}
}

func countUniqueSuites(records []conformanceCaseRecord) int {
	seen := map[string]bool{}
	for _, r := range records {
		seen[r.suiteName] = true
	}
	return len(seen)
}

// ---------------------------------------------------------------------------
// Verify all expected fixture files exist
// ---------------------------------------------------------------------------

func TestConformanceFixturesPresent(t *testing.T) {
	dir := conformanceFixturesDir()
	required := []string{
		"operators.json",
		"rollout.json",
		"prerequisites.json",
		"defaults.json",
		"segments.json",
		"edge_cases.json",
		"variations.json",
		"combined.json",
	}
	for _, fname := range required {
		fpath := filepath.Join(dir, fname)
		if _, err := os.Stat(fpath); os.IsNotExist(err) {
			t.Errorf("Missing required fixture file: %s", fname)
		}
	}
}
