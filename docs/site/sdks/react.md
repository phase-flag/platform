---
title: "React SDK"
description: "Use Phase Flag feature flags in your React application with hooks and a context provider — built on the JavaScript SDK."
---

# React SDK

## Installation

```bash
npm install @phaseflag/react @phaseflag/js-sdk
# or
yarn add @phaseflag/react @phaseflag/js-sdk
```

**Requires React 16.8+ (hooks support)**

---

## Setup: Wrap Your App with PhaseFlagProvider

Add the `<PhaseFlagProvider>` at the root of your component tree (typically `main.tsx` or `App.tsx`):

```tsx
// main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { PhaseFlagProvider } from "@phaseflag/react";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PhaseFlagProvider
      apiUrl="https://api.phaseflag.com/api/v1"
      apiKey="sdk-dev-xxxxxxxxxxxx"
      context={{
        userId: "user-123",
        attributes: { plan: "pro" },
      }}
    >
      <App />
    </PhaseFlagProvider>
  </React.StrictMode>
);
```

The provider initializes the underlying `PhaseFlagClient`, fetches the ruleset, and makes it available to all child components via React context.

---

## useBooleanFlag Hook

The most common hook — returns a boolean for simple on/off flags:

```tsx
import { useBooleanFlag } from "@phaseflag/react";

function CheckoutButton() {
  const isNewCheckout = useBooleanFlag("new-checkout-flow", false);

  if (isNewCheckout) {
    return <NewCheckoutButton />;
  }

  return <LegacyCheckoutButton />;
}
```

While the ruleset is loading, `useBooleanFlag` returns the `defaultValue` (safe fallback). Suspense is not required.

---

## useFlagValue Hook

Returns the raw flag value — useful for multivariate (string, number, JSON) flags:

```tsx
import { useFlagValue } from "@phaseflag/react";

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useFlagValue<string>("ui-theme", "light");
  return <div data-theme={theme}>{children}</div>;
}
```

```tsx
// JSON flag
interface PricingConfig {
  monthlyPrice: number;
  trialDays: number;
  showAnnualDiscount: boolean;
}

function PricingPage() {
  const config = useFlagValue<PricingConfig>("pricing-config", {
    monthlyPrice: 49,
    trialDays: 14,
    showAnnualDiscount: false,
  });

  return (
    <div>
      <p>${config.monthlyPrice}/month</p>
      {config.showAnnualDiscount && <AnnualDiscount />}
    </div>
  );
}
```

---

## useFeatureFlag Hook

Returns the value, variation details, and loading state:

```tsx
import { useFeatureFlag } from "@phaseflag/react";

function CheckoutPage() {
  const { value, variation, loading, flag } = useFeatureFlag("new-checkout-flow");

  if (loading) return <Spinner />;

  return (
    <div>
      <p>Flag: {String(value)}</p>
      <p>Variation: {variation?.key}</p>
    </div>
  );
}
```

---

## Updating the User Context

When the user logs in or their attributes change, update the context on the underlying client:

```tsx
import { usePhaseFlagClient } from "@phaseflag/react";

function LoginButton() {
  const client = usePhaseFlagClient();

  const handleLogin = async (user: User) => {
    await doLogin(user);

    // Update the evaluation context — all hook values will re-render
    client.setContext({
      userId: user.id,
      attributes: {
        email: user.email,
        plan: user.plan,
      },
    });
  };

  return <button onClick={handleLogin}>Log In</button>;
}
```

---

## Loading and Error States

Access the loading and error state from the provider:

```tsx
import { useContext } from "react";
import { PhaseFlagContext } from "@phaseflag/react";

function App() {
  // The provider exposes loading state through the context
  // Use useBooleanFlag / useFlagValue — they return defaultValue while loading
  const darkMode = useBooleanFlag("dark-mode", false);

  return <main data-theme={darkMode ? "dark" : "light"}>...</main>;
}
```

---

## Flag Mocking (Testing)

Use the underlying client's override API in tests:

```tsx
import { render } from "@testing-library/react";
import { PhaseFlagProvider } from "@phaseflag/react";
import { PhaseFlagClient } from "@phaseflag/js-sdk";

// In your test helpers
function renderWithFlags(
  ui: React.ReactElement,
  overrides: Record<string, unknown> = {}
) {
  // We use a ref to access the client after render
  const clientRef = { current: null as PhaseFlagClient | null };

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return (
      <PhaseFlagProvider
        apiUrl=""
        apiKey=""
        offlineMode
      >
        {children}
      </PhaseFlagProvider>
    );
  };

  return render(ui, { wrapper: Wrapper });
}
```

For simpler unit tests, mock the hooks directly:

```tsx
import { useBooleanFlag } from "@phaseflag/react";

vi.mock("@phaseflag/react", () => ({
  useBooleanFlag: (key: string, def: boolean) => {
    if (key === "new-checkout-flow") return true;
    return def;
  },
  useFlagValue: (_key: string, def: unknown) => def,
}));
```

---

## SSR Considerations

When using Server-Side Rendering (e.g., Vite SSR or Remix), mount the `PhaseFlagProvider` only on the client:

```tsx
function ClientPhaseFlagProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return <>{children}</>;

  return (
    <PhaseFlagProvider
      apiUrl={import.meta.env.VITE_PHASEFLAG_API_URL}
      apiKey={import.meta.env.VITE_PHASEFLAG_API_KEY}
    >
      {children}
    </PhaseFlagProvider>
  );
}
```

---

## Next.js App Router Integration

In Next.js App Router, wrap your root layout with the provider in a client component:

```tsx
// app/providers.tsx
"use client";

import { PhaseFlagProvider } from "@phaseflag/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PhaseFlagProvider
      apiUrl={process.env.NEXT_PUBLIC_PHASEFLAG_API_URL!}
      apiKey={process.env.NEXT_PUBLIC_PHASEFLAG_API_KEY!}
      context={{ userId: "anonymous" }}
    >
      {children}
    </PhaseFlagProvider>
  );
}
```

```tsx
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## Provider Props Reference

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `apiUrl` | `string` | Yes | API base URL (including `/api/v1`) |
| `apiKey` | `string` | Yes | SDK API key from project settings |
| `context` | `EvaluationContext` | No | Initial evaluation context |
| `pollingInterval` | `number` | No | Ms between ruleset fetches (default: 30000) |
| `bootstrap` | `BootstrapData` | No | Pre-loaded flag data for instant startup |
| `bootstrapUrl` | `string` | No | URL to fetch bootstrap data from |
| `offlineMode` | `boolean` | No | Use cached data when API is unreachable |
| `children` | `ReactNode` | Yes | Child components |

---

## Hooks Reference

| Hook | Returns | Description |
|------|---------|-------------|
| `useBooleanFlag(key, default)` | `boolean` | Evaluate a boolean flag |
| `useFlagValue<T>(key, default)` | `T` | Evaluate any flag type |
| `useFeatureFlag(key)` | `{ value, variation, loading, flag }` | Full evaluation result |
| `usePhaseFlagClient()` | `PhaseFlagClient` | Direct access to the underlying client |
