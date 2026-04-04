---
title: "Quickstart"
description: "Create your first feature flag and evaluate it in code in under 5 minutes."
---

## Prerequisites

- An account at [app.phaseflag.io](https://app.phaseflag.io) — or a local instance running via [OSS Docker](/deployment/oss-docker)
- Node.js 18+ (for the JavaScript example below)

---

## Step 1: Create an Account

Navigate to [app.phaseflag.io/signup](https://app.phaseflag.io/signup) and register with your email. If you're running the OSS stack locally, open `http://localhost:3000` and register — the first user automatically becomes an admin.

---

## Step 2: Create an Organization and Project

After signing in, you'll be prompted to:

1. **Create an organization** — this is your top-level tenant (e.g., your company name).
2. **Create a project** — a project maps to one of your applications or services (e.g., `my-web-app`).

Each project automatically gets three environments: **Development**, **Staging**, and **Production**.

---

## Step 3: Create Your First Feature Flag

1. In the dashboard, select your project and the **Development** environment.
2. Click **New Flag** in the top-right corner.
3. Fill in the form:
   - **Name**: `new-checkout-flow`
   - **Type**: Boolean
   - **Description**: "Enables the redesigned checkout flow"
4. Click **Create Flag**.

The flag is now created and **disabled** by default in Development.

---

## Step 4: Get Your SDK API Key

1. Navigate to **Settings → API Keys** in your project.
2. Click **Generate Key** for the **Development** environment.
3. Copy the key — it looks like `sdk-dev-xxxxxxxxxxxx`.

---

## Step 5: Install the SDK

<Tabs>
  <Tab title="JavaScript / TypeScript">
    ```bash
    npm install @phaseflag/js-sdk
    ```
  </Tab>
  <Tab title="Python">
    ```bash
    pip install phaseflag-sdk
    ```
  </Tab>
  <Tab title="Go">
    ```bash
    go get github.com/phaseflag/go-sdk
    ```
  </Tab>
</Tabs>

---

## Step 6: Evaluate the Flag in Code

<Tabs>
  <Tab title="JavaScript / TypeScript">
    ```typescript
    import { PhaseFlagClient } from "@phaseflag/js-sdk";

    const client = new PhaseFlagClient({
      apiKey: "sdk-dev-xxxxxxxxxxxx",
      environment: "development",
    });

    await client.initialize();

    const context = {
      userKey: "user-123",
      attributes: {
        email: "alice@example.com",
        plan: "pro",
      },
    };

    const enabled = await client.evaluateFlag("new-checkout-flow", context);

    if (enabled) {
      console.log("Showing new checkout flow");
    } else {
      console.log("Showing legacy checkout flow");
    }
    ```
  </Tab>
  <Tab title="Python">
    ```python
    from phaseflag import PhaseFlagClient, EvaluationContext

    client = PhaseFlagClient(
        api_key="sdk-dev-xxxxxxxxxxxx",
        environment="development",
    )
    client.initialize()

    context = EvaluationContext(
        user_key="user-123",
        attributes={"email": "alice@example.com", "plan": "pro"},
    )

    enabled = client.evaluate_flag("new-checkout-flow", context)

    if enabled:
        print("Showing new checkout flow")
    else:
        print("Showing legacy checkout flow")
    ```
  </Tab>
  <Tab title="Go">
    ```go
    package main

    import (
        "context"
        "fmt"
        "log"

        phaseflag "github.com/phaseflag/go-sdk"
    )

    func main() {
        client, err := phaseflag.NewClient(phaseflag.Config{
            APIKey:      "sdk-dev-xxxxxxxxxxxx",
            Environment: "development",
        })
        if err != nil {
            log.Fatal(err)
        }
        defer client.Close()

        ctx := context.Background()
        evalCtx := phaseflag.EvaluationContext{
            UserKey: "user-123",
            Attributes: map[string]interface{}{
                "email": "alice@example.com",
                "plan":  "pro",
            },
        }

        enabled, err := client.EvaluateFlag(ctx, "new-checkout-flow", evalCtx)
        if err != nil {
            log.Fatal(err)
        }

        if enabled.(bool) {
            fmt.Println("Showing new checkout flow")
        } else {
            fmt.Println("Showing legacy checkout flow")
        }
    }
    ```
  </Tab>
</Tabs>

Run your code — the flag is currently **off**, so you'll see the legacy path.

---

## Step 7: Toggle the Flag and See It Change Live

1. Return to the Phase Flag dashboard.
2. Find `new-checkout-flow` in the Development environment.
3. Click the **toggle** to enable it.
4. Re-run your code (or wait for the SDK to poll — default interval is 30 seconds).

Your code now evaluates the flag as `true` and takes the new checkout path — without a redeploy.

---

## Next Steps

<CardGroup cols={2}>
  <Card title="Add Targeting Rules" icon="target" href="/sdks/javascript#user-targeting">
    Roll out to specific users, organizations, or custom attributes.
  </Card>
  <Card title="Percentage Rollout" icon="chart-pie" href="/sdks/javascript#percentage-rollouts">
    Gradually increase traffic to a new feature variant.
  </Card>
  <Card title="API Reference" icon="code" href="/api-reference/overview">
    Manage flags programmatically via the REST API.
  </Card>
  <Card title="Deploy to Production" icon="server" href="/deployment/oss-docker">
    Run Phase Flag on your own infrastructure.
  </Card>
</CardGroup>
