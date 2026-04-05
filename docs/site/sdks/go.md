---
title: "Go SDK"
description: "Integrate Phase Flag into your Go application — goroutine-safe local evaluation, background polling, and event batching."
---

# Go SDK

## Installation

```bash
go get github.com/phaseflag/go-sdk
```

**Requires Go 1.21+**

---

## Initialization

```go
package main

import (
    "log"
    "time"

    phaseflag "github.com/phaseflag/go-sdk"
)

func main() {
    client := phaseflag.NewClient(phaseflag.Config{
        BaseURL:         "https://api.phaseflag.com/api/v1", // including /api/v1
        APIKey:          "sdk-dev-xxxxxxxxxxxx",
        PollingInterval: 30 * time.Second,                  // default: 30s
    })

    // Fetch the initial ruleset and start background goroutines
    if err := client.Start(); err != nil {
        log.Fatalf("failed to start Phase Flag client: %v", err)
    }
    defer client.Stop()

    // Block until the first ruleset fetch completes (or timeout)
    if !client.WaitUntilReady(5 * time.Second) {
        log.Println("warning: Phase Flag client did not become ready in time")
    }
}
```

All `Get*` methods are safe to call from multiple goroutines without additional synchronization.

---

## Evaluating Flags

### Boolean flag

```go
ctx := &phaseflag.EvaluationContext{
    UserID: "user-123",
}

// Returns false if flag is off, not found, or not a bool
enabled := client.GetBooleanValue("new-checkout-flow", false, ctx)

if enabled {
    renderNewCheckout(w, r)
} else {
    renderLegacyCheckout(w, r)
}
```

### String flag

```go
theme := client.GetStringValue("ui-theme", "light", ctx)
// Returns "dark", "light", or "system"
applyTheme(theme)
```

### JSON flag

```go
config := client.GetJsonValue("checkout-config", map[string]interface{}{
    "provider": "stripe",
}, ctx)

// Type-assert as needed
if configMap, ok := config.(map[string]interface{}); ok {
    fmt.Println(configMap["provider"]) // "stripe"
}
```

### Full evaluation result

```go
result := client.GetVariation("new-checkout-flow", ctx)
if result != nil {
    fmt.Printf("Value:        %v\n", result.Value)
    fmt.Printf("Reason:       %s\n", result.Reason)
    fmt.Printf("VariationKey: %s\n", result.VariationKey)
}
```

---

## EvaluationContext

```go
ctx := &phaseflag.EvaluationContext{
    UserID:    "user-123",   // used for deterministic percentage bucketing
    SessionID: "sess-abc",   // fallback when UserID is empty
    Attributes: map[string]interface{}{
        "email":       "alice@example.com",
        "plan":        "pro",
        "country":     "US",
        "app_version": "2.4.1",
        "account_age": 365,
    },
}
```

Attribute values can be `string`, `int`, `float64`, or `bool`.

---

## Concurrent-Safe Usage

```go
var wg sync.WaitGroup

for i := 0; i < 1000; i++ {
    wg.Add(1)
    go func(userID string) {
        defer wg.Done()
        evalCtx := &phaseflag.EvaluationContext{UserID: userID}
        enabled := client.GetBooleanValue("feature-x", false, evalCtx)
        _ = enabled
    }(fmt.Sprintf("user-%d", i))
}

wg.Wait()
```

---

## HTTP Middleware Integration

```go
func FeatureFlagMiddleware(client *phaseflag.Client) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            userID := r.Header.Get("X-User-ID")

            evalCtx := &phaseflag.EvaluationContext{
                UserID: userID,
                Attributes: map[string]interface{}{
                    "country": r.Header.Get("CF-IPCountry"),
                    "plan":    r.Header.Get("X-User-Plan"),
                },
            }

            enabled := client.GetBooleanValue("new-api-handler", false, evalCtx)

            ctx := context.WithValue(r.Context(), "newAPIEnabled", enabled)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

---

## Listen for Flag Changes

Register a callback that fires whenever the ruleset is updated after a poll:

```go
unsubscribe := client.OnFlagsChanged(func(flags []phaseflag.FlagDefinition) {
    fmt.Printf("Ruleset updated: %d flags loaded\n", len(flags))
    // Re-evaluate and update application state
})

// Remove the listener when no longer needed
unsubscribe()
```

---

## Remote Evaluation

Evaluate a flag server-side (sends the context to the API):

```go
result, err := client.Evaluate("new-checkout-flow", &phaseflag.EvaluationContext{
    UserID: "user-123",
})
if err != nil {
    log.Printf("remote evaluation error: %v", err)
}

fmt.Printf("Value:  %v\n", result.Value)
fmt.Printf("Reason: %s\n", result.Reason)
```

---

## Flag Mocking (Testing)

Override flag values in tests without connecting to the API:

```go
// Empty BaseURL disables HTTP — safe for unit tests
client := phaseflag.NewClient(phaseflag.Config{})

client.SetOverride("new-checkout-flow", true)

enabled := client.GetBooleanValue("new-checkout-flow", false, nil)
// enabled == true

client.ClearOverride("new-checkout-flow")
client.ClearAllOverrides()
```

---

## Bootstrap Loading

Load flags from a file or URL for cold-start resilience:

```go
// From a local file
client := phaseflag.NewClient(phaseflag.Config{
    BaseURL:       "https://api.phaseflag.com/api/v1",
    APIKey:        "sdk-dev-xxxxxxxxxxxx",
    BootstrapFile: "/etc/phaseflag/bootstrap.json",
})

// From a URL
client := phaseflag.NewClient(phaseflag.Config{
    BaseURL:      "https://api.phaseflag.com/api/v1",
    APIKey:       "sdk-dev-xxxxxxxxxxxx",
    BootstrapURL: "https://cdn.example.com/flags/bootstrap.json",
})
```

---

## Offline Mode

```go
client := phaseflag.NewClient(phaseflag.Config{
    BaseURL:       "https://api.phaseflag.com/api/v1",
    APIKey:        "sdk-dev-xxxxxxxxxxxx",
    OfflineMode:   true,
    BootstrapFile: "/etc/phaseflag/bootstrap.json",
})
client.Start()
// If the API is unreachable, the client uses bootstrap data and becomes
// ready immediately.
```

---

## Event Tracking

```go
client.TrackEvent(phaseflag.EvaluationEvent{
    FlagKey:      "new-checkout-flow",
    VariationKey: "enabled",
    UserID:       "user-123",
})

// Flush all queued events immediately
if err := client.FlushEvents(); err != nil {
    log.Printf("flush error: %v", err)
}
```

---

## Configuration Reference

```go
phaseflag.Config{
    BaseURL:            "https://api.phaseflag.com/api/v1", // required (including /api/v1)
    APIKey:             "sdk-dev-xxxxxxxxxxxx",            // required
    PollingInterval:    30 * time.Second,                  // optional, default: 30s
    EventFlushInterval: 30 * time.Second,                  // optional, default: 30s
    EventBatchSize:     100,                               // optional, default: 100
    BootstrapFile:      "/path/to/bootstrap.json",         // optional
    BootstrapURL:       "https://cdn.example.com/b.json",  // optional
    OfflineMode:        false,                             // optional
}
```

---

## Graceful Shutdown

```go
sigCh := make(chan os.Signal, 1)
signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
<-sigCh

// Stop blocks until background goroutines exit and events are flushed
client.Stop()
```
