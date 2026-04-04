---
title: "Go SDK"
description: "Integrate Phase Flag into your Go application with a concurrency-safe, zero-allocation evaluation path."
---

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
    "context"
    "log"
    "time"

    phaseflag "github.com/phaseflag/go-sdk"
)

func main() {
    client, err := phaseflag.NewClient(phaseflag.Config{
        APIKey:          "sdk-dev-xxxxxxxxxxxx",
        Environment:     "production",
        BaseURL:         "https://api.phaseflag.io", // optional
        PollingInterval: 30 * time.Second,            // optional, default: 30s
    })
    if err != nil {
        log.Fatalf("failed to create Phase Flag client: %v", err)
    }
    defer client.Close()

    // Wait for the initial ruleset to load
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    if err := client.Initialize(ctx); err != nil {
        log.Fatalf("failed to initialize: %v", err)
    }
}
```

---

## Evaluating Flags

All `EvaluateFlag` calls are safe to call from multiple goroutines without additional synchronization.

### Boolean Flag

```go
evalCtx := phaseflag.EvaluationContext{
    UserKey: "user-123",
}

result, err := client.EvaluateFlag(ctx, "new-checkout-flow", evalCtx)
if err != nil {
    log.Printf("evaluation error: %v", err)
}

if enabled, ok := result.(bool); ok && enabled {
    renderNewCheckout(w, r)
} else {
    renderLegacyCheckout(w, r)
}
```

### Typed Helpers

Use the typed helper functions to avoid type assertions:

```go
// Boolean
enabled, err := phaseflag.EvaluateBool(ctx, client, "my-bool-flag", evalCtx)

// String
theme, err := phaseflag.EvaluateString(ctx, client, "ui-theme", evalCtx)

// Float64
limit, err := phaseflag.EvaluateFloat(ctx, client, "rate-limit", evalCtx)

// JSON (unmarshals into a target struct)
var config CheckoutConfig
err := phaseflag.EvaluateJSON(ctx, client, "checkout-config", evalCtx, &config)
```

---

## EvaluationContext

```go
evalCtx := phaseflag.EvaluationContext{
    UserKey: "user-123",  // required — used for deterministic percentage bucketing
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

## Evaluation with Detail

```go
detail, err := client.EvaluateFlagWithDetail(ctx, "new-checkout-flow", evalCtx)
if err != nil {
    log.Printf("error: %v", err)
}

fmt.Printf("Value:        %v\n", detail.Value)
fmt.Printf("Reason:       %s\n", detail.Reason)
fmt.Printf("Rule ID:      %s\n", detail.RuleID)
fmt.Printf("Variation:    %s\n", detail.VariationKey)
```

Possible `Reason` values:

| Reason | Description |
|--------|-------------|
| `TARGETING_RULE` | A targeting rule matched the context |
| `PERCENTAGE_ROLLOUT` | Assigned by percentage rollout |
| `DEFAULT` | No rule matched; default variation served |
| `DISABLED` | Flag is inactive or archived |
| `PREREQUISITE` | A prerequisite flag was not satisfied |

---

## Concurrent-Safe Usage

The client uses a `sync.RWMutex` internally to protect the ruleset cache. All public methods are safe to call from concurrent goroutines:

```go
var wg sync.WaitGroup

for i := 0; i < 1000; i++ {
    wg.Add(1)
    go func(userID string) {
        defer wg.Done()
        evalCtx := phaseflag.EvaluationContext{UserKey: userID}
        enabled, _ := phaseflag.EvaluateBool(context.Background(), client, "feature-x", evalCtx)
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

            evalCtx := phaseflag.EvaluationContext{
                UserKey: userID,
                Attributes: map[string]interface{}{
                    "country": r.Header.Get("CF-IPCountry"),
                },
            }

            enabled, _ := phaseflag.EvaluateBool(r.Context(), client, "new-api-handler", evalCtx)

            ctx := context.WithValue(r.Context(), "newAPIEnabled", enabled)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

---

## Configuration Reference

```go
phaseflag.Config{
    APIKey:          "sdk-dev-xxxxxxxxxxxx",     // required
    Environment:     "production",               // required
    BaseURL:         "https://api.phaseflag.io", // optional
    PollingInterval: 30 * time.Second,            // optional, default: 30s
    HTTPTimeout:     5 * time.Second,             // optional, default: 5s
    Logger:          myLogger,                    // optional, implements phaseflag.Logger
}
```

---

## Graceful Shutdown

```go
sigCh := make(chan os.Signal, 1)
signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
<-sigCh

shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()

if err := client.Shutdown(shutdownCtx); err != nil {
    log.Printf("shutdown error: %v", err)
}
```
