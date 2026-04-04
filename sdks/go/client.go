package phaseflag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Config holds the settings used to create a Phase Flag Client.
type Config struct {
	// BaseURL is the API server URL (e.g. "https://api.example.com/api/v1").
	BaseURL string

	// APIKey is the authentication key sent via the X-API-Key header.
	APIKey string

	// PollingInterval is how often the client fetches the ruleset in the
	// background. Defaults to 30 seconds when zero.
	PollingInterval time.Duration

	// EventFlushInterval is how often queued events are flushed
	// automatically. Defaults to 30 seconds when zero.
	EventFlushInterval time.Duration

	// EventBatchSize is the maximum number of queued events before an
	// automatic flush is triggered. Defaults to 100 when zero.
	EventBatchSize int

	// BootstrapFile is the path to a local JSON file containing bootstrap
	// flag data. The file should have the same format as the /sdk/ruleset
	// response: {"flags": [...]}.
	BootstrapFile string

	// BootstrapURL is a URL to fetch bootstrap data from before the first
	// ruleset fetch. Useful for loading from a CDN or the
	// /api/v1/sdk/bootstrap endpoint.
	BootstrapURL string

	// OfflineMode when true causes the client to use cached/bootstrapped
	// data when the API is unreachable, instead of returning errors.
	OfflineMode bool
}

