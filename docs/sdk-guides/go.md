# Go SDK Quickstart

## Install

```bash
go get github.com/phaseflag/go-sdk
```

## Initialize

```go
package main

import (
    "context"
    "log"

    phaseflag "github.com/phaseflag/go-sdk"
)

func main() {
    client, err := phaseflag.NewClient(phaseflag.Config{
        APIKey:      "sdk-dev-xxxxxxxxxxxx",
        Environment: "production",
    })
    if err != nil {
        log.Fatal(err)
    }
    defer client.Close()

    if err := client.Initialize(context.Background()); err != nil {
        log.Fatal(err)
    }
}
```

## Evaluate a Flag

```go
evalCtx := phaseflag.EvaluationContext{
    UserKey: "user-123",
}

// Using typed helper
enabled, err := phaseflag.EvaluateBool(ctx, client, "my-flag", evalCtx)
if err != nil {
    log.Printf("evaluation error: %v", err)
}

if enabled {
    // new code path
}
```

## User Targeting

```go
evalCtx := phaseflag.EvaluationContext{
    UserKey: "user-123",
    Attributes: map[string]interface{}{
        "email":   "alice@example.com",
        "plan":    "pro",
        "country": "US",
    },
}

enabled, _ := phaseflag.EvaluateBool(ctx, client, "beta-feature", evalCtx)
```

## Typed Helpers

```go
// Boolean
enabled, _ := phaseflag.EvaluateBool(ctx, client, "my-bool-flag", evalCtx)

// String
theme, _ := phaseflag.EvaluateString(ctx, client, "ui-theme", evalCtx)

// Float
limit, _ := phaseflag.EvaluateFloat(ctx, client, "rate-limit", evalCtx)

// JSON (unmarshals into target struct)
var cfg MyConfig
_ = phaseflag.EvaluateJSON(ctx, client, "checkout-config", evalCtx, &cfg)
```

## Concurrent-Safe

The client is safe to use from multiple goroutines without additional synchronization.

```go
var wg sync.WaitGroup
for i := 0; i < 1000; i++ {
    wg.Add(1)
    go func(id int) {
        defer wg.Done()
        evalCtx := phaseflag.EvaluationContext{UserKey: fmt.Sprintf("user-%d", id)}
        phaseflag.EvaluateBool(ctx, client, "my-flag", evalCtx)
    }(i)
}
wg.Wait()
```

## Further Reading

See the [full Go SDK guide](https://docs.phaseflag.io/sdks/go) for HTTP middleware integration, graceful shutdown, and more.
