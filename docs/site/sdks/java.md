---
title: "Java SDK"
description: "Integrate Phase Flag into your Java or Kotlin application — local evaluation with thread-safe background polling."
---

# Java SDK

## Installation

### Maven

```xml
<dependency>
  <groupId>io.phaseflag</groupId>
  <artifactId>phaseflag-sdk-java</artifactId>
  <version>0.1.0</version>
</dependency>
```

### Gradle (Kotlin DSL)

```kotlin
dependencies {
    implementation("io.phaseflag:phaseflag-sdk-java:0.1.0")
}
```

### Gradle (Groovy)

```groovy
dependencies {
    implementation 'io.phaseflag:phaseflag-sdk-java:0.1.0'
}
```

**Requires Java 11+**

---

## Initialization

```java
import io.phaseflag.PhaseFlagClient;
import io.phaseflag.PhaseFlagConfig;

PhaseFlagConfig config = PhaseFlagConfig.builder()
    .baseUrl("https://api.phaseflag.com/api/v1")  // including /api/v1
    .apiKey("sdk-dev-xxxxxxxxxxxx")
    .pollingIntervalSeconds(30)                   // optional, default: 30
    .eventFlushIntervalSeconds(30)                // optional, default: 30
    .build();

PhaseFlagClient client = new PhaseFlagClient(config);

// Blocks until the initial ruleset is loaded (or throws on timeout)
client.start();
client.waitUntilReady(5); // timeout in seconds
```

> Call `start()` once during application startup, not per-request. All `get*Value` calls are **synchronous** and have no network overhead.

---

## Evaluating Flags

### Boolean flag

```java
import io.phaseflag.EvaluationContext;

EvaluationContext context = EvaluationContext.builder()
    .userId("user-123")
    .build();

// Returns false if flag is off, not found, or not boolean
boolean enabled = client.getBooleanValue("new-checkout-flow", false, context);

if (enabled) {
    renderNewCheckout();
} else {
    renderLegacyCheckout();
}
```

### String flag

```java
String theme = client.getStringValue("ui-theme", "light", context);
// Returns "dark", "light", or "system"
applyTheme(theme);
```

### JSON flag

```java
// Returns a Map<String, Object> for JSON flags
Map<String, Object> config = client.getJsonValue(
    "checkout-config",
    Collections.emptyMap(),
    context
);

String provider = (String) config.get("provider"); // "stripe"
```

### Full evaluation result

```java
import io.phaseflag.EvaluationResult;

EvaluationResult result = client.getVariation("new-checkout-flow", context);
if (result != null) {
    System.out.println("Value:     " + result.getValue());
    System.out.println("Reason:    " + result.getReason());
    System.out.println("Variation: " + result.getVariationKey());
}
```

---

## EvaluationContext

```java
import io.phaseflag.EvaluationContext;

EvaluationContext context = EvaluationContext.builder()
    .userId("user-123")                       // required for percentage rollouts
    .sessionId("sess-abc")                    // fallback when userId is unavailable
    .attribute("email", "alice@example.com")
    .attribute("plan", "pro")
    .attribute("country", "US")
    .attribute("appVersion", "2.4.1")
    .attribute("accountAge", 365)
    .build();
```

Attributes support `String`, `Integer`, `Long`, `Double`, and `Boolean` values.

---

## Spring Boot Integration

```java
// PhaseFlagAutoConfiguration.java
import io.phaseflag.PhaseFlagClient;
import io.phaseflag.PhaseFlagConfig;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PhaseFlagAutoConfiguration {

    @Bean(destroyMethod = "stop")
    public PhaseFlagClient phaseFlagClient() {
        PhaseFlagConfig config = PhaseFlagConfig.builder()
            .baseUrl(System.getenv("PHASEFLAG_API_URL"))
            .apiKey(System.getenv("PHASEFLAG_SDK_KEY"))
            .pollingIntervalSeconds(30)
            .build();

        PhaseFlagClient client = new PhaseFlagClient(config);
        client.start();
        client.waitUntilReady(10);
        return client;
    }
}
```

```java
// CheckoutController.java
@RestController
public class CheckoutController {

    private final PhaseFlagClient flagClient;

    public CheckoutController(PhaseFlagClient flagClient) {
        this.flagClient = flagClient;
    }

    @GetMapping("/checkout")
    public ResponseEntity<String> checkout(
            @RequestHeader("X-User-Id") String userId,
            @RequestHeader(value = "X-User-Plan", defaultValue = "free") String plan) {

        EvaluationContext context = EvaluationContext.builder()
            .userId(userId)
            .attribute("plan", plan)
            .build();

        boolean useNewFlow = flagClient.getBooleanValue(
            "new-checkout-flow", false, context
        );

        return ResponseEntity.ok(useNewFlow ? "new" : "legacy");
    }
}
```

---

## Kotlin Usage

The Java SDK works seamlessly in Kotlin:

```kotlin
import io.phaseflag.PhaseFlagClient
import io.phaseflag.PhaseFlagConfig
import io.phaseflag.EvaluationContext

val client = PhaseFlagClient(
    PhaseFlagConfig.builder()
        .baseUrl("https://api.phaseflag.com/api/v1")
        .apiKey("sdk-dev-xxxxxxxxxxxx")
        .build()
).also {
    it.start()
    it.waitUntilReady(5)
}

val context = EvaluationContext.builder()
    .userId("user-123")
    .attribute("plan", "pro")
    .build()

val enabled: Boolean = client.getBooleanValue("new-feature", false, context)
```

---

## Flag Mocking (Testing)

```java
// Empty baseUrl disables HTTP — safe for unit tests
PhaseFlagConfig testConfig = PhaseFlagConfig.builder()
    .baseUrl("")
    .apiKey("")
    .build();

PhaseFlagClient client = new PhaseFlagClient(testConfig);
client.setOverride("new-checkout-flow", true);

boolean enabled = client.getBooleanValue("new-checkout-flow", false, context);
// enabled == true

client.clearOverride("new-checkout-flow");
client.clearAllOverrides();
```

---

## Shutdown / Cleanup

`PhaseFlagClient` implements `AutoCloseable`. Always close the client on shutdown:

```java
// Java 7+ try-with-resources
try (PhaseFlagClient client = new PhaseFlagClient(config)) {
    client.start();
    client.waitUntilReady(5);
    // ... use client
}
// client.stop() is called automatically

// Manual shutdown hook
Runtime.getRuntime().addShutdownHook(new Thread(() -> {
    client.stop(); // flushes events and stops polling
}));
```

---

## Configuration Reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `baseUrl` | String | required | API base URL (including `/api/v1`) |
| `apiKey` | String | required | SDK API key from project settings |
| `pollingIntervalSeconds` | int | `30` | Ruleset refresh interval |
| `eventFlushIntervalSeconds` | int | `30` | Event flush interval |
| `eventBatchSize` | int | `100` | Max events before auto-flush |
| `offlineMode` | boolean | `false` | Use bootstrap data if API is down |
| `bootstrapFile` | String | — | Path to local bootstrap JSON file |
