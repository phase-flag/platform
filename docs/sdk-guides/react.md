# React SDK Quickstart

## Install

```bash
npm install @phaseflag/react @phaseflag/js-sdk
```

## Wrap Your App

Add `<PhaseFlagProvider>` at the root of your component tree:

```tsx
// main.tsx
import { PhaseFlagProvider } from "@phaseflag/react";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <PhaseFlagProvider
    apiKey="sdk-dev-xxxxxxxxxxxx"
    environment="production"
    user={{ userKey: "user-123", attributes: { plan: "pro" } }}
  >
    <App />
  </PhaseFlagProvider>
);
```

## useFlag Hook

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

## useFlagVariation Hook

```tsx
import { useFlagVariation } from "@phaseflag/react";

function ThemeProvider({ children }) {
  const theme = useFlagVariation<string>("ui-theme", "light");
  return <div data-theme={theme}>{children}</div>;
}
```

## Update User Context After Login

```tsx
import { usePhaseFlagClient } from "@phaseflag/react";

function LoginButton() {
  const client = usePhaseFlagClient();

  const handleLogin = async (user) => {
    await doLogin(user);
    client.identify({
      userKey: user.id,
      attributes: { plan: user.plan, email: user.email },
    });
  };

  return <button onClick={handleLogin}>Log In</button>;
}
```

## Further Reading

See the [full React SDK guide](https://docs.phaseflag.io/sdks/react) for SSR, Next.js integration, and loading states.
