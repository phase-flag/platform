package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"
)

var (
	cache      *RulesetCache
	cfg        RelayConfig
	eventMu    sync.Mutex
	eventBuf   []json.RawMessage
	startTime  time.Time
	pollCount  int64
	evalCount  int64
)

func main() {
	cfg = LoadRelayConfig()
	cache = NewRulesetCache(cfg.CacheTTL, cfg.MaxCacheEntries)
	eventBuf = make([]json.RawMessage, 0, cfg.EventBufferSize)
	startTime = time.Now()

	log.Printf("Phase Flag Relay starting on %s", cfg.ListenAddr)
	log.Printf("Upstream: %s", cfg.ControlPlaneURL)
	log.Printf("Poll interval: %s, Cache TTL: %s", cfg.PollInterval, cfg.CacheTTL)

	// Initial fetch
	refreshRuleset("default")

	// Background polling
	go pollLoop()

	// Background event flushing
	go eventFlushLoop()

	// HTTP routes
	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/ready", handleReady)
	mux.HandleFunc("/relay/ruleset", handleRuleset)
	mux.HandleFunc("/relay/evaluate", handleEvaluate)
	mux.HandleFunc("/relay/evaluate/batch", handleBatchEvaluate)
	mux.HandleFunc("/relay/events", handleEvents)
	mux.HandleFunc("/relay/stats", handleStats)

	server := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Fatal(server.ListenAndServe())
}

// --- Polling ---

func pollLoop() {
	ticker := time.NewTicker(cfg.PollInterval)
	defer ticker.Stop()

	for range ticker.C {
		refreshRuleset("default")
		pollCount++
	}
}

func refreshRuleset(env string) {
	url := fmt.Sprintf("%s/api/v1/sdk/ruleset", cfg.ControlPlaneURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.Printf("Error creating ruleset request: %v", err)
		return
	}

	req.Header.Set("Accept", "application/json")
	if cfg.APIKey != "" {
		req.Header.Set("X-API-Key", cfg.APIKey)
	}

	// Conditional fetch with ETag
	etag := cache.GetETag(env)
	if etag != "" {
		req.Header.Set("If-None-Match", etag)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error fetching ruleset: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotModified {
		// Ruleset unchanged, update the fetch timestamp
		entry := cache.Get(env)
		if entry != nil {
			cache.Set(env, entry.Data, entry.ETag)
		}
		if cfg.LogLevel == "debug" {
			log.Printf("Ruleset unchanged (304)")
		}
		return
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Error response from control plane: HTTP %d: %s", resp.StatusCode, string(body))
		return
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading ruleset response: %v", err)
		return
	}

	newETag := resp.Header.Get("ETag")
	cache.Set(env, data, newETag)

	if cfg.LogLevel == "debug" {
		log.Printf("Ruleset refreshed (ETag: %s, size: %d bytes)", newETag, len(data))
	}
}

// --- HTTP Handlers ---

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "ok",
		"service": "phaseflag-relay",
		"uptime":  time.Since(startTime).String(),
	})
}

func handleReady(w http.ResponseWriter, r *http.Request) {
	entry := cache.Get("default")
	if entry == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"status": "not_ready",
			"reason": "no cached ruleset",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func handleRuleset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	env := r.URL.Query().Get("environment")
	if env == "" {
		env = "default"
	}

	entry := cache.GetFresh(env)
	if entry == nil {
		// Try stale data
		entry = cache.Get(env)
		if entry == nil {
			// No data at all, try fetching
			refreshRuleset(env)
			entry = cache.Get(env)
			if entry == nil {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{
					"error": "ruleset not available",
				})
				return
			}
		}
		w.Header().Set("X-PhaseFlag-Cache", "stale")
	} else {
		w.Header().Set("X-PhaseFlag-Cache", "hit")
	}

	if entry.ETag != "" {
		w.Header().Set("ETag", entry.ETag)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-PhaseFlag-Cached-At", entry.FetchedAt.UTC().Format(time.RFC3339))
	w.WriteHeader(http.StatusOK)
	w.Write(entry.Data)
}

