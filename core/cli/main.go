package main

import (
	"fmt"
	"os"

	"github.com/phaseflag/pfctl/cmd"
)

const version = "0.1.0"

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "flags":
		cmd.FlagsCommand(os.Args[2:])
	case "evaluate":
		cmd.EvaluateCommand(os.Args[2:])
	case "config":
		cmd.ConfigCommand(os.Args[2:])
	case "export":
		cmd.ExportCommand(os.Args[2:])
	case "import":
		cmd.ImportCommand(os.Args[2:])
	case "version":
		cmd.VersionCommand(version)
	case "help", "--help", "-h":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println(`pfctl — Phase Flag CLI

Usage:
  pfctl <command> [arguments]

Commands:
  flags       Manage feature flags (list, get, create, toggle, archive)
  evaluate    Evaluate a flag for a given context
  config      Manage CLI configuration (API URL, API key)
  export      Export flags to a JSON file
  import      Import flags from a JSON file
  version     Print version information
  help        Show this help message

Global Flags:
  --format    Output format: json or table (default: table)
  --environment  Target environment (default: from config or "development")

Examples:
  pfctl flags list
  pfctl flags get my-flag
  pfctl flags create --key new-flag --name "New Flag" --type boolean
  pfctl flags toggle my-flag
  pfctl evaluate my-flag --user-id user123 --attr plan=pro
  pfctl export --output flags.json
  pfctl import --input flags.json
  pfctl config set api-url http://localhost:8000
  pfctl config set api-key pf_xxx`)
}
