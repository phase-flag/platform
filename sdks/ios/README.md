# Phase Flag SDK -- iOS

Official iOS SDK for the Phase Flag feature flagging platform. Provides feature flag evaluation with local caching, background polling, event batching, and server-side evaluation fallback. Built on Foundation's `URLSession` with zero external dependencies.

## Installation

### Swift Package Manager

In Xcode, go to **File > Add Package Dependencies** and enter:

```
https://github.com/phaseflag/sdk-ios.git
```

Or add to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/phaseflag/sdk-ios.git", from: "0.1.0"),
]
```

Then add `"PhaseFlag"` to your target's dependencies.

Supports iOS 15+, macOS 12+, tvOS 15+, watchOS 8+.

## Quick Start

```swift
import PhaseFlag

// Initialize in your AppDelegate or @main App
let config = PhaseFlagConfig(
    baseURL: "https://api.example.com/api/v1",
    apiKey: "your-api-key"
)

let client = PhaseFlagClient(config: config)
client.start()
client.waitUntilReady()

// Evaluate flags anywhere in your app
let ctx = EvaluationContext(userId: "user-123")

if client.getBooleanValue("dark-mode", defaultValue: false, context: ctx) {
    enableDarkMode()
}

let variant = client.getStringValue("onboarding-flow", defaultValue: "control")

// Clean up when the app terminates
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
- Supports iOS, macOS, tvOS, and watchOS

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/ios](https://docs.phaseflag.dev/sdks/ios)

## License

Apache 2.0
