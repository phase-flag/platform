# Java SDK Quickstart

## Install

### Maven

```xml
<dependency>
  <groupId>dev.phaseflag</groupId>
  <artifactId>sdk-java</artifactId>
  <version>0.1.0</version>
</dependency>
```

### Gradle

```kotlin
implementation("dev.phaseflag:sdk-java:0.1.0")
```

## Initialize

```java
import dev.phaseflag.PhaseFlagClient;
import dev.phaseflag.PhaseFlagConfig;

PhaseFlagClient client = new PhaseFlagClient(
    PhaseFlagConfig.builder()
        .apiKey("sdk-dev-xxxxxxxxxxxx")
        .environment("production")
        .build()
);
client.initialize();
```

## Evaluate a Flag

```java
import dev.phaseflag.EvaluationContext;

EvaluationContext context = EvaluationContext.builder()
    .userKey("user-123")
    .build();

boolean enabled = client.evaluateFlag("new-checkout-flow", context, Boolean.class);

if (enabled) {
    renderNewCheckout();
}
```

## User Targeting

```java
EvaluationContext context = EvaluationContext.builder()
    .userKey("user-123")
    .attribute("email", "alice@example.com")
    .attribute("plan", "pro")
    .attribute("country", "US")
    .build();

boolean enabled = client.evaluateFlag("beta-feature", context, Boolean.class);
```

## Multivariate Flags

```java
// String flag
String theme = client.evaluateFlag("ui-theme", context, String.class);

// Number flag
Double limit = client.evaluateFlag("rate-limit", context, Double.class);

// JSON flag
Map<String, Object> config = client.evaluateFlag(
    "checkout-config", context,
    new TypeReference<Map<String, Object>>() {}
);
```

## Cleanup

```java
// AutoCloseable — use with try-with-resources
try (PhaseFlagClient client = new PhaseFlagClient(config)) {
    client.initialize();
    // use client
}

// Or via shutdown hook
Runtime.getRuntime().addShutdownHook(new Thread(client::close));
```

## Further Reading

See the [full Java SDK guide](https://docs.phaseflag.io/sdks/java) for Spring Boot integration, Kotlin usage, and evaluation detail.
