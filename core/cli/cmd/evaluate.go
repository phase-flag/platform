package cmd

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
)

// EvaluateCommand handles the "evaluate" subcommand.
func EvaluateCommand(args []string) {
	fs := flag.NewFlagSet("evaluate", flag.ExitOnError)
	userID := fs.String("user-id", "", "User ID for evaluation context")
	environment := fs.String("environment", "", "Target environment")
	format := fs.String("format", "table", "Output format: json or table")

	// Collect --attr key=value pairs
	var attrs multiFlag
	fs.Var(&attrs, "attr", "Context attribute in key=value format (repeatable)")

	fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		fmt.Fprintln(os.Stderr, "Usage: pfctl evaluate <flag-key> --user-id <id> [--attr key=value ...]")
		os.Exit(1)
	}

	flagKey := remaining[0]
	cfg := LoadConfig()
	if *environment == "" {
		*environment = cfg.Environment
	}

	// Build evaluation context
	context := map[string]interface{}{}
	if *userID != "" {
		context["user_id"] = *userID
	}
	for _, attr := range attrs {
		parts := strings.SplitN(attr, "=", 2)
		if len(parts) == 2 {
			context[parts[0]] = parts[1]
		}
	}

	body := map[string]interface{}{
		"flag_key":    flagKey,
		"context":     context,
		"environment": *environment,
	}

	payload, _ := json.Marshal(body)
	url := fmt.Sprintf("%s/api/v1/sdk/evaluate", cfg.APIURL)

	resp, err := doRequest("POST", url, payload, cfg.APIKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if *format == "json" {
		printJSON(resp)
		return
	}

	var result map[string]interface{}
	if err := json.Unmarshal(resp, &result); err != nil {
		printJSON(resp)
		return
	}

	fmt.Printf("Flag:          %s\n", flagKey)
	fmt.Printf("Environment:   %s\n", *environment)
	fmt.Printf("Variation:     %s\n", getString(result, "variation_key"))
	fmt.Printf("Value:         %v\n", result["value"])
	fmt.Printf("Reason:        %s\n", getString(result, "reason"))

	if variationID := getString(result, "variation_id"); variationID != "" {
		fmt.Printf("Variation ID:  %s\n", variationID)
	}

	// Print trace if present
	if trace, ok := result["trace"].(map[string]interface{}); ok {
		fmt.Printf("\nEvaluation Trace:\n")
		fmt.Printf("  Rules evaluated: %v\n", trace["rules_evaluated"])
		if idx := trace["matched_rule_index"]; idx != nil {
			fmt.Printf("  Matched rule:    %v\n", idx)
		} else {
			fmt.Printf("  Matched rule:    none (default served)\n")
		}
	}
}

// multiFlag allows repeating a flag (e.g., --attr k1=v1 --attr k2=v2).
type multiFlag []string

func (m *multiFlag) String() string {
	return strings.Join(*m, ", ")
}

func (m *multiFlag) Set(value string) error {
	*m = append(*m, value)
	return nil
}
