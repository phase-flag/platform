# Phase Flag SDK -- Android

Official Android/Kotlin SDK for the Phase Flag feature flagging platform. Provides feature flag evaluation with local caching, background polling, event batching, and server-side evaluation fallback.

## Installation

### Gradle (Kotlin DSL)

```kotlin
dependencies {
    implementation("dev.phaseflag:sdk-android:0.1.0")
}
```

### Gradle (Groovy)

```groovy
implementation 'dev.phaseflag:sdk-android:0.1.0'
```

Requires JVM 17+ (Kotlin 1.9+). Dependencies: Gson, OkHttp.

## Quick Start

```kotlin
import dev.phaseflag.sdk.PhaseFlagClient
import dev.phaseflag.sdk.PhaseFlagConfig
import dev.phaseflag.sdk.EvaluationContext

val client = PhaseFlagClient(
    PhaseFlagConfig(
        baseUrl = "https://api.example.com/api/v1",
        apiKey = "your-api-key"
    )
)
client.start()
client.waitUntilReady(5000)

val ctx = EvaluationContext(userId = "user-123")

if (client.getBooleanValue("dark-mode", false, ctx)) {
    enableDarkMode()
}

val variant = client.getStringValue("onboarding-flow", "control", ctx)

client.stop()
```

## API Reference

### `PhaseFlagClient`

#### Lifecycle

- `PhaseFlagClient(config: PhaseFlagConfig)`
- `start()` -- Fetch ruleset and start background polling.
- `stop()` -- Shut down scheduler and flush remaining events.
- `waitUntilReady(timeoutMs: Long) -> Boolean`
- `isReady() -> Boolean`

#### Local Evaluation

- `getBooleanValue(flagKey: String, defaultValue: Boolean, ctx: EvaluationContext? = null) -> Boolean`
- `getStringValue(flagKey: String, defaultValue: String, ctx: EvaluationContext? = null) -> String`
- `getJsonValue<T>(flagKey: String, defaultValue: T, ctx: EvaluationContext? = null) -> T`
- `getVariation(flagKey: String, ctx: EvaluationContext? = null) -> EvaluationResult?`
- `getAllFlags() -> List<FlagDefinition>`

#### Event Tracking

- `trackEvent(event: EvaluationEvent)`
- `flushEvents()`

#### Testing

- `setOverride(flagKey: String, value: Any?)`
- `clearOverride(flagKey: String)`
- `clearAllOverrides()`

#### Change Listeners

- `onFlagsChanged(listener: (List<FlagDefinition>) -> Unit) -> () -> Unit` -- Returns an unsubscribe function.

## Features

- Local evaluation (<1ms) with DJB2 deterministic hashing
- Background polling via ScheduledExecutorService
- Batched event tracking with auto-flush
- Thread-safe -- all methods safe for concurrent use
- Flag mocking for testing (no server required)
- OkHttp for efficient networking

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/android](https://docs.phaseflag.dev/sdks/android)

## License

Apache 2.0
