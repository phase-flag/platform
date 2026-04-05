# Phase Flag SDK -- React

Official React SDK for the Phase Flag feature flagging platform. Provides React hooks, a provider component, and conditional rendering utilities for client-side feature flag evaluation. Built on top of `@phaseflag/js-sdk`.

## Installation

```bash
npm install @phaseflag/react @phaseflag/js-sdk
```

Requires React 18+.

## Quick Start

```tsx
import {
  PhaseFlagProvider,
  useBooleanFlag,
  useFeatureFlag,
  IfFeatureEnabled,
} from '@phaseflag/react';

// 1. Wrap your app with PhaseFlagProvider
function App() {
  return (
    <PhaseFlagProvider
      apiUrl="https://api.example.com/api/v1"
      apiKey="your-api-key"
    >
      <MyComponent />
    </PhaseFlagProvider>
  );
}

// 2. Use hooks in any child component
function MyComponent() {
  const darkMode = useBooleanFlag('dark-mode', false);
  const { value, variation, loading } = useFeatureFlag('experiment-a');
  const theme = useStringFlag('theme', 'light');

  return darkMode ? <DarkUI /> : <LightUI />;
}

// 3. Or use conditional rendering components
function Checkout() {
  return (
    <IfFeatureEnabled flagKey="new-checkout" fallback={<OldCheckout />}>
      <NewCheckout />
    </IfFeatureEnabled>
  );
}
```

## API Reference

### `<PhaseFlagProvider>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `apiUrl` | `string` | required | Phase Flag API base URL |
| `apiKey` | `string` | required | API key for authentication |
| `pollingInterval` | `number` | `30000` | Polling interval in milliseconds |
| `context` | `EvaluationContext` | `undefined` | Initial evaluation context |
| `bootstrap` | `BootstrapData` | `undefined` | Pre-loaded flag data for instant startup |
| `bootstrapUrl` | `string` | `undefined` | URL to fetch bootstrap data from |
| `offlineMode` | `boolean` | `false` | Use cached/bootstrapped data when API is unreachable |

### Hooks

- `useBooleanFlag(flagKey, defaultValue) -> boolean`
- `useStringFlag(flagKey, defaultValue) -> string`
- `useJsonFlag<T>(flagKey, defaultValue) -> T`
- `useFlagValue<T>(flagKey, defaultValue) -> T`
- `useFeatureFlag(flagKey) -> { value, variation, loading, flag }`
- `useFlags() -> { flags, loading, error }`
- `usePhaseFlagClient() -> PhaseFlagClient` -- Access the underlying client.
- `useFlagChangeListener(callback) -> void`

### Components

- `<IfFeatureEnabled flagKey="..." fallback={...}>` -- Conditional rendering based on boolean flags.

## Features

- Local evaluation (<1ms) with automatic re-renders on flag changes
- Background polling via the underlying JS SDK
- Offline mode with bootstrap data
- Type-safe hooks with TypeScript generics
- Conditional rendering components
- Direct client access for advanced operations

## Documentation

Full docs at [https://docs.phaseflag.dev/sdks/react](https://docs.phaseflag.dev/sdks/react)

## License

Apache 2.0
