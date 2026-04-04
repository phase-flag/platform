package cmd

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
)

// ExportCommand handles the "export" subcommand.
func ExportCommand(args []string) {
	fs := flag.NewFlagSet("export", flag.ExitOnError)
	output := fs.String("output", "", "Output file path (default: stdout)")
	environment := fs.String("environment", "", "Target environment")
	pretty := fs.Bool("pretty", true, "Pretty-print JSON output")
	fs.Parse(args)

	cfg := LoadConfig()
	if *environment == "" {
		*environment = cfg.Environment
	}

	url := fmt.Sprintf("%s/api/v1/flags?environment=%s", cfg.APIURL, *environment)
	resp, err := doRequest("GET", url, nil, cfg.APIKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error fetching flags: %v\n", err)
		os.Exit(1)
	}

	// Parse the response to build a clean export structure
	var flags interface{}
	if err := json.Unmarshal(resp, &flags); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing response: %v\n", err)
		os.Exit(1)
	}

	export := map[string]interface{}{
		"version":     "1.0",
		"exported_by": "pfctl",
		"environment": *environment,
		"flags":       flags,
	}

	var data []byte
	if *pretty {
		data, err = json.MarshalIndent(export, "", "  ")
	} else {
		data, err = json.Marshal(export)
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error encoding export: %v\n", err)
		os.Exit(1)
	}

	if *output == "" {
		fmt.Println(string(data))
		return
	}

	if err := os.WriteFile(*output, data, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing file: %v\n", err)
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "Exported flags to %s\n", *output)
}

// ImportCommand handles the "import" subcommand.
func ImportCommand(args []string) {
	fs := flag.NewFlagSet("import", flag.ExitOnError)
	input := fs.String("input", "", "Input file path (required)")
	environment := fs.String("environment", "", "Target environment")
	dryRun := fs.Bool("dry-run", false, "Preview changes without applying")
	merge := fs.Bool("merge", false, "Merge with existing flags (skip existing keys)")
	fs.Parse(args)

	if *input == "" {
		fmt.Fprintln(os.Stderr, "Error: --input is required")
		fmt.Fprintln(os.Stderr, "Usage: pfctl import --input flags.json [--environment dev] [--dry-run] [--merge]")
		os.Exit(1)
	}

	cfg := LoadConfig()
	if *environment == "" {
		*environment = cfg.Environment
	}

	data, err := os.ReadFile(*input)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error reading file: %v\n", err)
		os.Exit(1)
	}

	// Parse the import file
	var importData map[string]interface{}
	if err := json.Unmarshal(data, &importData); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing import file: %v\n", err)
		os.Exit(1)
	}

	flags, ok := importData["flags"]
	if !ok {
		// Try treating the whole file as a flags array
		var flagsArr []interface{}
		if err := json.Unmarshal(data, &flagsArr); err != nil {
			fmt.Fprintln(os.Stderr, "Error: import file must contain a 'flags' key or be an array of flags")
			os.Exit(1)
		}
		flags = flagsArr
	}

	// Get existing flags for merge mode
	var existingKeys map[string]bool
	if *merge {
		existingKeys = make(map[string]bool)
		existingURL := fmt.Sprintf("%s/api/v1/flags?environment=%s", cfg.APIURL, *environment)
		existingResp, err := doRequest("GET", existingURL, nil, cfg.APIKey)
		if err == nil {
			var existing []map[string]interface{}
			if json.Unmarshal(existingResp, &existing) == nil {
				for _, f := range existing {
					if key, ok := f["key"].(string); ok {
						existingKeys[key] = true
					}
				}
			}
		}
	}

	// Import each flag
	flagsList, ok := flags.([]interface{})
	if !ok {
		fmt.Fprintln(os.Stderr, "Error: flags must be an array")
		os.Exit(1)
	}

	created := 0
	skipped := 0
	errors := 0

	for _, f := range flagsList {
		fm, ok := f.(map[string]interface{})
		if !ok {
			errors++
			continue
		}

		key := getString(fm, "key")
		if key == "" {
			fmt.Fprintln(os.Stderr, "Warning: skipping flag without key")
			errors++
			continue
		}

		if *merge && existingKeys != nil && existingKeys[key] {
			if *dryRun {
				fmt.Printf("[SKIP] %s (already exists)\n", key)
			}
			skipped++
			continue
		}

		// Override environment
		fm["environment"] = *environment

		if *dryRun {
			fmt.Printf("[CREATE] %s (%s)\n", key, getString(fm, "name"))
			created++
			continue
		}

		payload, _ := json.Marshal(fm)
		url := fmt.Sprintf("%s/api/v1/flags", cfg.APIURL)
		_, err := doRequest("POST", url, payload, cfg.APIKey)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error creating flag '%s': %v\n", key, err)
			errors++
			continue
		}

		fmt.Printf("Created: %s\n", key)
		created++
	}

	fmt.Printf("\nImport complete: %d created, %d skipped, %d errors\n", created, skipped, errors)
}
