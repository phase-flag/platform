# Go SDK Quickstart

## Installation

```bash
go get github.com/phaseflag/sdk-go
```

## Initialization

```go
package main

import (
    "context"
    "log"

    phaseflag "github.com/phaseflag/sdk-go"
)

func main() {
    client, err := phaseflag.NewClient(phaseflag.Config{
        APIKey:          "pf_env_your_api_key",
        APIURL:          "https://api.phaseflag.dev",
        PollingInterval: 30, // seconds
        Context: map[string]interface{}{
            "user_id": "user-123",
            "plan":    "pro",
        },
    })
    if err != nil {
        log.Fatalf("Failed to initialize Phase Flag: %v", err)
    }
    defer client.Close()

    // Wait for initial data
    client.WaitForInitialization(context.Background())
}
```

## Evaluating Flags

### Boolean Flags

```go
enabled := client.GetBooleanValue("new-checkout", false)
if enabled {
    showNewCheckout()
} else {
    showLegacyCheckout()
}
```

### String Flags

```go
theme := client.GetStringValue("theme-color", "blue")
```

### Number Flags

```go
rateLimit := client.GetFloat64Value("api-rate-limit", 100.0)
```

### JSON Flags

```go
var config DashboardConfig
err := client.GetJSONValue("dashboard-config", &config, defaultConfig)
```

### Full Evaluation Detail

```go
detail := client.GetEvaluationDetail("new-checkout")
fmt.Println(detail.Value)        // true
fmt.Println(detail.VariationKey) // "enabled"
fmt.Println(detail.Reason)       // "targeting_match"
```

## Per-Request Context

```go
// Override context for a single evaluation
ctx := map[string]interface{}{
    "user_id": "user-456",
    "plan":    "enterprise",
    "country": "US",
}
enabled := client.GetBooleanValueWithContext("new-checkout", false, ctx)
```

## HTTP Middleware

```go
import (
    "net/http"
    phaseflag "github.com/phaseflag/sdk-go"
    pfmiddleware "github.com/phaseflag/sdk-go/middleware"
)

func main() {
    client, _ := phaseflag.NewClient(config)
    defer client.Close()

    mux := http.NewServeMux()
    mux.HandleFunc("/checkout", func(w http.ResponseWriter, r *http.Request) {
        ctx := pfmiddleware.ContextFromRequest(r)
        if client.GetBooleanValueWithContext("new-checkout", false, ctx) {
            serveNewCheckout(w, r)
        } else {
            serveLegacyCheckout(w, r)
        }
    })

    handler := pfmiddleware.Middleware(client)(mux)
    http.ListenAndServe(":8080", handler)
}
```

## Offline Mode

```go
import "os"

bootstrapData, _ := os.ReadFile("phaseflag-bootstrap.json")

client, _ := phaseflag.NewClient(phaseflag.Config{
    APIKey:          "pf_env_...",
    BootstrapData:   bootstrapData,
    OfflineFallback: true,
})
```

## Testing

```go
import "github.com/phaseflag/sdk-go/testing"

func TestFeature(t *testing.T) {
    client := pftest.NewTestClient(map[string]interface{}{
        "new-checkout": true,
        "theme-color":  "dark",
    })

    if !client.GetBooleanValue("new-checkout", false) {
        t.Error("expected new-checkout to be enabled")
    }
}
```

## Event Listeners

```go
client.OnFlagsUpdated(func() {
    log.Println("Flags updated")
})

client.OnError(func(err error) {
    log.Printf("Phase Flag error: %v", err)
})
```

## Cleanup

```go
client.Close()
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `APIKey` | string | required | Environment API key |
| `APIURL` | string | `https://api.phaseflag.dev` | API base URL |
| `PollingInterval` | int | `30` | Polling interval (seconds) |
| `Context` | map | `nil` | Default evaluation context |
| `BootstrapData` | []byte | `nil` | Pre-loaded flag data |
| `OfflineFallback` | bool | `false` | Use defaults when unreachable |
| `Logger` | Logger | stdlib | Custom logger |
| `HTTPClient` | *http.Client | default | Custom HTTP client |
