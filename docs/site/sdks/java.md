---
title: "Java SDK"
description: "Integrate Phase Flag into your Java or Kotlin application."
---

## Installation

### Maven

```xml
<dependency>
  <groupId>dev.phaseflag</groupId>
  <artifactId>sdk-java</artifactId>
  <version>0.1.0</version>
</dependency>
```

### Gradle (Kotlin DSL)

```kotlin
dependencies {
    implementation("dev.phaseflag:sdk-java:0.1.0")
}
```

### Gradle (Groovy)

```groovy
dependencies {
    implementation 'dev.phaseflag:sdk-java:0.1.0'
}
```

**Requires Java 11+**

---

## Initialization

```java
import dev.phaseflag.PhaseFlagClient;
import dev.phaseflag.PhaseFlagConfig;

PhaseFlagConfig config = PhaseFlagConfig.builder()
    .apiKey("sdk-dev-xxxxxxxxxxxx")
    .environment("production")
    .baseUrl("https://api.phaseflag.io")  // optional
    .pollingIntervalSeconds(30)            // optional, default: 30
    .httpTimeoutSeconds(5)                 // optional, default: 5
    .build();

PhaseFlagClient client = new PhaseFlagClient(config);

// Blocks until the initial ruleset is loaded (or throws on failure)
client.initialize();
```

<Note>
  `initialize()` performs a blocking HTTP call to fetch the ruleset. Call it once during your application startup, not per-request.
</Note>

---

## Evaluating Flags

### Boolean Flag

```java
import dev.phaseflag.EvaluationContext;

EvaluationContext context = EvaluationContext.builder()
    .userKey("user-123")
    .build();

boolean enabled = client.evaluateFlag("new-checkout-flow", context, Boolean.class);

if (enabled) {
    renderNewCheckout();
} else {
    renderLegacyCheckout();
}
```

### String Flag

```java
String theme = client.evaluateFlag("ui-theme", context, String.class);
// Returns "dark", "light", or "system"
applyTheme(theme);
```

### Number Flag

```java
Double rateLimit = client.evaluateFlag("api-rate-limit", context, Double.class);
// Returns e.g. 100.0, 500.0
configureRateLimiter(rateLimit.intValue());
```

### JSON Flag

```java
import com.fasterxml.jackson.core.type.TypeReference;

Map<String, Object> config = client.evaluateFlag(
    "checkout-config",
    context,
    new TypeReference<Map<String, Object>>() {}
);

String provider = (String) config.get("provider"); // "stripe"
```

---

## EvaluationContext

```java
import dev.phaseflag.EvaluationContext;

EvaluationContext context = EvaluationContext.builder()
    .userKey("user-123")                        // required
    .attribute("email", "alice@example.com")
    .attribute("plan", "pro")
    .attribute("country", "US")
    .attribute("appVersion", "2.4.1")
    .attribute("accountAge", 365)
    .build();
```

Attributes support `String`, `Integer`, `Long`, `Double`, and `Boolean` values.

---

## Evaluation with Detail

```java
import dev.phaseflag.EvaluationResult;

EvaluationResult<Boolean> result = client.evaluateFlagWithDetail(
    "new-checkout-flow",
    context,
    Boolean.class
);

System.out.println("Value:     " + result.getValue());        // true
System.out.println("Reason:    " + result.getReason());       // "TARGETING_RULE"
System.out.println("Rule ID:   " + result.getRuleId());       // "rule_abc123"
System.out.println("Variation: " + result.getVariationKey()); // "enabled"
```

---

## Spring Boot Integration

```java
import dev.phaseflag.PhaseFlagClient;
import dev.phaseflag.PhaseFlagConfig;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PhaseFlagAutoConfiguration {

    @Bean
    public PhaseFlagClient phaseFlagClient() {
        PhaseFlagConfig config = PhaseFlagConfig.builder()
            .apiKey(System.getenv("PHASEFLAG_SDK_KEY"))
            .environment(System.getenv("PHASEFLAG_ENVIRONMENT"))
            .build();

        PhaseFlagClient client = new PhaseFlagClient(config);
        client.initialize();
        return client;
    }
}
```

```java
@RestController
public class CheckoutController {

    private final PhaseFlagClient flagClient;

    public CheckoutController(PhaseFlagClient flagClient) {
        this.flagClient = flagClient;
    }

    @GetMapping("/checkout")
    public ResponseEntity<String> checkout(@RequestHeader("X-User-Id") String userId) {
        EvaluationContext context = EvaluationContext.builder()
            .userKey(userId)
            .build();

        boolean useNewFlow = flagClient.evaluateFlag("new-checkout-flow", context, Boolean.class);

        return ResponseEntity.ok(useNewFlow ? "new" : "legacy");
    }
}
```

---

## Kotlin Usage

The Java SDK works seamlessly in Kotlin:

```kotlin
import dev.phaseflag.PhaseFlagClient
import dev.phaseflag.PhaseFlagConfig
import dev.phaseflag.EvaluationContext

val client = PhaseFlagClient(
    PhaseFlagConfig.builder()
        .apiKey("sdk-dev-xxxxxxxxxxxx")
        .environment("production")
        .build()
).also { it.initialize() }

val context = EvaluationContext.builder()
    .userKey("user-123")
    .attribute("plan", "pro")
    .build()

val enabled: Boolean = client.evaluateFlag("new-feature", context, Boolean::class.java)
```

---

## Shutdown / Cleanup

Always close the client during application shutdown to flush pending evaluation events:

```java
// Java 7+ try-with-resources — PhaseFlagClient implements AutoCloseable
try (PhaseFlagClient client = new PhaseFlagClient(config)) {
    client.initialize();
    // ... use client
}

// Manual shutdown
Runtime.getRuntime().addShutdownHook(new Thread(() -> {
    client.close();
}));
```

---

## Configuration Reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `apiKey` | String | required | SDK API key |
| `environment` | String | required | Target environment |
| `baseUrl` | String | `https://api.phaseflag.io` | Control plane URL |
| `pollingIntervalSeconds` | int | `30` | Ruleset refresh interval |
| `httpTimeoutSeconds` | int | `5` | HTTP request timeout |
| `connectTimeoutSeconds` | int | `3` | Connection timeout |
