package cmd

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"text/tabwriter"
)

// FlagsCommand dispatches flag subcommands.
func FlagsCommand(args []string) {
	if len(args) < 1 {
		printFlagsUsage()
		os.Exit(1)
	}

	subcommand := args[0]
	subArgs := args[1:]

	switch subcommand {
	case "list":
		flagsList(subArgs)
	case "get":
		flagsGet(subArgs)
	case "create":
		flagsCreate(subArgs)
	case "toggle":
		flagsToggle(subArgs)
	case "archive":
		flagsArchive(subArgs)
	default:
		fmt.Fprintf(os.Stderr, "Unknown flags subcommand: %s\n", subcommand)
		printFlagsUsage()
		os.Exit(1)
	}
}

func flagsList(args []string) {
	fs := flag.NewFlagSet("flags list", flag.ExitOnError)
	format := fs.String("format", "table", "Output format: json or table")
	environment := fs.String("environment", "", "Target environment")
	status := fs.String("status", "", "Filter by status (active, inactive, archived)")
	tag := fs.String("tag", "", "Filter by tag")
	fs.Parse(args)

	cfg := LoadConfig()
	if *environment == "" {
		*environment = cfg.Environment
	}

	url := fmt.Sprintf("%s/api/v1/flags?environment=%s", cfg.APIURL, *environment)
	if *status != "" {
		url += "&status=" + *status
	}
	if *tag != "" {
		url += "&tag=" + *tag
	}

	resp, err := doRequest("GET", url, nil, cfg.APIKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if *format == "json" {
		printJSON(resp)
		return
	}

	// Parse as array of flags
	var flags []map[string]interface{}
	if err := json.Unmarshal(resp, &flags); err != nil {
		// Try wrapped response
		var wrapped map[string]interface{}
		if err2 := json.Unmarshal(resp, &wrapped); err2 != nil {
			fmt.Fprintf(os.Stderr, "Error parsing response: %v\n", err)
			os.Exit(1)
		}
		if items, ok := wrapped["items"].([]interface{}); ok {
			for _, item := range items {
				if m, ok := item.(map[string]interface{}); ok {
					flags = append(flags, m)
				}
			}
		}
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "KEY\tNAME\tTYPE\tSTATUS\tENVIRONMENT\tCLASSIFICATION")
	for _, f := range flags {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n",
			getString(f, "key"),
			getString(f, "name"),
			getString(f, "flag_type"),
			getString(f, "status"),
			getString(f, "environment"),
			getString(f, "flag_classification"),
		)
	}
	w.Flush()
}

func flagsGet(args []string) {
	fs := flag.NewFlagSet("flags get", flag.ExitOnError)
	format := fs.String("format", "table", "Output format: json or table")
	fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		fmt.Fprintln(os.Stderr, "Usage: pfctl flags get <flag-key>")
		os.Exit(1)
	}

	flagKey := remaining[0]
	cfg := LoadConfig()

	url := fmt.Sprintf("%s/api/v1/flags/%s", cfg.APIURL, flagKey)
	resp, err := doRequest("GET", url, nil, cfg.APIKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if *format == "json" {
		printJSON(resp)
		return
	}

	var f map[string]interface{}
	if err := json.Unmarshal(resp, &f); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing response: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Key:            %s\n", getString(f, "key"))
	fmt.Printf("Name:           %s\n", getString(f, "name"))
	fmt.Printf("Type:           %s\n", getString(f, "flag_type"))
	fmt.Printf("Status:         %s\n", getString(f, "status"))
	fmt.Printf("Environment:    %s\n", getString(f, "environment"))
	fmt.Printf("Classification: %s\n", getString(f, "flag_classification"))
	fmt.Printf("Lifecycle:      %s\n", getString(f, "lifecycle_stage"))
	fmt.Printf("Permanent:      %v\n", f["is_permanent"])
	fmt.Printf("Owner:          %s\n", getString(f, "owner"))
	fmt.Printf("Owner Team:     %s\n", getString(f, "owner_team"))
	fmt.Printf("Created At:     %s\n", getString(f, "created_at"))
	fmt.Printf("Updated At:     %s\n", getString(f, "updated_at"))

	if desc := getString(f, "description"); desc != "" {
		fmt.Printf("Description:    %s\n", desc)
	}
	if ticket := getString(f, "ticket_url"); ticket != "" {
		fmt.Printf("Ticket URL:     %s\n", ticket)
	}
	if runbook := getString(f, "runbook_url"); runbook != "" {
		fmt.Printf("Runbook URL:    %s\n", runbook)
	}

	// Print variations
	if variations, ok := f["variations"].([]interface{}); ok && len(variations) > 0 {
		fmt.Println("\nVariations:")
		w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
		fmt.Fprintln(w, "  KEY\tNAME\tVALUE")
		for _, v := range variations {
			if vm, ok := v.(map[string]interface{}); ok {
				fmt.Fprintf(w, "  %s\t%s\t%v\n",
					getString(vm, "key"),
					getString(vm, "name"),
					vm["value"],
				)
			}
		}
		w.Flush()
	}

	// Print targeting rules
	if rules, ok := f["targeting_rules"].([]interface{}); ok && len(rules) > 0 {
		fmt.Printf("\nTargeting Rules: %d rule(s)\n", len(rules))
	}
}

