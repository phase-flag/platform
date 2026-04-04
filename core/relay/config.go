package main

import (
	"os"
	"strconv"
	"time"
)

// RelayConfig holds configuration for the relay proxy.
type RelayConfig struct {
	// ListenAddr is the address the relay listens on.
	ListenAddr string

	// ControlPlaneURL is the Phase Flag API base URL.
	ControlPlaneURL string

	// APIKey is the SDK/API key for authenticating with the control plane.
	APIKey string

	// PollInterval is how often to refresh the ruleset from the control plane.
	PollInterval time.Duration

	// CacheTTL is the maximum age of cached data before it is considered stale.
	CacheTTL time.Duration

	// MaxCacheEntries limits the number of cached rulesets (per environment).
	MaxCacheEntries int

	// EventBufferSize is the max number of events to buffer before forwarding.
	EventBufferSize int

	// EventFlushInterval is how often to flush buffered events to the control plane.
	EventFlushInterval time.Duration

	// LogLevel controls logging verbosity: debug, info, warn, error.
	LogLevel string
}

// LoadRelayConfig reads configuration from environment variables with defaults.
func LoadRelayConfig() RelayConfig {
	cfg := RelayConfig{
		ListenAddr:         envOrDefault("PHASEFLAG_RELAY_LISTEN", ":8081"),
		ControlPlaneURL:    envOrDefault("PHASEFLAG_RELAY_UPSTREAM", "http://localhost:8000"),
		APIKey:             envOrDefault("PHASEFLAG_RELAY_API_KEY", ""),
		PollInterval:       envDurationOrDefault("PHASEFLAG_RELAY_POLL_INTERVAL", 30*time.Second),
		CacheTTL:           envDurationOrDefault("PHASEFLAG_RELAY_CACHE_TTL", 5*time.Minute),
		MaxCacheEntries:    envIntOrDefault("PHASEFLAG_RELAY_MAX_CACHE", 100),
		EventBufferSize:    envIntOrDefault("PHASEFLAG_RELAY_EVENT_BUFFER", 1000),
		EventFlushInterval: envDurationOrDefault("PHASEFLAG_RELAY_EVENT_FLUSH", 10*time.Second),
		LogLevel:           envOrDefault("PHASEFLAG_RELAY_LOG_LEVEL", "info"),
	}
	return cfg
}

func envOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func envIntOrDefault(key string, defaultVal int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return defaultVal
}

func envDurationOrDefault(key string, defaultVal time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
		// Try as seconds
		if n, err := strconv.Atoi(v); err == nil {
			return time.Duration(n) * time.Second
		}
	}
	return defaultVal
}
