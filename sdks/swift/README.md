# Phase Flag SDK -- Swift

Official Swift SDK for the Phase Flag feature flagging platform. Provides feature flag evaluation with local caching, background polling, event batching, and server-side evaluation fallback. Built on Foundation's `URLSession` with zero external dependencies.

## Installation

### Swift Package Manager

Add to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/phaseflag/sdk-swift.git", from: "0.1.0"),
]
```

Then add `"PhaseFlag"` to your target's dependencies.

Supports macOS 12+, iOS 15+, tvOS 15+, watchOS 8+.

## Quick Start

```swift
import PhaseFlag

let config = PhaseFlagConfig(
    baseURL: "https://api.example.com/api/v1",
    apiKey: "your-api-key"
)

let client = PhaseFlagClient(config: config)
client.start()
client.waitUntilReady()

let ctx = EvaluationContext(userId: "user-123")

if client.getBooleanValue("dark-mode", defaultValue: false, context: ctx) {
    enableDarkMode()
}

let variant = client.getStringValue("checkout-flow", defaultValue: "control")

client.stop()
```

## API Reference

### `PhaseFlagClient`

#### Lifecycle

- `init(config: PhaseFlagConfig)`
- `start()` -- Fetch ruleset and begin background polling.
- `stop()` -- Stop timers and flush remaining events.
- `waitUntilReady(timeout: TimeInterval = 10) -> Bool`
- `isReady: Bool`

#### Local Evaluation

- `getBooleanValue(_ flagKey: String, defaultValue: Bool, context: EvaluationContext? = nil) -> Bool`
- `getStringValue(_ flagKey: String, defaultValue: String, context: EvaluationContext? = nil) -> String`
- `getJsonValue<T: Decodable>(_ flagKey: String, defaultValue: T, context: EvaluationContext? = nil) -> T`
- `getVariation(_ flagKey: String, context: EvaluationContext? = nil) -> EvaluationResult?`
- `getAllFlags() -> [FlagDefinition]`

#### Remote Evaluation

- `evaluate(_ flagKey: String, context: EvaluationContext? = nil) async throws -> EvaluationResult`

#### Event Tracking

- `trackEvent(_ event: EvaluationEvent)`
- `flushEvents()`

#### Change Listeners

- `onFlagsChanged(_ listener: @escaping FlagChangeListener) -> () -> Void` -- Returns an unsubscribe closure.

## Features

- Local evaluation (<1ms) with DJB2 deterministic hashing
- Background polling via GCD timers
- Batched event tracking with auto-flush
- Thread-safe via DispatchQueue synchronization
- Async/await support for remote evaluation
- Zero external dependencies (Foundation only)

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/swift](https://docs.phaseflag.dev/sdks/swift)

## License

Apache 2.0
