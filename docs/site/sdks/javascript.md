---
title: "JavaScript / TypeScript SDK"
description: "Integrate Phase Flag into your JavaScript or TypeScript application."
---

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
  apiKey: "sdk-dev-xxxxxxxxxxxx",   // SDK API key from your project settings
  environment: "development",        // "development" | "staging" | "production"
  baseUrl: "https://api.phaseflag.io", // optional — default shown
  pollingInterval: 30_000,           // optional — ms between ruleset fetches (default: 30s)
  streaming: false,                  // optional — use SSE instead of polling
});

// Wait for the initial ruleset to load before evaluating flags
await client.initialize();
```

<Note>
  Call `initialize()` once at application startup. The client fetches the full ruleset and caches it in memory. Subsequent `evaluateFlag` calls are synchronous and have no network overhead.
</Note>

---

## Evaluating Flags

### Boolean Flag

```typescript
const isEnabled = await client.evaluateFlag<boolean>("new-checkout-flow", {
  userKey: "user-123",
});

if (isEnabled) {
  renderNewCheckout();
} else {
  renderLegacyCheckout();
}
```

### String Flag

```typescript
const theme = await client.evaluateFlag<string>("ui-theme", {
  userKey: "user-123",
});
// Returns "dark" | "light" | "system"
applyTheme(theme);
```

### Number Flag

```typescript
const rateLimit = await client.evaluateFlag<number>("api-rate-limit", {
  userKey: "service-backend",
});
// Returns a number, e.g. 100, 500, 1000
```

### JSON Flag

```typescript
interface CheckoutConfig {
  showPromoCode: boolean;
  maxItems: number;
  provider: "stripe" | "braintree";
}

const config = await client.evaluateFlag<CheckoutConfig>("checkout-config", {
  userKey: "user-123",
});

console.log(config.provider); // "stripe"
```

---

## User Targeting

Pass an `EvaluationContext` with attributes to match targeting rules:

```typescript
import { EvaluationContext } from "@phaseflag/js-sdk";

const context: EvaluationContext = {
  userKey: "user-123",           // required — used for percentage rollout bucketing
  attributes: {
    email: "alice@example.com",
    plan: "pro",
    country: "US",
    appVersion: "2.4.1",
    accountAge: 365,
  },
};

const enabled = await client.evaluateFlag<boolean>("beta-feature", context);
```

Attributes can be **strings**, **numbers**, or **booleans**. They are matched against the targeting rules configured in your dashboard.

---

## Percentage Rollouts

Percentage rollouts are handled automatically by the evaluation engine using DJB2 hashing on `{flagKey}:{userKey}`. The same user always lands in the same bucket — no additional configuration required in your code.

```typescript
// User "user-123" will consistently get the same variation for "gradual-rollout"
const variation = await client.evaluateFlag<string>("gradual-rollout", {
  userKey: "user-123",
});
// Returns "control" or "treatment" based on the configured percentages
```

---

## Background Polling

By default the SDK polls the control plane every 30 seconds for ruleset updates. You can configure the interval:

```typescript
const client = new PhaseFlagClient({
  apiKey: "sdk-dev-xxxxxxxxxxxx",
  environment: "production",
  pollingInterval: 60_000, // poll every 60 seconds
});
```

To disable polling entirely (useful for short-lived processes):

```typescript
const client = new PhaseFlagClient({
  apiKey: "sdk-dev-xxxxxxxxxxxx",
  environment: "production",
  pollingInterval: 0, // fetch once at initialize(), never again
});
```

---

## Streaming Updates (SSE)

For near-instant flag propagation, enable Server-Sent Events:

```typescript
const client = new PhaseFlagClient({
  apiKey: "sdk-dev-xxxxxxxxxxxx",
  environment: "production",
  streaming: true,
});

await client.initialize();

// The client will receive push updates from the control plane
// and update the in-memory ruleset within milliseconds of a flag change
```

<Note>
  SSE streaming requires a persistent HTTP connection. It is recommended for long-lived server processes. Browser clients should use polling or the React SDK's built-in hooks.
</Note>

---

## TypeScript Types

```typescript
import type {
  PhaseFlagClientOptions,
  EvaluationContext,
  FlagValue,
  EvaluationResult,
} from "@phaseflag/js-sdk";

// EvaluationContext
interface EvaluationContext {
  userKey: string;
  attributes?: Record<string, string | number | boolean>;
}

// EvaluationResult — returned by evaluateFlagWithDetail()
interface EvaluationResult<T extends FlagValue = FlagValue> {
  value: T;
  reason: "TARGETING_RULE" | "PERCENTAGE_ROLLOUT" | "DEFAULT" | "DISABLED";
  ruleId?: string;
  variationKey?: string;
}
```

### Get evaluation detail

```typescript
const result = await client.evaluateFlagWithDetail<boolean>(
  "new-checkout-flow",
  { userKey: "user-123" }
);

console.log(result.value);   // true
console.log(result.reason);  // "TARGETING_RULE"
console.log(result.ruleId);  // "rule_abc123"
```

---

## Cleanup

For server-side applications, call `close()` on shutdown to flush pending events and stop background tasks:

```typescript
process.on("SIGTERM", async () => {
  await client.close();
  process.exit(0);
});
```
