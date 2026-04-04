---
title: "Flag Evaluation"
description: "Evaluate feature flags server-side and fetch compiled rulesets for SDK initialization."
---

## Overview

Phase Flag provides two evaluation-related endpoints:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/evaluate` | SDK API Key | Evaluate one or more flags server-side |
| `GET` | `/sdk/ruleset` | SDK API Key | Fetch the full compiled ruleset for client-side evaluation |

<Note>
  **Client-side SDKs** (JS, React, mobile) call `GET /sdk/ruleset` once at startup and evaluate flags locally with no per-evaluation network round-trip.

  **Server-side SDK alternative**: Some backend integrations prefer calling `POST /evaluate` directly for simplicity. The relay proxy also exposes this endpoint locally for low-latency server-to-server calls.
</Note>

---

## POST /evaluate

Evaluate one or more flags for a given user context. Returns the variation value and evaluation reason.

### Request

```bash
curl -X POST https://api.phaseflag.io/api/v1/evaluate \
  -H "X-API-Key: sdk-prod-xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "flags": ["new-checkout-flow", "ui-theme", "rate-limit"],
    "context": {
      "user_key": "user-123",
      "attributes": {
        "email": "alice@example.com",
        "plan": "enterprise",
        "country": "US",
        "app_version": "2.4.1"
      }
    }
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `flags` | string[] | Yes | Array of flag keys to evaluate. Pass `["*"]` for all flags. |
| `context.user_key` | string | Yes | Unique user identifier — used for percentage rollout bucketing |
| `context.attributes` | object | No | Key-value attributes for targeting rule matching |

### Response `200 OK`

```json
{
  "data": {
    "evaluations": {
      "new-checkout-flow": {
        "value": true,
        "reason": "TARGETING_RULE",
        "rule_id": "rule_abc123",
        "variation_key": "on"
      },
      "ui-theme": {
        "value": "dark",
        "reason": "TARGETING_RULE",
        "rule_id": "rule_def456",
        "variation_key": "dark"
      },
      "rate-limit": {
        "value": 1000,
        "reason": "DEFAULT",
        "rule_id": null,
        "variation_key": "default"
      }
    },
    "evaluated_at": "2026-04-04T15:00:00.000Z"
  }
}
```

#### Evaluation Reasons

| Reason | Description |
|--------|-------------|
| `TARGETING_RULE` | A targeting rule matched the user context |
| `PERCENTAGE_ROLLOUT` | User was assigned by percentage bucketing |
| `DEFAULT` | No rule matched; the default variation was served |
| `DISABLED` | The flag is inactive — default variation served |
| `PREREQUISITE` | A prerequisite flag evaluation blocked this flag |
| `FLAG_NOT_FOUND` | The flag key does not exist — `null` value returned |

### Evaluate a Single Flag

```bash
curl -X POST https://api.phaseflag.io/api/v1/evaluate \
  -H "X-API-Key: sdk-prod-xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "flags": ["new-checkout-flow"],
    "context": {"user_key": "user-123"}
  }'
```

### JavaScript Example

```typescript
const response = await fetch("https://api.phaseflag.io/api/v1/evaluate", {
  method: "POST",
  headers: {
    "X-API-Key": "sdk-prod-xxxxxxxxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    flags: ["new-checkout-flow", "ui-theme"],
    context: {
      user_key: req.user.id,
      attributes: {
        plan: req.user.plan,
        email: req.user.email,
      },
    },
  }),
});

const { data } = await response.json();
const isNewCheckout = data.evaluations["new-checkout-flow"].value;
```

---

## GET /sdk/ruleset

Fetch the complete compiled ruleset for a given environment. This is what SDKs call at initialization time to enable local flag evaluation.

### Request

```bash
curl https://api.phaseflag.io/api/v1/sdk/ruleset \
  -H "X-API-Key: sdk-prod-xxxxxxxxxxxx"
```

### Conditional Fetch (ETag)

The ruleset endpoint supports ETag-based conditional requests to save bandwidth. SDKs include the `If-None-Match` header with the last received ETag:

```bash
curl https://api.phaseflag.io/api/v1/sdk/ruleset \
  -H "X-API-Key: sdk-prod-xxxxxxxxxxxx" \
  -H 'If-None-Match: "etag-v42-abc123"'
# Returns 304 Not Modified if nothing has changed
```

### Response `200 OK`

```json
{
  "data": {
    "version": 42,
    "environment_id": "env_prod_abc",
    "flags": [
      {
        "key": "new-checkout-flow",
        "flag_type": "boolean",
        "enabled": true,
        "variations": [
          {"key": "on", "value": true},
          {"key": "off", "value": false}
        ],
        "default_variation": "off",
        "targeting_rules": [
          {
            "id": "rule_abc123",
            "priority": 1,
            "conditions": [
              {"attribute": "plan", "operator": "one_of", "value": ["enterprise", "pro"]}
            ],
            "variation": "on"
          },
          {
            "id": "rule_def456",
            "priority": 2,
            "conditions": [],
            "percentage_rollout": [
              {"variation": "on", "percentage": 10},
              {"variation": "off", "percentage": 90}
            ]
          }
        ]
      }
    ],
    "segments": [
      {
        "id": "seg_abc",
        "key": "beta-users",
        "conditions": [
          {"attribute": "plan", "operator": "one_of", "value": ["beta"]}
        ]
      }
    ],
    "fetched_at": "2026-04-04T15:00:00Z"
  }
}
```

### Response `304 Not Modified`

Returned when the ETag matches — no body is included. The SDK should continue using its cached ruleset.

---

## Relay Proxy Evaluation

If you're running the [relay proxy](/deployment/self-hosted#relay-proxy), it exposes the same evaluation endpoints locally:

```bash
# Evaluate via relay (no control plane round-trip)
curl -X POST http://localhost:8001/api/v1/evaluate \
  -H "X-API-Key: sdk-prod-xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "flags": ["my-flag"],
    "context": {"user_key": "user-123"}
  }'
```

The relay handles the ruleset caching and local evaluation, so the control plane is not involved in the request path.
