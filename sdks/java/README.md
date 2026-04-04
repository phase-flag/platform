# Phase Flag SDK -- Java

Official Java SDK for the Phase Flag feature flagging platform. Provides feature flag evaluation with local caching, background polling, event batching, and server-side evaluation fallback. Zero external dependencies -- uses only `java.net.http` and `java.util`.

## Installation

### Maven

```xml
<dependency>
    <groupId>dev.phaseflag</groupId>
    <artifactId>sdk-java</artifactId>
    <version>0.1.0</version>
</dependency>
```

### Gradle

```groovy
implementation 'dev.phaseflag:sdk-java:0.1.0'
```

Requires Java 11+.

## Quick Start

```java
import dev.phaseflag.sdk.PhaseFlagClient;
import dev.phaseflag.sdk.PhaseFlagConfig;
import dev.phaseflag.sdk.models.EvaluationContext;

import java.time.Duration;

public class Main {
    public static void main(String[] args) {
        PhaseFlagConfig config = PhaseFlagConfig.builder()
            .baseUrl("https://api.example.com/api/v1")
            .apiKey("your-api-key")
            .build();

        PhaseFlagClient client = new PhaseFlagClient(config);
        client.start();
        client.waitUntilReady(Duration.ofSeconds(5));

        EvaluationContext ctx = EvaluationContext.builder()
            .userId("user-123")
            .attribute("plan", "pro")
            .build();

        boolean darkMode = client.getBooleanValue("dark-mode", false, ctx);
        String variant = client.getStringValue("checkout-flow", "control", ctx);

        client.stop();
    }
}
```

## API Reference

### `PhaseFlagClient`

#### Lifecycle

- `PhaseFlagClient(PhaseFlagConfig config)`
- `start()` -- Fetch ruleset and start background polling.
- `stop()` -- Shut down background tasks and flush remaining events.
- `waitUntilReady(Duration timeout) -> boolean`
- `isReady() -> boolean`

#### Local Evaluation

- `getBooleanValue(String flagKey, boolean defaultValue, EvaluationContext ctx) -> boolean`
- `getStringValue(String flagKey, String defaultValue, EvaluationContext ctx) -> String`
- `getJsonValue(String flagKey, T defaultValue, EvaluationContext ctx) -> T`
- `getVariation(String flagKey, EvaluationContext ctx) -> Optional<EvaluationResult>`
- `getAllFlags() -> List<FlagDefinition>`

#### Remote Evaluation

- `evaluate(String flagKey, EvaluationContext ctx) -> EvaluationResult`

#### Event Tracking

- `trackEvent(EvaluationEvent event)`
- `flushEvents()`

#### Change Listeners

- `onFlagsChanged(Consumer<List<FlagDefinition>> listener) -> Runnable` -- Returns an unsubscribe runnable.

## Features

- Local evaluation (<1ms) with DJB2 deterministic hashing
- Background polling via ScheduledExecutorService
- Batched event tracking with auto-flush
- Thread-safe -- all methods safe for concurrent use
- Zero external dependencies (java.net.http only)
- Java 11+ compatible

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/java](https://docs.phaseflag.dev/sdks/java)

## License

Apache 2.0
