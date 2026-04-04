# JavaScript SDK Quickstart

## Installation

```bash
npm install @phaseflag/sdk-js
```

## Initialization

```typescript
import { PhaseFlagClient } from '@phaseflag/sdk-js';

const client = new PhaseFlagClient({
  apiKey: 'pf_env_your_api_key',
  apiUrl: 'https://api.phaseflag.dev', // or your self-hosted URL
  pollingIntervalMs: 30000,            // default: 30s
  context: {
    user_id: 'user-123',
    plan: 'pro',
    country: 'US',
  },
});

await client.initialize();
```

## Evaluating Flags

### Boolean Flags

```typescript
const enabled = client.getBooleanValue('new-checkout', false);
if (enabled) {
  showNewCheckout();
} else {
  showLegacyCheckout();
}
```

### String Flags

```typescript
const theme = client.getStringValue('theme-color', 'blue');
applyTheme(theme);
```

### Number Flags

```typescript
const rateLimit = client.getNumberValue('api-rate-limit', 100);
```

### JSON Flags

```typescript
const config = client.getJsonValue('dashboard-config', { layout: 'grid' });
```

### Full Evaluation Detail

```typescript
const detail = client.getEvaluationDetail('new-checkout');
console.log(detail.value);        // true
console.log(detail.variationKey);  // "enabled"
console.log(detail.reason);       // "targeting_match"
```

## Updating Context

```typescript
// Update user context (triggers re-evaluation)
client.setContext({
  user_id: 'user-456',
  plan: 'enterprise',
});
```

## Event Listeners

```typescript
// Listen for flag changes
client.on('flagsUpdated', (flags) => {
  console.log('Flags updated:', flags);
});

// Listen for specific flag changes
client.on('flagChanged:new-checkout', (newValue, oldValue) => {
  console.log(`new-checkout changed from ${oldValue} to ${newValue}`);
});

// Listen for errors
client.on('error', (error) => {
  console.error('Phase Flag error:', error);
});
```

## Offline Mode

```typescript
const client = new PhaseFlagClient({
  apiKey: 'pf_env_...',
  bootstrapData: require('./phaseflag-bootstrap.json'),
  offlineFallback: true,
});
```

## Testing

```typescript
import { PhaseFlagTestClient } from '@phaseflag/sdk-js/testing';

const testClient = new PhaseFlagTestClient({
  overrides: {
    'new-checkout': true,
    'theme-color': 'dark',
  },
});

// Use in tests
const enabled = testClient.getBooleanValue('new-checkout', false); // true
```

## Cleanup

```typescript
// Stop polling and release resources
client.close();
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions.

```typescript
interface EvaluationDetail<T> {
  value: T;
  variationKey: string;
  variationId: string;
  reason: 'targeting_match' | 'percentage_rollout' | 'default' | 'flag_inactive' | 'error';
  flagKey: string;
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | required | Environment API key |
| `apiUrl` | string | `https://api.phaseflag.dev` | API base URL |
| `pollingIntervalMs` | number | `30000` | Polling interval in ms |
| `context` | object | `{}` | Initial evaluation context |
| `bootstrapData` | object | `null` | Pre-loaded flag data for offline mode |
| `offlineFallback` | boolean | `false` | Use defaults when API unreachable |
| `logger` | Logger | `console` | Custom logger |
