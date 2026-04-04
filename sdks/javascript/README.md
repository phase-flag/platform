# Phase Flag SDK -- JavaScript/TypeScript

Official JavaScript/TypeScript SDK for the Phase Flag feature flagging platform. Provides client-side and server-side feature flag evaluation with local caching, background polling, offline mode, bootstrap loading, and event tracking.

## Installation

```bash
npm install @phaseflag/sdk-js
```

## Quick Start

```typescript
import { PhaseFlagClient, createClient } from '@phaseflag/sdk-js';

// Option 1: Factory function (creates and starts the client)
const pf = await createClient({
  apiUrl: 'https://your-api.example.com/api/v1',
  apiKey: 'your-api-key',
});

if (pf.getBooleanValue('dark-mode', false)) {
  enableDarkMode();
}

// Option 2: Manual lifecycle
const client = new PhaseFlagClient({
  apiUrl: 'https://your-api.example.com/api/v1',
  apiKey: 'your-api-key',
  context: { userId: 'user-123', attributes: { plan: 'pro' } },
});

await client.start();
await client.waitUntilReady();

const variant = client.getStringValue('checkout-flow', 'control');
const config = client.getJsonValue('pricing-config', { tier: 'free' });

client.stop();
```

## API Reference

### `PhaseFlagClient`

#### Constructor Options (`PhaseFlagConfig`)

| Option | Type | Default | Description |
|---|---|---|---|
| `apiUrl` | `string` | required | Base URL of the Phase Flag API |
| `apiKey` | `string` | required | API key for authentication |
| `pollingInterval` | `number` | `30000` | Polling interval in milliseconds |
| `context` | `EvaluationContext` | `undefined` | Default evaluation context |
| `bootstrap` | `BootstrapData` | `undefined` | Pre-loaded flag data for instant startup |
| `bootstrapUrl` | `string` | `undefined` | URL to fetch bootstrap data from |
| `offlineMode` | `boolean` | `false` | Use cached/bootstrapped data when API is unreachable |
| `eventFlushInterval` | `number` | `30000` | Event flush interval in milliseconds |
| `eventBatchSize` | `number` | `100` | Max events before auto-flush |

#### Lifecycle

- `start(): Promise<void>` -- Fetch ruleset and start polling.
- `stop(): void` -- Stop polling and flush remaining events.
- `waitUntilReady(): Promise<void>` -- Wait for the first ruleset fetch.
- `setContext(ctx: EvaluationContext): void` -- Update the evaluation context.

#### Local Evaluation

- `getBooleanValue(flagKey, defaultValue, context?): boolean`
- `getStringValue(flagKey, defaultValue, context?): string`
- `getJsonValue<T>(flagKey, defaultValue, context?): T`
- `getVariation(flagKey, context?): EvaluationResult | null`
- `getAllFlags(): FlagDefinition[]`

#### Remote Evaluation

- `evaluateRemote(flagKey, context?): Promise<EvaluationResult>`

#### Event Tracking

- `trackEvent(event: EvaluationEvent): void`
- `flushEvents(): Promise<void>`

#### Testing

- `setOverride(flagKey, value): void` -- Override a flag value for tests.
- `clearOverride(flagKey): void`
- `clearAllOverrides(): void`

#### Change Listeners

- `onFlagsChanged(listener): () => void` -- Returns an unsubscribe function.

## Features

- Local evaluation (<1ms) with DJB2 deterministic hashing
- Background polling with configurable interval
- Streaming updates via SSE
- Offline mode with bootstrap files
- Batched event tracking with auto-flush
- Flag mocking for testing (no server required)
- Zero runtime dependencies
- Full TypeScript type definitions

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/javascript](https://docs.phaseflag.dev/sdks/javascript)

## License

Apache 2.0
