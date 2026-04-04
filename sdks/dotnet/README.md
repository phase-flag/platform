# Phase Flag SDK -- .NET

Official C#/.NET SDK for the Phase Flag feature flagging platform. Provides feature flag evaluation with local caching, background polling, event batching, and server-side evaluation fallback.

## Installation

```bash
dotnet add package PhaseFlag.Sdk
```

Requires .NET 8.0+.

## Quick Start

```csharp
using PhaseFlag;
using PhaseFlag.Models;

var config = new PhaseFlagConfig(
    baseUrl: "https://api.example.com/api/v1",
    apiKey: "your-api-key"
);

using var client = new PhaseFlagClient(config);
await client.StartAsync();
await client.WaitUntilReadyAsync(TimeSpan.FromSeconds(5));

var ctx = new EvaluationContext
{
    UserId = "user-123",
    Attributes = new Dictionary<string, object> { ["plan"] = "pro" }
};

if (client.GetBooleanValue("dark-mode", false, ctx))
{
    EnableDarkMode();
}

string variant = client.GetStringValue("checkout-flow", "control", ctx);
var pricing = client.GetJsonValue<PricingConfig>("pricing", defaultPricing, ctx);
```

## API Reference

### `PhaseFlagClient`

#### Lifecycle

- `PhaseFlagClient(PhaseFlagConfig config)`
- `StartAsync(CancellationToken ct = default) -> Task` -- Fetch ruleset and start polling.
- `Stop()` -- Stop timers and flush remaining events.
- `WaitUntilReadyAsync(TimeSpan timeout, CancellationToken ct = default) -> Task<bool>`
- `IsReady -> bool`
- `Dispose()` -- Implements `IDisposable`.

#### Local Evaluation

- `GetBooleanValue(string flagKey, bool defaultValue, EvaluationContext? ctx = null) -> bool`
- `GetStringValue(string flagKey, string defaultValue, EvaluationContext? ctx = null) -> string`
- `GetJsonValue<T>(string flagKey, T defaultValue, EvaluationContext? ctx = null) -> T`
- `GetVariation(string flagKey, EvaluationContext? ctx = null) -> EvaluationResult?`
- `GetAllFlags() -> IReadOnlyList<FlagDefinition>`

#### Remote Evaluation

- `EvaluateAsync(string flagKey, EvaluationContext? ctx = null, CancellationToken ct = default) -> Task<EvaluationResult>`

#### Event Tracking

- `TrackEvent(EvaluationEvent evt)`
- `FlushEventsAsync() -> Task`

#### Change Listeners

- `OnFlagsChanged(Action<IReadOnlyList<FlagDefinition>> listener) -> Action` -- Returns an unsubscribe action.

## Features

- Local evaluation (<1ms) with DJB2 deterministic hashing
- Async-first API with background timer-based polling
- Batched event tracking with auto-flush
- Thread-safe -- all methods safe for concurrent use
- `IDisposable` support for clean resource management
- System.Text.Json serialization
- Zero external dependencies

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/dotnet](https://docs.phaseflag.dev/sdks/dotnet)

## License

Apache 2.0