func flagsCreate(args []string) {
	fs := flag.NewFlagSet("flags create", flag.ExitOnError)
	key := fs.String("key", "", "Flag key (required)")
	name := fs.String("name", "", "Flag name (required)")
	flagType := fs.String("type", "boolean", "Flag type: boolean, string, number, json")
	description := fs.String("description", "", "Flag description")
	environment := fs.String("environment", "", "Target environment")
	classification := fs.String("classification", "release", "Classification: release, experiment, ops_killswitch, permission, migration")
	permanent := fs.Bool("permanent", false, "Mark as permanent flag")
	owner := fs.String("owner", "", "Flag owner")
	ownerTeam := fs.String("owner-team", "", "Owner team")
	ticketURL := fs.String("ticket-url", "", "Related ticket URL")
	tags := fs.String("tags", "", "Comma-separated tags")
	format := fs.String("format", "table", "Output format: json or table")
	fs.Parse(args)

	if *key == "" || *name == "" {
		fmt.Fprintln(os.Stderr, "Error: --key and --name are required")
		fmt.Fprintln(os.Stderr, "Usage: pfctl flags create --key <key> --name <name> [--type boolean]")
		os.Exit(1)
	}

	cfg := LoadConfig()
	if *environment == "" {
		*environment = cfg.Environment
	}

	body := map[string]interface{}{
		"key":                 *key,
		"name":                *name,
		"flag_type":           *flagType,
		"environment":         *environment,
		"flag_classification": *classification,
		"is_permanent":        *permanent,
	}

	if *description != "" {
		body["description"] = *description
	}
	if *owner != "" {
		body["owner"] = *owner
	}
	if *ownerTeam != "" {
		body["owner_team"] = *ownerTeam
	}
	if *ticketURL != "" {
		body["ticket_url"] = *ticketURL
	}
	if *tags != "" {
		tagList := strings.Split(*tags, ",")
		for i := range tagList {
			tagList[i] = strings.TrimSpace(tagList[i])
		}
		body["tags"] = tagList
	}

	payload, _ := json.Marshal(body)
	url := fmt.Sprintf("%s/api/v1/flags", cfg.APIURL)

	resp, err := doRequest("POST", url, payload, cfg.APIKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if *format == "json" {
		printJSON(resp)
		return
	}

	var f map[string]interface{}
	if err := json.Unmarshal(resp, &f); err != nil {
		printJSON(resp)
		return
	}

	fmt.Printf("Created flag: %s (%s)\n", getString(f, "key"), getString(f, "name"))
	fmt.Printf("Type: %s | Status: %s | Environment: %s\n",
		getString(f, "flag_type"), getString(f, "status"), getString(f, "environment"))
}

func flagsToggle(args []string) {
	fs := flag.NewFlagSet("flags toggle", flag.ExitOnError)
	environment := fs.String("environment", "", "Target environment")
	format := fs.String("format", "json", "Output format: json or table")
	fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		fmt.Fprintln(os.Stderr, "Usage: pfctl flags toggle <flag-key>")
		os.Exit(1)
	}

	flagKey := remaining[0]
	cfg := LoadConfig()
	if *environment == "" {
		*environment = cfg.Environment
	}

	url := fmt.Sprintf("%s/api/v1/flags/%s/toggle", cfg.APIURL, flagKey)
	resp, err := doRequest("POST", url, nil, cfg.APIKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if *format == "json" {
		printJSON(resp)
		return
	}

	var f map[string]interface{}
	if err := json.Unmarshal(resp, &f); err != nil {
		printJSON(resp)
		return
	}

	fmt.Printf("Toggled flag '%s' -> status: %s\n", flagKey, getString(f, "status"))
}

func flagsArchive(args []string) {
	fs := flag.NewFlagSet("flags archive", flag.ExitOnError)
	format := fs.String("format", "json", "Output format: json or table")
	fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		fmt.Fprintln(os.Stderr, "Usage: pfctl flags archive <flag-key>")
		os.Exit(1)
	}

	flagKey := remaining[0]
	cfg := LoadConfig()

	url := fmt.Sprintf("%s/api/v1/flags/%s/archive", cfg.APIURL, flagKey)
	resp, err := doRequest("POST", url, nil, cfg.APIKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	if *format == "json" {
		printJSON(resp)
		return
	}

	fmt.Printf("Archived flag '%s'\n", flagKey)
}

// --- HTTP helpers ---

func doRequest(method, url string, body []byte, apiKey string) ([]byte, error) {
	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error (HTTP %d): %s", resp.StatusCode, string(data))
	}

	return data, nil
}

func getString(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}

func printJSON(data []byte) {
	var pretty bytes.Buffer
	if err := json.Indent(&pretty, data, "", "  "); err != nil {
		fmt.Println(string(data))
		return
	}
	fmt.Println(pretty.String())
}

func printFlagsUsage() {
	fmt.Println(`Usage: pfctl flags <subcommand> [arguments]

Subcommands:
  list        List all feature flags
  get         Get details for a specific flag
  create      Create a new feature flag
  toggle      Toggle a flag's status
  archive     Archive a flag

List Flags:
  pfctl flags list [--format json|table] [--environment dev] [--status active] [--tag mobile]

Get Flag:
  pfctl flags get <flag-key> [--format json|table]

Create Flag:
  pfctl flags create --key <key> --name <name> [--type boolean] [--classification release]
                     [--description "..."] [--owner user] [--owner-team team]
                     [--ticket-url https://...] [--tags "tag1,tag2"] [--permanent]

Toggle Flag:
  pfctl flags toggle <flag-key> [--environment production]

Archive Flag:
  pfctl flags archive <flag-key>`)
}
