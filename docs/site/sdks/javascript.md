---
title: "JavaScript / TypeScript SDK"
description: "Integrate Phase Flag into your JavaScript or TypeScript application — local evaluation, polling, streaming, and flag mocking."
---

# JavaScript / TypeScript SDK

## Installation

```bash
npm install @phaseflag/js-sdk
# or
yarn add @phaseflag/js-sdk
# or
pnpm add @phaseflag/js-sdk
```

---

## Initialization

```typescript
import { PhaseFlagClient } from "@phaseflag/js-sdk";

const client = new PhaseFlagClient({
  apiUrl: "https://api.phaseflag.com/api/v1",  // your API URL (including /api/v1)
  apiKey: "sdk-dev-xxxxxxxxxxxx",              // SDK API key from project settings
  pollingInterval: 30_000,                     // ms between ruleset fetches (default: 30s)
  context: {                                   // optional default evaluation context
    userId: "user-123",
    attributes: { plan: "pro" },
  },
});

// Fetch the initial ruleset and start background polling
await client.start();
```

> Call `start()` once at application startup. The client fetches the full ruleset and caches it in memory. All subsequent `getBooleanValue` / `getStringValue` calls are **synchronous** with no network overhead.

### Convenience factory

```typescript
import { createClient } from "@phaseflag/js-sdk";

// Creates and starts the client in one call
const client = await createClient({
  apiUrl: "https://api.phaseflag.com/api/v1",
  apiKey: "sdk-dev-xxxxxxxxxxxx",
});
```

---

## Evaluating Flags

### Boolean flag

```typescript
// Returns the boolean value of the flag, or `false` if not found
const isEnabled = client.getBooleanValue("new-checkout-flow", false);

if (isEnabled) {
  renderNewCheckout();
} else {
  renderLegacyCheckout();
}
```

### String flag

```typescript
const theme = client.getStringValue("ui-theme", "light");
// Returns "dark" | "light" | "system", falling back to "light"
applyTheme(theme);
```

### JSON flag

```typescript
interface CheckoutConfig {
  showPromoCode: boolean;
  maxItems: number;
  provider: "stripe" | "braintree";
}

const config = client.getJsonValue<CheckoutConfig>("checkout-config", {
  showPromoCode: false,
  maxItems: 10,
  provider: "stripe",
});

console.log(config.provider); // "stripe"
```

### Full evaluation result

```typescript
const result = client.getVariation("new-checkout-flow");

if (result) {
  console.log(result.value);        // true
  console.log(result.reason);       // "targeting_match" | "percentage_rollout" | "default"
  console.log(result.variationKey); // "enabled"
}
```

---

## Evaluation Context

Pass a per-call context to override the default context:

```typescript
import type { EvaluationContext } from "@phaseflag/js-sdk";

const context: EvaluationContext = {
  userId: "user-123",           // used for percentage rollout bucketing
  sessionId: "sess-abc",        // fallback when userId is unavailable
  attributes: {
    email: "alice@example.com",
    plan: "pro",
    country: "US",
    appVersion: "2.4.1",
    accountAge: 365,
  },
};

const enabled = client.getBooleanValue("beta-feature", false, context);
```

Attributes can be **strings**, **numbers**, or **booleans**. They are matched against targeting rules configured in the dashboard.

### Update the default context

When a user logs in or their attributes change, update the default context:

```typescript
client.setContext({
  userId: loggedInUser.id,
  attributes: {
    plan: loggedInUser.plan,
    email: loggedInUser.email,
  },
});
```

---

## Percentage Rollouts

Percentage rollouts are handled automatically using DJB2 hashing on `{flagKey}:{userId}`. The same user always lands in the same bucket — no additional configuration in your code:

```typescript
// User "user-123" will consistently get the same variation for "gradual-rollout"
const theme = client.getStringValue("gradual-rollout", "control");
// Returns "control" or "treatment" based on the configured percentages
```

---

## Background Polling

The SDK polls the control plane every 30 seconds for ruleset updates by default. Configure the interval in milliseconds:

```typescript
const client = new PhaseFlagClient({
  apiUrl: "https://api.phaseflag.com/api/v1",
  apiKey: "sdk-dev-xxxxxxxxxxxx",
  pollingInterval: 60_000, // poll every 60 seconds
});
```

To disable polling (useful for short-lived processes):

```typescript
const client = new PhaseFlagClient({
  apiUrl: "https://api.phaseflag.com/api/v1",
  apiKey: "sdk-dev-xxxxxxxxxxxx",
  pollingInterval: 0, // fetch once at start(), never poll again
});
```

---

## Listen for Flag Changes

Register a listener that fires whenever the ruleset is updated after a poll:

```typescript
const unsubscribe = client.onFlagsChanged((flags) => {
  console.log(`Ruleset updated: ${flags.size} flags loaded`);
  // Re-evaluate flags and update your UI here
});

// Remove the listener when no longer needed
unsubscribe();
```

---

## Wait Until Ready

If you need to ensure the client has fetched the initial ruleset before evaluating:

```typescript
await client.start();
await client.waitUntilReady();

// Safe to evaluate — ruleset is loaded
const enabled = client.getBooleanValue("my-flag", false);
```

---

## Offline Mode and Bootstrap

For resilience against API downtime, provide bootstrap data and enable offline mode:

```typescript
const client = new PhaseFlagClient({
  apiUrl: "https://api.phaseflag.com/api/v1",
  apiKey: "sdk-dev-xxxxxxxxxxxx",
  offlineMode: true,
  bootstrapUrl: "/api/v1/sdk/bootstrap", // fetch initial state from your own server
});
```

---

## Flag Mocking (Testing)

Override flag values in tests without connecting to the API:

```typescript
// In your test setup
const client = new PhaseFlagClient({ apiUrl: "", apiKey: "" });
client.setOverride("new-checkout-flow", true);

// client.getBooleanValue now returns true without any network calls
expect(client.getBooleanValue("new-checkout-flow", false)).toBe(true);

// Clear overrides when done
client.clearOverride("new-checkout-flow");
client.clearAllOverrides();
```

---

## TypeScript Types

```typescript
import type {
  PhaseFlagConfig,
  EvaluationContext,
  EvaluationResult,
  FlagDefinition,
  Variation,
} from "@phaseflag/js-sdk";

// EvaluationContext
interface EvaluationContext {
  userId?: string;
  sessionId?: string;
  attributes?: Record<string, unknown>;
}

// EvaluationResult — returned by getVariation()
interface EvaluationResult {
  flagKey: string;
  variationId: string | null;
  variationKey: string | null;
  value: unknown;
  reason: string; // "targeting_match" | "percentage_rollout" | "default" | "override"
}
```

---

## Remote Evaluation

For server-side evaluation where the SDK doesn't have context locally:

```typescript
const result = await client.evaluateRemote("new-checkout-flow", {
  userId: "user-123",
  attributes: { plan: "enterprise" },
});

console.log(result.value);  // true
console.log(result.reason); // "targeting_match"
```

---

## Event Tracking

The SDK automatically tracks evaluation events. For custom analytics events:

```typescript
client.trackEvent({
  flagKey: "new-checkout-flow",
  variationKey: "enabled",
  userId: "user-123",
  metadata: { page: "checkout", experiment: "v2" },
});

// Flush all queued events immediately
await client.flushEvents();
```

---

## Cleanup

For server-side applications, stop polling and flush events on shutdown:

```typescript
process.on("SIGTERM", () => {
  client.stop(); // stops polling, flushes remaining events
  process.exit(0);
});
```
