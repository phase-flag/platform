# Phase Flag SDK -- Go

Official Go SDK for the Phase Flag feature flagging platform. Provides feature flag evaluation with local caching, background polling, event batching, bootstrap loading, offline mode, and flag mocking. All methods are safe for concurrent use.

## Installation

```bash
go get github.com/phaseflag/go-sdk
```

Requires Go 1.21+.

## Quick Start

```go
package main

import (
    "fmt"
    "time"

    phaseflag "github.com/phaseflag/go-sdk"
)

func main() {
    client := phaseflag.NewClient(phaseflag.Config{
        BaseURL: "https://api.example.com/api/v1",
        APIKey:  "your-api-key",
    })

    if err := client.Start(); err != nil {
        panic(err)
    }
    defer client.Stop()

    client.WaitUntilReady(5 * time.Second)

    ctx := &phaseflag.EvaluationContext{
        UserID:     "user-123",
        Attributes: map[string]interface{}{"plan": "pro"},
    }

    if client.GetBooleanValue("dark-mode", false, ctx) {
        fmt.Println("Dark mode enabled")
    }

    variant := client.GetStringValue("checkout-flow", "control", ctx)
    fmt.Println("Checkout variant:", variant)
}
```

## API Reference

### `Config`

| Field | Type | Default | Description |
|---|---|---|---|
| `BaseURL` | `string` | required | Base URL of the Phase Flag API |
| `APIKey` | `string` | required | API key for authentication |
| `PollingInterval` | `time.Duration` | `30s` | Interval between ruleset polls |
| `EventFlushInterval` | `time.Duration` | `30s` | Interval between event flushes |
| `EventBatchSize` | `int` | `100` | Max events before auto-flush |
| `BootstrapFile` | `string` | `""` | Path to local bootstrap JSON file |
| `BootstrapURL` | `string` | `""` | URL to fetch bootstrap data from |
| `OfflineMode` | `bool` | `false` | Use cached/bootstrapped data when API is unreachable |

### `Client`

#### Lifecycle

- `NewClient(config Config) *Client`
- `Start() error` -- Fetch ruleset and start background goroutines.
- `Stop()` -- Stop goroutines and flush remaining events.
- `WaitUntilReady(timeout time.Duration) bool`
- `IsReady() bool`

#### Local Evaluation

- `GetBooleanValue(flagKey string, defaultValue bool, ctx *EvaluationContext) bool`
- `GetStringValue(flagKey string, defaultValue string, ctx *EvaluationContext) string`
- `GetJsonValue(flagKey string, defaultValue interface{}, ctx *EvaluationContext) interface{}`
- `GetVariation(flagKey string, ctx *EvaluationContext) *EvaluationResult`
- `GetAllFlags() []FlagDefinition`

#### Remote Evaluation

- `Evaluate(flagKey string, ctx *EvaluationContext) (*EvaluationResult, error)`

#### Event Tracking

- `TrackEvent(event EvaluationEvent)`
- `FlushEvents() error`

#### Testing

- `SetOverride(flagKey string, value interface{})`
- `ClearOverride(flagKey string)`
- `ClearAllOverrides()`

#### Change Listeners

- `OnFlagsChanged(listener func([]FlagDefinition)) func()` -- Returns an unsubscribe function.

## Features

- Local evaluation (<1ms) with DJB2 deterministic hashing
- Background polling via goroutines
- Offline mode with bootstrap files
- Batched event tracking with auto-flush
- Goroutine-safe -- all methods safe for concurrent use
- Flag mocking for testing (no server required)
- Zero external dependencies (stdlib only)

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/go](https://docs.phaseflag.dev/sdks/go)

## License

Apache 2.0
