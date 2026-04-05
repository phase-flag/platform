package cmd

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"text/tabwriter"
)

// CleanupCommand dispatches cleanup subcommands.
func CleanupCommand(args []string) {
	if len(args) < 1 {
		printCleanupUsage()
		os.Exit(1)
	}

	subcommand := args[0]
	subArgs := args[1:]

	switch subcommand {
	case "list":
		cleanupList(subArgs)
	case "archive":
		cleanupArchive(subArgs)
	case "report":
		cleanupReport(subArgs)
	default:
		fmt.Fprintf(os.Stderr, "Unknown cleanup subcommand: %s\n", subcommand)
		printCleanupUsage()
		os.Exit(1)
	}
}

func printCleanupUsage() {
	fmt.Println(`pfctl cleanup — Flag lifecycle cleanup tools

Usage:
  pfctl cleanup <subcommand> [flags]

Subcommands:
  list      List stale flags (no evaluations in N days)
  archive   Archive stale or expired flags (auto-archive with grace period)
  report    Generate a cleanup report with tech debt metrics

Examples:
  pfctl cleanup list
  pfctl cleanup list --threshold-days 60 --format json
  pfctl cleanup archive
  pfctl cleanup report
  pfctl cleanup report --team platform`)
}

// cleanupList lists stale flags by calling the detect-stale endpoint.
func cleanupList(args []string) {
	fs := flag.NewFlagSet("cleanup list", flag.ExitOnError)
	thresholdDays := fs.Int("threshold-days", 90, "Days without evaluation before a flag is considered stale")
	format := fs.String("format", "table", "Output format: json or table")
	fs.Parse(args)

	cfg := LoadConfig()

	body := map[string]interface{}{
		"threshold_days": *thresholdDays,
	}
	payload, _ := json.Marshal(body)

	url := fmt.Sprintf("%s/api/v1/automation/detect-stale", cfg.APIURL)
	resp, err := doRequest("POST", url, payload, cfg.APIKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error detecting stale flags: %v\n", err)
		os.Exit(1)
	}

	if *format == "json" {
		fmt.Println(string(resp))
		return
	}

	var result struct {
		StaleCount    int `json:"stale_count"`
		ThresholdDays int `json:"threshold_days"`
		Flags         []struct {
			Key              string  `json:"key"`
			Name             string  `json:"name"`
			Owner            string  `json:"owner"`
			OwnerTeam        *string `json:"owner_team"`
			LifecycleStage   string  `json:"lifecycle_stage"`
			LastEvaluatedAt  *string `json:"last_evaluated_at"`
			DaysSinceEval    *int    `json:"days_since_evaluation"`
		} `json:"flags"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Stale flags (threshold: %d days): %d found\n\n", result.ThresholdDays, result.StaleCount)

	if len(result.Flags) == 0 {
		fmt.Println("No stale flags found.")
		return
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "KEY\tNAME\tOWNER\tTEAM\tSTAGE\tLAST EVALUATED")
	for _, f := range result.Flags {
		team := ""
		if f.OwnerTeam != nil {
			team = *f.OwnerTeam
		}
		lastEval := "never"
		if f.LastEvaluatedAt != nil {
			lastEval = *f.LastEvaluatedAt
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n",
			f.Key, f.Name, f.Owner, team, f.LifecycleStage, lastEval)
	}
	w.Flush()
}

// cleanupArchive triggers auto-archival of expired flags.
func cleanupArchive(args []string) {
	fs := flag.NewFlagSet("cleanup archive", flag.ExitOnError)
	format := fs.String("format", "table", "Output format: json or table")
	fs.Parse(args)

	cfg := LoadConfig()

	url := fmt.Sprintf("%s/api/v1/automation/auto-archive", cfg.APIURL)
	resp, err := doRequest("POST", url, nil, cfg.APIKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error running auto-archive: %v\n", err)
		os.Exit(1)
	}

	if *format == "json" {
		fmt.Println(string(resp))
		return
	}

	var result struct {
		ArchivedCount int `json:"archived_count"`
		Flags         []struct {
			Key       string  `json:"key"`
			Name      string  `json:"name"`
			Owner     string  `json:"owner"`
			ExpiresAt *string `json:"expires_at"`
		} `json:"flags"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Auto-archive complete: %d flag(s) archived\n", result.ArchivedCount)

	if len(result.Flags) == 0 {
		fmt.Println("No flags were archived.")
		return
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "KEY\tNAME\tOWNER\tEXPIRED AT")
	for _, f := range result.Flags {
		expiresAt := ""
		if f.ExpiresAt != nil {
			expiresAt = *f.ExpiresAt
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n", f.Key, f.Name, f.Owner, expiresAt)
	}
	w.Flush()
}

// cleanupReport generates a tech debt cleanup report.
func cleanupReport(args []string) {
	fs := flag.NewFlagSet("cleanup report", flag.ExitOnError)
	team := fs.String("team", "", "Filter report by owner team")
	format := fs.String("format", "table", "Output format: json or table")
	fs.Parse(args)

	cfg := LoadConfig()

	url := fmt.Sprintf("%s/api/v1/automation/cleanup-report", cfg.APIURL)
	if *team != "" {
		url = fmt.Sprintf("%s?team=%s", url, *team)
	}

	resp, err := doRequest("GET", url, nil, cfg.APIKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error fetching cleanup report: %v\n", err)
		os.Exit(1)
	}

	if *format == "json" {
		fmt.Println(string(resp))
		return
	}

	var result struct {
		GeneratedAt  string `json:"generated_at"`
		FilterTeam   *string `json:"filter_team"`
		StaleCount   int    `json:"stale_count"`
		Trend        struct {
			Stale90DTotal  int `json:"stale_90d_total"`
			Stale30DTotal  int `json:"stale_30d_total"`
			ArchivedTotal  int `json:"archived_total"`
			ExpiredTotal   int `json:"expired_total"`
		} `json:"trend"`
		TeamScorecard []struct {
			OwnerTeam     string  `json:"owner_team"`
			Stale90D      int     `json:"stale_90d"`
			Stale30D      int     `json:"stale_30d"`
			Archived      int     `json:"archived"`
			Expired       int     `json:"expired"`
			Total         int     `json:"total"`
			TechDebtScore float64 `json:"tech_debt_score"`
		} `json:"team_scorecard"`
	}
	if err := json.Unmarshal(resp, &result); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Cleanup Report — Generated: %s\n", result.GeneratedAt)
	if result.FilterTeam != nil {
		fmt.Printf("Team filter: %s\n", *result.FilterTeam)
	}
	fmt.Printf("\nSummary:\n")
	fmt.Printf("  Stale flags (90d):  %d\n", result.Trend.Stale90DTotal)
	fmt.Printf("  Stale flags (30d):  %d\n", result.Trend.Stale30DTotal)
	fmt.Printf("  Expired flags:      %d\n", result.Trend.ExpiredTotal)
	fmt.Printf("  Archived flags:     %d\n", result.Trend.ArchivedTotal)

	if len(result.TeamScorecard) == 0 {
		fmt.Println("\nNo team data available.")
		return
	}

	fmt.Printf("\nTeam Scorecard (sorted by tech debt score):\n")
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "TEAM\tTOTAL\tSTALE(90d)\tSTALE(30d)\tEXPIRED\tARCHIVED\tDEBT SCORE")
	for _, row := range result.TeamScorecard {
		fmt.Fprintf(w, "%s\t%d\t%d\t%d\t%d\t%d\t%.1f%%\n",
			row.OwnerTeam, row.Total, row.Stale90D, row.Stale30D,
			row.Expired, row.Archived, row.TechDebtScore)
	}
	w.Flush()
}