func handleEvaluate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		FlagKey     string                 `json:"flag_key"`
		Context     map[string]interface{} `json:"context"`
		Environment string                 `json:"environment"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	env := req.Environment
	if env == "" {
		env = "default"
	}

	entry := cache.Get(env)
	if entry == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "ruleset not available"})
		return
	}

	rs, err := ParseRuleset(entry.Data)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "invalid cached ruleset"})
		return
	}

	flag := FindFlag(rs, req.FlagKey)
	if flag == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "flag not found"})
		return
	}

	result := Evaluate(*flag, req.Context)
	evalCount++

	writeJSON(w, http.StatusOK, result)
}

func handleBatchEvaluate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		FlagKeys    []string               `json:"flag_keys"`
		Context     map[string]interface{} `json:"context"`
		Environment string                 `json:"environment"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	env := req.Environment
	if env == "" {
		env = "default"
	}

	entry := cache.Get(env)
	if entry == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "ruleset not available"})
		return
	}

	rs, err := ParseRuleset(entry.Data)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "invalid cached ruleset"})
		return
	}

	results := make(map[string]EvaluationResult)

	if len(req.FlagKeys) == 0 {
		// Evaluate all flags
		results = EvaluateAll(rs, req.Context)
	} else {
		for _, key := range req.FlagKeys {
			flag := FindFlag(rs, key)
			if flag != nil {
				results[key] = Evaluate(*flag, req.Context)
			}
		}
	}

	evalCount += int64(len(results))
	writeJSON(w, http.StatusOK, results)
}

func handleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot read body"})
		return
	}

	// Accept either a single event or an array
	var events []json.RawMessage
	if err := json.Unmarshal(body, &events); err != nil {
		// Single event
		events = []json.RawMessage{body}
	}

	eventMu.Lock()
	for _, evt := range events {
		if len(eventBuf) < cfg.EventBufferSize {
			eventBuf = append(eventBuf, evt)
		}
	}
	eventMu.Unlock()

	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"accepted": len(events),
	})
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	eventMu.Lock()
	buffered := len(eventBuf)
	eventMu.Unlock()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"uptime":          time.Since(startTime).String(),
		"poll_count":      pollCount,
		"eval_count":      evalCount,
		"events_buffered": buffered,
		"cache":           cache.Stats(),
	})
}

// --- Event flushing ---

func eventFlushLoop() {
	ticker := time.NewTicker(cfg.EventFlushInterval)
	defer ticker.Stop()

	for range ticker.C {
		flushEvents()
	}
}

func flushEvents() {
	eventMu.Lock()
	if len(eventBuf) == 0 {
		eventMu.Unlock()
		return
	}
	toSend := make([]json.RawMessage, len(eventBuf))
	copy(toSend, eventBuf)
	eventBuf = eventBuf[:0]
	eventMu.Unlock()

	payload, err := json.Marshal(toSend)
	if err != nil {
		log.Printf("Error marshaling events: %v", err)
		return
	}

	url := fmt.Sprintf("%s/api/v1/sdk/events", cfg.ControlPlaneURL)
	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		log.Printf("Error creating events request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	if cfg.APIKey != "" {
		req.Header.Set("X-API-Key", cfg.APIKey)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error forwarding events: %v", err)
		// Re-buffer events
		eventMu.Lock()
		remaining := cfg.EventBufferSize - len(eventBuf)
		if remaining > 0 {
			if len(toSend) > remaining {
				toSend = toSend[:remaining]
			}
			eventBuf = append(toSend, eventBuf...)
		}
		eventMu.Unlock()
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Error response forwarding events: HTTP %d: %s", resp.StatusCode, string(body))
	} else if cfg.LogLevel == "debug" {
		log.Printf("Flushed %d events to control plane", len(toSend))
	}
}

// --- Helpers ---

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