// defaults fills in zero-value fields with sensible defaults.
func (c *Config) defaults() {
	if c.PollingInterval == 0 {
		c.PollingInterval = 30 * time.Second
	}
	if c.EventFlushInterval == 0 {
		c.EventFlushInterval = 30 * time.Second
	}
	if c.EventBatchSize == 0 {
		c.EventBatchSize = 100
	}
	c.BaseURL = strings.TrimRight(c.BaseURL, "/")
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

// Client is the main entry point for the Phase Flag Go SDK. It provides
// local feature flag evaluation with background polling, server-side
// evaluation fallback, event batching, bootstrap loading, offline mode,
// flag mocking, and change listeners.
//
// All methods are safe for concurrent use.
type Client struct {
	config Config
	http   *http.Client

	// Flag store.
	mu    sync.RWMutex
	flags map[string]FlagDefinition

	// Flag overrides for testing.
	overrideMu sync.RWMutex
	overrides  map[string]interface{}

	// Readiness.
	ready     bool
	readyCh   chan struct{}
	readyOnce sync.Once

	// Change listeners.
	listenersMu sync.RWMutex
	listeners   map[int]func([]FlagDefinition)
	listenerSeq int

	// Event queue.
	eventMu    sync.Mutex
	eventQueue []EvaluationEvent

	// Lifecycle.
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewClient creates a new Phase Flag client with the given configuration.
// Call Start to begin background polling and event flushing.
func NewClient(config Config) *Client {
	config.defaults()
	return &Client{
		config:    config,
		http:      &http.Client{Timeout: 10 * time.Second},
		flags:     make(map[string]FlagDefinition),
		overrides: make(map[string]interface{}),
		readyCh:   make(chan struct{}),
		listeners: make(map[int]func([]FlagDefinition)),
	}
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

// Start loads bootstrap data (if configured), fetches the initial ruleset
// synchronously, then spawns background goroutines for periodic polling
// and event flushing.
func (c *Client) Start() error {
	// Load bootstrap data first
	c.loadBootstrap()

	// First fetch is synchronous so callers know when the client is ready.
	if err := c.fetchRuleset(); err != nil {
		if c.config.OfflineMode {
			log.Printf("phaseflag: initial ruleset fetch failed (offline mode, using %d bootstrapped flags): %v", len(c.flags), err)
			// Mark ready with bootstrap data
			c.readyOnce.Do(func() {
				c.mu.Lock()
				c.ready = true
				c.mu.Unlock()
				close(c.readyCh)
			})
		} else {
			log.Printf("phaseflag: initial ruleset fetch failed: %v", err)
			// We do not return an error here -- the client will keep retrying
			// in the background and stale/empty flags are acceptable.
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	c.cancel = cancel

	// Background polling goroutine.
	c.wg.Add(1)
	go func() {
		defer c.wg.Done()
		c.pollingLoop(ctx)
	}()

	// Background event flushing goroutine.
	c.wg.Add(1)
	go func() {
		defer c.wg.Done()
		c.flushLoop(ctx)
	}()

	return nil
}

// Stop stops background goroutines and flushes any remaining events. It
// blocks until all goroutines have exited and the final flush completes.
func (c *Client) Stop() {
	if c.cancel != nil {
		c.cancel()
	}
	c.wg.Wait()

	// Final flush -- best effort.
	if err := c.FlushEvents(); err != nil {
		log.Printf("phaseflag: final event flush failed: %v", err)
	}
}

// WaitUntilReady blocks until the first successful ruleset fetch or until
// timeout elapses. Returns true if the client became ready, false on
// timeout.
func (c *Client) WaitUntilReady(timeout time.Duration) bool {
	select {
	case <-c.readyCh:
		return true
	case <-time.After(timeout):
		return false
	}
}

// IsReady reports whether the client has completed at least one successful
// ruleset fetch.
func (c *Client) IsReady() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.ready
}

// ---------------------------------------------------------------------------
// Flag mocking (test support)
// ---------------------------------------------------------------------------

// SetOverride sets a flag override for testing. When an override is set,
// the client returns the override value instead of evaluating the flag
// normally. No server connection is required.
func (c *Client) SetOverride(flagKey string, value interface{}) {
	c.overrideMu.Lock()
	c.overrides[flagKey] = value
	c.overrideMu.Unlock()
}

// ClearOverride removes a single flag override.
func (c *Client) ClearOverride(flagKey string) {
	c.overrideMu.Lock()
	delete(c.overrides, flagKey)
	c.overrideMu.Unlock()
}

// ClearAllOverrides removes all flag overrides.
func (c *Client) ClearAllOverrides() {
	c.overrideMu.Lock()
	c.overrides = make(map[string]interface{})
	c.overrideMu.Unlock()
}

// ---------------------------------------------------------------------------
// Local flag evaluation
// ---------------------------------------------------------------------------

// GetBooleanValue evaluates a boolean flag locally. Returns defaultValue
// if the flag is not found, is not active, or the resolved value is not a
// bool. Overrides take precedence over normal evaluation.
func (c *Client) GetBooleanValue(flagKey string, defaultValue bool, ctx *EvaluationContext) bool {
	// Check overrides first
	c.overrideMu.RLock()
	if v, ok := c.overrides[flagKey]; ok {
		c.overrideMu.RUnlock()
		b, ok := v.(bool)
		if !ok {
			return defaultValue
		}
		return b
	}
	c.overrideMu.RUnlock()

	result := c.resolve(flagKey, ctx)
	if result == nil {
		return defaultValue
	}
	b, ok := result.Value.(bool)
	if !ok {
		return defaultValue
	}
	return b
}

// GetStringValue evaluates a string flag locally. Returns defaultValue if
// the flag is not found, is not active, or the resolved value is not a
// string. Overrides take precedence over normal evaluation.
func (c *Client) GetStringValue(flagKey string, defaultValue string, ctx *EvaluationContext) string {
	c.overrideMu.RLock()
	if v, ok := c.overrides[flagKey]; ok {
		c.overrideMu.RUnlock()
		s, ok := v.(string)
		if !ok {
			return defaultValue
		}
		return s
	}
	c.overrideMu.RUnlock()

	result := c.resolve(flagKey, ctx)
	if result == nil {
		return defaultValue
	}
	s, ok := result.Value.(string)
	if !ok {
		return defaultValue
	}
	return s
}

// GetJsonValue evaluates a JSON (arbitrary) flag locally. Returns
// defaultValue if the flag is not found or is not active. Overrides take
// precedence over normal evaluation.
func (c *Client) GetJsonValue(flagKey string, defaultValue interface{}, ctx *EvaluationContext) interface{} {
	c.overrideMu.RLock()
	if v, ok := c.overrides[flagKey]; ok {
		c.overrideMu.RUnlock()
		return v
	}
	c.overrideMu.RUnlock()

	result := c.resolve(flagKey, ctx)
	if result == nil {
		return defaultValue
	}
	return result.Value
}

// GetVariation returns the full evaluation result for a flag, or nil if
// the flag is not found. Overrides take precedence.
func (c *Client) GetVariation(flagKey string, ctx *EvaluationContext) *EvaluationResult {
	c.overrideMu.RLock()
	if v, ok := c.overrides[flagKey]; ok {
		c.overrideMu.RUnlock()
		return &EvaluationResult{
			FlagKey: flagKey,
			Value:   v,
			Reason:  "override",
		}
	}
	c.overrideMu.RUnlock()

	return c.resolve(flagKey, ctx)
}

// GetAllFlags returns a copy of all currently loaded flag definitions.
func (c *Client) GetAllFlags() []FlagDefinition {
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make([]FlagDefinition, 0, len(c.flags))
	for _, f := range c.flags {
		out = append(out, f)
	}
	return out
}

// ---------------------------------------------------------------------------
// Remote evaluation
// ---------------------------------------------------------------------------

// Evaluate performs a remote server-side flag evaluation via POST /evaluate.
// This is useful when targeting rules require server-side data that the
// SDK does not have locally.
func (c *Client) Evaluate(flagKey string, ctx *EvaluationContext) (*EvaluationResult, error) {
	if ctx == nil {
		ctx = &EvaluationContext{}
	}

	payload := map[string]interface{}{
		"flag_key": flagKey,
		"context": map[string]interface{}{
			"user_id":    ctx.UserID,
			"session_id": ctx.SessionID,
			"attributes": ctx.Attributes,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("phaseflag: marshal evaluate request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.config.BaseURL+"/evaluate", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("phaseflag: create evaluate request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.config.APIKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("phaseflag: evaluate request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("phaseflag: read evaluate response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("phaseflag: evaluate returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var data struct {
		FlagKey      string      `json:"flag_key"`
		VariationID  string      `json:"variation_id"`
		VariationKey string      `json:"variation_key"`
		Value        interface{} `json:"value"`
		Reason       string      `json:"reason"`
	}
	if err := json.Unmarshal(respBody, &data); err != nil {
		return nil, fmt.Errorf("phaseflag: decode evaluate response: %w", err)
	}

	return &EvaluationResult{
		FlagKey:      data.FlagKey,
		VariationID:  data.VariationID,
		VariationKey: data.VariationKey,
		Value:        data.Value,
		Reason:       data.Reason,
	}, nil
}

// ---------------------------------------------------------------------------
// Event tracking
// ---------------------------------------------------------------------------

// TrackEvent queues an evaluation event for batched submission. Events
// are flushed automatically on a periodic interval, when the batch size
// threshold is reached, or when Stop is called.
func (c *Client) TrackEvent(event EvaluationEvent) {
	flushNow := false

	c.eventMu.Lock()
	c.eventQueue = append(c.eventQueue, event)
	if len(c.eventQueue) >= c.config.EventBatchSize {
		flushNow = true
	}
	c.eventMu.Unlock()

	if flushNow {
		if err := c.FlushEvents(); err != nil {
			log.Printf("phaseflag: auto-flush events failed: %v", err)
		}
	}
}

// FlushEvents sends all queued events to POST /sdk/events immediately.
// On failure the events are re-enqueued so they are not lost.
func (c *Client) FlushEvents() error {
	c.eventMu.Lock()
	if len(c.eventQueue) == 0 {
		c.eventMu.Unlock()
		return nil
	}
	batch := make([]EvaluationEvent, len(c.eventQueue))
	copy(batch, c.eventQueue)
	c.eventQueue = c.eventQueue[:0]
	c.eventMu.Unlock()

	payload := map[string]interface{}{
		"events": batch,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		c.reenqueue(batch)
		return fmt.Errorf("phaseflag: marshal events: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.config.BaseURL+"/sdk/events", bytes.NewReader(body))
	if err != nil {
		c.reenqueue(batch)
		return fmt.Errorf("phaseflag: create events request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.config.APIKey)

	resp, err := c.http.Do(req)
	if err != nil {
		c.reenqueue(batch)
		return fmt.Errorf("phaseflag: events request failed: %w", err)
	}
	defer resp.Body.Close()

	// Drain body to allow connection reuse.
	_, _ = io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		c.reenqueue(batch)
		return fmt.Errorf("phaseflag: events returned status %d", resp.StatusCode)
	}

	return nil
}

// reenqueue prepends a batch of events back onto the event queue.
func (c *Client) reenqueue(batch []EvaluationEvent) {
	c.eventMu.Lock()
	c.eventQueue = append(batch, c.eventQueue...)
	c.eventMu.Unlock()
}

// ---------------------------------------------------------------------------
// Change listeners
// ---------------------------------------------------------------------------

// OnFlagsChanged registers a listener that is invoked whenever the flag
// set changes after a poll. The returned function removes the listener
// when called.
func (c *Client) OnFlagsChanged(listener func([]FlagDefinition)) func() {
	c.listenersMu.Lock()
	id := c.listenerSeq
	c.listenerSeq++
	c.listeners[id] = listener
	c.listenersMu.Unlock()

	return func() {
		c.listenersMu.Lock()
		delete(c.listeners, id)
		c.listenersMu.Unlock()
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// resolve performs local evaluation of a flag using the cached ruleset.
func (c *Client) resolve(flagKey string, ctx *EvaluationContext) *EvaluationResult {
	c.mu.RLock()
	flag, ok := c.flags[flagKey]
	c.mu.RUnlock()

	if !ok {
		return nil
	}

	if ctx == nil {
		ctx = &EvaluationContext{}
	}

	return evaluate(flag, ctx)
}

// loadBootstrap loads bootstrap data from the configured file or URL.
func (c *Client) loadBootstrap() {
	// Bootstrap from file takes priority
	if c.config.BootstrapFile != "" {
		data, err := os.ReadFile(c.config.BootstrapFile)
		if err != nil {
			log.Printf("phaseflag: failed to read bootstrap file %s: %v", c.config.BootstrapFile, err)
		} else {
			var rulesetData struct {
				Flags []FlagDefinition `json:"flags"`
			}
			if err := json.Unmarshal(data, &rulesetData); err != nil {
				log.Printf("phaseflag: failed to parse bootstrap file: %v", err)
			} else {
				newFlags := make(map[string]FlagDefinition, len(rulesetData.Flags))
				for _, f := range rulesetData.Flags {
					newFlags[f.Key] = f
				}
				c.mu.Lock()
				c.flags = newFlags
				c.mu.Unlock()
				log.Printf("phaseflag: loaded %d flags from bootstrap file", len(newFlags))
				return
			}
		}
	}

	// Bootstrap from URL
	if c.config.BootstrapURL != "" {
		req, err := http.NewRequest(http.MethodGet, c.config.BootstrapURL, nil)
		if err != nil {
			log.Printf("phaseflag: failed to create bootstrap URL request: %v", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")
		if c.config.APIKey != "" {
			req.Header.Set("X-API-Key", c.config.APIKey)
		}

		resp, err := c.http.Do(req)
		if err != nil {
			log.Printf("phaseflag: failed to fetch bootstrap URL %s: %v", c.config.BootstrapURL, err)
			return
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			log.Printf("phaseflag: failed to read bootstrap URL response: %v", err)
			return
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			log.Printf("phaseflag: bootstrap URL returned status %d", resp.StatusCode)
			return
		}

		var rulesetData struct {
			Flags []FlagDefinition `json:"flags"`
		}
		if err := json.Unmarshal(body, &rulesetData); err != nil {
			log.Printf("phaseflag: failed to parse bootstrap URL response: %v", err)
			return
		}

		newFlags := make(map[string]FlagDefinition, len(rulesetData.Flags))
		for _, f := range rulesetData.Flags {
			newFlags[f.Key] = f
		}
		c.mu.Lock()
		c.flags = newFlags
		c.mu.Unlock()
		log.Printf("phaseflag: loaded %d flags from bootstrap URL", len(newFlags))
	}
}

// fetchRuleset fetches the compiled flag ruleset from GET /sdk/ruleset
// and updates the local flag cache.
func (c *Client) fetchRuleset() error {
	req, err := http.NewRequest(http.MethodGet, c.config.BaseURL+"/sdk/ruleset", nil)
	if err != nil {
		return fmt.Errorf("phaseflag: create ruleset request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.config.APIKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("phaseflag: ruleset request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("phaseflag: read ruleset response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("phaseflag: ruleset returned status %d: %s", resp.StatusCode, string(body))
	}

	var data struct {
		Flags []FlagDefinition `json:"flags"`
	}
	if err := json.Unmarshal(body, &data); err != nil {
		return fmt.Errorf("phaseflag: decode ruleset: %w", err)
	}

	newFlags := make(map[string]FlagDefinition, len(data.Flags))
	for _, f := range data.Flags {
		newFlags[f.Key] = f
	}

	c.mu.Lock()
	c.flags = newFlags
	c.ready = true
	c.mu.Unlock()

	// Signal readiness (only the first time).
	c.readyOnce.Do(func() {
		close(c.readyCh)
	})

	// Notify listeners.
	c.notifyListeners()

	return nil
}

// notifyListeners calls all registered change listeners with a snapshot
// of the current flags.
func (c *Client) notifyListeners() {
	c.listenersMu.RLock()
	snapshot := make([]func([]FlagDefinition), 0, len(c.listeners))
	for _, fn := range c.listeners {
		snapshot = append(snapshot, fn)
	}
	c.listenersMu.RUnlock()

	if len(snapshot) == 0 {
		return
	}

	flags := c.GetAllFlags()
	for _, fn := range snapshot {
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("phaseflag: flag change listener panicked: %v", r)
				}
			}()
			fn(flags)
		}()
	}
}

// pollingLoop periodically fetches the ruleset until the context is cancelled.
func (c *Client) pollingLoop(ctx context.Context) {
	ticker := time.NewTicker(c.config.PollingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := c.fetchRuleset(); err != nil {
				log.Printf("phaseflag: polling fetch failed: %v", err)
			}
		}
	}
}

// flushLoop periodically flushes queued events until the context is cancelled.
func (c *Client) flushLoop(ctx context.Context) {
	ticker := time.NewTicker(c.config.EventFlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := c.FlushEvents(); err != nil {
				log.Printf("phaseflag: periodic event flush failed: %v", err)
			}
		}
	}
}
