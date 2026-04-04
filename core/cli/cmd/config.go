package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// CLIConfig holds persistent configuration for pfctl.
type CLIConfig struct {
	APIURL      string `json:"api_url"`
	APIKey      string `json:"api_key"`
	Environment string `json:"environment"`
}

func configDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: cannot determine home directory: %v\n", err)
		os.Exit(1)
	}
	return filepath.Join(home, ".phaseflag")
}

func configPath() string {
	return filepath.Join(configDir(), "config.json")
}

// LoadConfig reads the CLI configuration from disk.
func LoadConfig() CLIConfig {
	cfg := CLIConfig{
		APIURL:      "http://localhost:8000",
		Environment: "development",
	}

	data, err := os.ReadFile(configPath())
	if err != nil {
		return cfg
	}

	_ = json.Unmarshal(data, &cfg)
	return cfg
}

// SaveConfig writes the CLI configuration to disk.
func SaveConfig(cfg CLIConfig) error {
	dir := configDir()
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("cannot create config directory: %w", err)
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("cannot marshal config: %w", err)
	}

	return os.WriteFile(configPath(), data, 0600)
}

// ConfigCommand handles the "config" subcommand.
func ConfigCommand(args []string) {
	if len(args) < 1 {
		printConfigUsage()
		os.Exit(1)
	}

	switch args[0] {
	case "set":
		configSet(args[1:])
	case "get":
		configGet(args[1:])
	case "show":
		configShow()
	case "init":
		configInit()
	default:
		fmt.Fprintf(os.Stderr, "Unknown config subcommand: %s\n", args[0])
		printConfigUsage()
		os.Exit(1)
	}
}

func configSet(args []string) {
	if len(args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: pfctl config set <key> <value>")
		fmt.Fprintln(os.Stderr, "Keys: api-url, api-key, environment")
		os.Exit(1)
	}

	cfg := LoadConfig()
	key := args[0]
	value := args[1]

	switch key {
	case "api-url":
		cfg.APIURL = value
	case "api-key":
		cfg.APIKey = value
	case "environment":
		cfg.Environment = value
	default:
		fmt.Fprintf(os.Stderr, "Unknown config key: %s\n", key)
		fmt.Fprintln(os.Stderr, "Valid keys: api-url, api-key, environment")
		os.Exit(1)
	}

	if err := SaveConfig(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "Error saving config: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Set %s = %s\n", key, value)
}

func configGet(args []string) {
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "Usage: pfctl config get <key>")
		os.Exit(1)
	}

	cfg := LoadConfig()
	key := args[0]

	switch key {
	case "api-url":
		fmt.Println(cfg.APIURL)
	case "api-key":
		if cfg.APIKey == "" {
			fmt.Println("(not set)")
		} else {
			// Mask the key for security
			if len(cfg.APIKey) > 8 {
				fmt.Printf("%s...%s\n", cfg.APIKey[:4], cfg.APIKey[len(cfg.APIKey)-4:])
			} else {
				fmt.Println("****")
			}
		}
	case "environment":
		fmt.Println(cfg.Environment)
	default:
		fmt.Fprintf(os.Stderr, "Unknown config key: %s\n", key)
		os.Exit(1)
	}
}

func configShow() {
	cfg := LoadConfig()
	maskedKey := "(not set)"
	if cfg.APIKey != "" {
		if len(cfg.APIKey) > 8 {
			maskedKey = cfg.APIKey[:4] + "..." + cfg.APIKey[len(cfg.APIKey)-4:]
		} else {
			maskedKey = "****"
		}
	}

	fmt.Printf("API URL:     %s\n", cfg.APIURL)
	fmt.Printf("API Key:     %s\n", maskedKey)
	fmt.Printf("Environment: %s\n", cfg.Environment)
	fmt.Printf("Config file: %s\n", configPath())
}

func configInit() {
	cfg := CLIConfig{
		APIURL:      "http://localhost:8000",
		Environment: "development",
	}

	if err := SaveConfig(cfg); err != nil {
		fmt.Fprintf(os.Stderr, "Error creating config: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Initialized config at %s\n", configPath())
	fmt.Println("Run 'pfctl config set api-key <your-key>' to authenticate.")
}

func printConfigUsage() {
	fmt.Println(`Usage: pfctl config <subcommand>

Subcommands:
  set <key> <value>   Set a configuration value
  get <key>           Get a configuration value
  show                Show all configuration
  init                Initialize configuration file

Keys:
  api-url       Phase Flag API URL (default: http://localhost:8000)
  api-key       API key for authentication
  environment   Default environment (default: development)`)
}
