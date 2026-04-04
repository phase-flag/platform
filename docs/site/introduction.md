---
title: "Introduction"
description: "Phase Flag is a production-grade, open-source feature flagging platform for modern engineering teams."
---

## What is Phase Flag?

Phase Flag is a full-featured feature flagging SaaS that lets you ship code faster by decoupling deployments from releases. It provides a **control plane** for managing flags and a **high-performance data plane** for evaluating them at the edge — all with sub-millisecond latency.

Whether you're running a single-service startup or a multi-team enterprise, Phase Flag scales with you across three deployment modes:

| Mode | Best For |
|------|----------|
| **OSS** | Self-hosted teams who want full control, no license required |
| **SaaS** | Teams who want the managed service at [phaseflag.io](https://app.phaseflag.io) |
| **Enterprise** | Organizations needing SSO, compliance, advanced governance, and audit trails |

---

## Key Features

### Flag Types

- **Boolean flags** — the classic on/off switch for feature gates and kill switches
- **String flags** — serve different UI copy, theme names, or configuration values
- **Number flags** — tune rate limits, timeouts, thresholds without a deploy
- **JSON flags** — full structured configuration delivered at runtime

### Targeting & Segmentation

Define precise audiences using a rule builder with 11+ operators:

- `is`, `is_not`, `contains`, `not_contains`
- `one_of`, `not_one_of`
- `gt`, `lt` (numeric comparisons)
- `matches_regex`, `version_gt`, `version_lt`

Combine conditions into reusable **Segments** and reference them across multiple flags.

### Percentage Rollouts

Gradually release features to a percentage of users using deterministic DJB2 hashing. The same user always gets the same variation — no flickering, no inconsistency.

### Real-Time Evaluation via Go Relay Proxy

The **relay proxy** is a lightweight Go service that sits between your SDKs and the control plane. It:

- Caches the full ruleset locally with a configurable TTL
- Evaluates flags server-side for backend services
- Buffers and forwards evaluation events to reduce control-plane load
- Supports ETag-based conditional fetching for bandwidth efficiency

### Environments

Each project supports multiple isolated environments (e.g., `development`, `staging`, `production`). Flag states are fully independent per environment. You can promote flag configurations across environments with a single click.

### Audit Log

Every mutation — flag creation, rule change, toggle, deletion — is recorded with the actor's identity, timestamp, and before/after diff. Enterprise users get long-term retention and export.

### Webhooks

Configure outbound webhooks to notify your CI/CD pipeline, Slack channels, or custom integrations when flag state changes.

---

## Architecture

Phase Flag separates **management** from **evaluation**:

```
                      Dashboard (React)
                            |
                         REST API
                            |
              +-------------+-------------+
              |                           |
          FastAPI                    Relay Proxy
         (Control Plane)              (Go, Data Plane)
              |                           |
          PostgreSQL               SDKs (JS/Py/Go/React/Java/...)
                                         |
                                   Your Applications
```

**Control Plane** (FastAPI, Python 3.11):
- Manages all flag configuration, segments, environments, and audit logs
- Streams ruleset updates to relay via Server-Sent Events
- Issues JWT tokens and API keys for authentication

**Data Plane** (Go Relay + SDKs):
- SDKs fetch a compiled ruleset and evaluate flags **locally** — no network round-trip per evaluation
- The relay proxy aggregates ruleset fetches from thousands of SDK instances
- Evaluation events are batched and forwarded asynchronously

---

## Deployment Options

<CardGroup cols={2}>
  <Card title="OSS Docker" icon="docker" href="/deployment/oss-docker">
    Run the full stack locally with a single `docker compose up`. No license required.
  </Card>
  <Card title="SaaS (Managed)" icon="cloud" href="https://app.phaseflag.io/signup">
    Start in 60 seconds. We manage the infrastructure, you manage your flags.
  </Card>
  <Card title="Self-Hosted" icon="server" href="/deployment/self-hosted">
    Deploy to your own VPS with Docker Compose and a custom domain.
  </Card>
  <Card title="Kubernetes / Helm" icon="helm" href="/deployment/kubernetes">
    Production-grade deployment with horizontal pod autoscaling and Helm.
  </Card>
</CardGroup>

---

## Quick Links

<CardGroup cols={3}>
  <Card title="Quickstart" icon="rocket" href="/quickstart">
    Create your first flag in under 5 minutes.
  </Card>
  <Card title="API Reference" icon="code" href="/api-reference/overview">
    Full REST API documentation with examples.
  </Card>
  <Card title="SDK Guides" icon="book" href="/sdks/javascript">
    Integration guides for JS, Python, Go, React, Java, and more.
  </Card>
</CardGroup>
