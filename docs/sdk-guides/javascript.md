# JavaScript / TypeScript SDK Quickstart

## Install

```bash
npm install @phaseflag/js-sdk
```

## Initialize

```typescript
import { PhaseFlagClient } from "@phaseflag/js-sdk";

const client = new PhaseFlagClient({
  apiKey: "sdk-dev-xxxxxxxxxxxx",
  environment: "production",
});

await client.initialize();
```

## Evaluate a Flag

```typescript
const enabled = await client.evaluateFlag<boolean>("my-flag", {
  userKey: "user-123",
});

if (enabled) {
  // new code path
}
```

## User Targeting

Pass attributes to match targeting rules configured in the dashboard:

```typescript
const enabled = await client.evaluateFlag<boolean>("beta-feature", {
  userKey: "user-123",
  attributes: {
    email: "alice@example.com",
    plan: "pro",
    country: "US",
    appVersion: "2.4.1",
  },
});
```

## Multivariate Flags

```typescript
// String flag
const theme = await client.evaluateFlag<string>("ui-theme", { userKey: "user-123" });
// Returns "dark" | "light" | "system"

// Number flag
const limit = await client.evaluateFlag<number>("rate-limit", { userKey: "user-123" });

// JSON flag
const config = await client.evaluateFlag<{ provider: string }>("checkout-config", {
  userKey: "user-123",
});
console.log(config.provider); // "stripe"
```

## Get Evaluation Detail

```typescript
const result = await client.evaluateFlagWithDetail<boolean>("my-flag", {
  userKey: "user-123",
});
// result.value    → true
// result.reason   → "TARGETING_RULE"
// result.ruleId   → "rule_abc123"
```

## Cleanup

```typescript
process.on("SIGTERM", async () => {
  await client.close();
});
```

## Further Reading

See the [full JavaScript SDK guide](https://docs.phaseflag.com/sdks/javascript) for streaming updates, TypeScript types, and more.
