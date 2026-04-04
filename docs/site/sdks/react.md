---
title: "React SDK"
description: "Use Phase Flag feature flags in your React application with hooks and a context provider."
---

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
      apiKey="sdk-dev-xxxxxxxxxxxx"
      environment="production"
      user={{ userKey: "user-123", attributes: { plan: "pro" } }}
    >
      <App />
    </PhaseFlagProvider>
  </React.StrictMode>
);
```

The provider initializes the underlying `PhaseFlagClient`, fetches the ruleset, and makes it available to all child components.

---

## useFlag Hook

`useFlag` returns a boolean indicating whether the flag is enabled for the current user:

```tsx
import { useFlag } from "@phaseflag/react";

function CheckoutButton() {
  const isNewCheckout = useFlag("new-checkout-flow");

  if (isNewCheckout) {
    return <NewCheckoutButton />;
  }

  return <LegacyCheckoutButton />;
}
```

While the ruleset is loading, `useFlag` returns `false` (safe default). A `<Suspense>` boundary is not required but is supported.

---

## useFlagVariation Hook

`useFlagVariation` returns the raw flag value — useful for multivariate flags:

```tsx
import { useFlagVariation } from "@phaseflag/react";

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useFlagVariation<string>("ui-theme", "light"); // second arg is default
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
  const config = useFlagVariation<PricingConfig>("pricing-config", {
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

## useFlagWithDetail Hook

For debugging or analytics, get the full evaluation result:

```tsx
import { useFlagWithDetail } from "@phaseflag/react";

function DebugBadge() {
  const result = useFlagWithDetail("new-checkout-flow");

  return (
    <pre>
      {JSON.stringify(
        {
          value: result.value,
          reason: result.reason,
          ruleId: result.ruleId,
        },
        null,
        2
      )}
    </pre>
  );
}
```

---

## Updating the User Context

When the user logs in or their attributes change, call `identify` via the context:

```tsx
import { usePhaseFlagClient } from "@phaseflag/react";

function LoginButton() {
  const client = usePhaseFlagClient();

  const handleLogin = async (user: User) => {
    await doLogin(user);

    // Update the evaluation context — all hook values will re-render
    client.identify({
      userKey: user.id,
      attributes: {
        email: user.email,
        plan: user.plan,
        orgId: user.orgId,
      },
    });
  };

  return <button onClick={handleLogin}>Log In</button>;
}
```

---

## Loading and Error States

```tsx
import { usePhaseFlagStatus } from "@phaseflag/react";

function App() {
  const { isLoading, error } = usePhaseFlagStatus();

  if (isLoading) return <LoadingSpinner />;
  if (error) console.warn("Phase Flag failed to initialize:", error.message);

  return <Main />;
}
```

---

## SSR Considerations

When using Server-Side Rendering (e.g., with Vite SSR), the `PhaseFlagProvider` must only render on the client. Use a dynamic import or a client-only guard:

```tsx
// Only renders after hydration
const [mounted, setMounted] = React.useState(false);
React.useEffect(() => setMounted(true), []);

if (!mounted) return <>{children}</>;

return <PhaseFlagProvider {...props}>{children}</PhaseFlagProvider>;
```

---

## Next.js Integration

<Note>
  Phase Flag's Admin Dashboard and Portal are Vite-based, not Next.js. The React SDK can still be used with Next.js App Router in your own applications.
</Note>

In Next.js App Router, wrap your root layout with the provider in a client component:

```tsx
// app/providers.tsx
"use client";

import { PhaseFlagProvider } from "@phaseflag/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PhaseFlagProvider
      apiKey={process.env.NEXT_PUBLIC_PHASEFLAG_API_KEY!}
      environment={process.env.NODE_ENV === "production" ? "production" : "development"}
      user={{ userKey: "anonymous" }}
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
| `apiKey` | `string` | Yes | SDK API key from project settings |
| `environment` | `string` | Yes | Target environment name |
| `user` | `EvaluationContext` | Yes | Initial user context |
| `baseUrl` | `string` | No | Override API base URL |
| `pollingInterval` | `number` | No | Ms between ruleset fetches (default: 30000) |
| `streaming` | `boolean` | No | Use SSE for real-time updates |
| `fallback` | `ReactNode` | No | Rendered while loading |
