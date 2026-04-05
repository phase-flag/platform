---
title: "5-Minute Quickstart"
description: "Start the stack, create a flag, evaluate it in code — in under 5 minutes."
---

# 5-Minute Quickstart

This guide walks you from zero to a live feature flag evaluated in your application code.

---

## Step 1: Start the Stack (30 seconds)

Make sure [Docker](https://docs.docker.com/get-docker/) 24+ is installed, then run:

```bash
git clone https://github.com/phaseflag/phaseflag.git
cd phaseflag/infra/docker
cp .env.example .env
docker compose up -d
docker compose exec api alembic upgrade head
```

This starts three services:

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | http://localhost:3000 | React admin UI |
| API | http://localhost:8000 | FastAPI control plane |
| PostgreSQL | localhost:5432 | Database |

Verify everything is running:

```bash
docker compose ps
```

---

## Step 2: Open the Dashboard

Navigate to **[http://localhost:3000](http://localhost:3000)** in your browser.

Click **Register** and create your admin account. The first user to register automatically receives the **admin** role.

When prompted:
1. **Create an organization** — e.g., `My Company`
2. **Create a project** — e.g., `my-web-app`

Each project gets three environments by default: **Development**, **Staging**, and **Production**.

---

## Step 3: Create Your First Flag

1. Select your project and the **Development** environment from the sidebar.
2. Click **New Flag** in the top-right corner.
3. Fill in the form:
   - **Key**: `new-checkout-flow`
   - **Name**: "New Checkout Flow"
   - **Type**: Boolean
   - **Description**: "Enables the redesigned checkout page"
4. Click **Create Flag**.

The flag is created and **disabled** (off) by default. Leave it off for now.

---

## Step 4: Get Your SDK API Key

1. Go to **Settings → API Keys** in your project.
2. Click **Create Key** for the **Development** environment.
3. Copy the generated key — it looks like `sdk-dev-xxxxxxxxxxxx`.

---

## Step 5: Install the SDK

::: code-group

```bash [JavaScript / TypeScript]
npm install @phaseflag/js-sdk
```

```bash [Python]
pip install phaseflag-sdk
```

```bash [Go]
go get github.com/phaseflag/go-sdk
```

:::

---

## Step 6: Evaluate the Flag in Code

::: code-group

```typescript [JavaScript / TypeScript]
import { PhaseFlagClient } from "@phaseflag/js-sdk";

const client = new PhaseFlagClient({
  apiUrl: "http://localhost:8000/api/v1",
  apiKey: "sdk-dev-xxxxxxxxxxxx",
  context: { userId: "user-123" },
});

await client.start();

// Returns false — the flag is currently off
const enabled = client.getBooleanValue("new-checkout-flow", false);

if (enabled) {
  console.log("Showing new checkout flow");
} else {
  console.log("Showing legacy checkout flow");  // <-- you'll see this
}

client.stop();
```

```python [Python]
from phaseflag import PhaseFlagClient, EvaluationContext

client = PhaseFlagClient(
    base_url="http://localhost:8000/api/v1",
    api_key="sdk-dev-xxxxxxxxxxxx",
)
client.start()
client.wait_until_ready(timeout=5.0)

context = EvaluationContext(
    user_id="user-123",
    attributes={"email": "alice@example.com", "plan": "pro"},
)

# Returns False — the flag is currently off
enabled = client.get_boolean_value("new-checkout-flow", False, context)

if enabled:
    print("Showing new checkout flow")
else:
    print("Showing legacy checkout flow")  # <-- you'll see this

client.stop()
```

```go [Go]
package main

import (
    "fmt"
    "log"
    "time"

    phaseflag "github.com/phaseflag/go-sdk"
)

func main() {
    client := phaseflag.NewClient(phaseflag.Config{
        BaseURL: "http://localhost:8000/api/v1",
        APIKey:  "sdk-dev-xxxxxxxxxxxx",
    })
    if err := client.Start(); err != nil {
        log.Fatal(err)
    }
    defer client.Stop()

    client.WaitUntilReady(5 * time.Second)

    ctx := &phaseflag.EvaluationContext{UserID: "user-123"}

    // Returns false — the flag is currently off
    enabled := client.GetBooleanValue("new-checkout-flow", false, ctx)

    if enabled {
        fmt.Println("Showing new checkout flow")
    } else {
        fmt.Println("Showing legacy checkout flow") // <-- you'll see this
    }
}
```

:::

Run your code — since the flag is **off**, you'll see the legacy path.

---

## Step 6: Toggle the Flag and See the Change

1. Return to the Phase Flag dashboard at **[http://localhost:3000](http://localhost:3000)**.
2. Find `new-checkout-flow` in the **Development** environment.
3. Click the **toggle** to enable it (turns green).
4. Re-run your code (or wait up to 30 seconds for the SDK to poll).

Your code now evaluates the flag as `true` and takes the new checkout path — **no redeploy required**.

---

## What Just Happened

The SDK fetched a **compiled ruleset** from the API and cached it in memory. All flag evaluations happen locally — no network round-trip per evaluation. The SDK polls every 30 seconds for ruleset updates, so when you toggled the flag the change propagates automatically.

---

## Next Steps

- **[JavaScript SDK Guide](/sdks/javascript)** — targeting rules, polling, streaming, testing
- **[Python SDK Guide](/sdks/python)** — async support, FastAPI integration, context manager
- **[Go SDK Guide](/sdks/go)** — goroutine-safe evaluation, HTTP middleware
- **[React SDK Guide](/sdks/react)** — `useBooleanFlag` hook, provider setup
- **[Architecture Overview](/architecture/overview)** — control plane, data plane, relay proxy
- **[Deploy to Production](/deployment/self-hosted)** — VPS, SSL, nginx reverse proxy
