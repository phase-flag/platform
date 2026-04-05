# Introducing Phase Flag — Open Source Feature Flagging for Everyone

**Published April 4, 2024 · 6 min read**

---

Today we are launching Phase Flag: an open-source feature flagging platform built for engineering teams who are serious about progressive delivery.

Feature flags are not a new idea. LaunchDarkly has been around since 2014. Split, Unleash, Flagsmith, Flipt — the ecosystem has been building for a decade. So why build another one?

Because every existing option forces you into a trade-off: pay per-seat for a managed SaaS, or settle for a self-hosted tool that looks and feels like an afterthought. We wanted something that was open source at its core, enterprise-grade in its capabilities, and genuinely pleasant to work with.

Phase Flag is that thing.

## What Phase Flag Is

Phase Flag is a complete feature flagging platform with three deployment modes:

- **OSS** — the open-source core, self-hosted, no license required, no seat limits. Works with SQLite for small teams, Postgres for everyone else.
- **SaaS** — our managed cloud at phaseflag.com, with multi-tenancy, usage analytics, and Stripe billing. Free tier available.
- **Enterprise** — all the OSS and SaaS features plus SAML 2.0 SSO, SCIM 2.0 provisioning, OIDC, advanced A/B testing with statistical analysis, compliance audit logs, change request workflows, and more.

The core API is FastAPI on Python 3.11. The edge evaluation proxy is Go. The admin dashboard is React 18. Everything is containerized, and we ship Helm charts and Terraform modules for production deployments.

## 15+ SDKs on Day One

Shipping without SDK coverage is table stakes for a feature flagging platform. We launched with official SDKs for:

**Server-side:** JavaScript/TypeScript, Python, Go, Java, .NET, PHP, Rust

**Client-side:** React, Angular, Vue, Svelte, SolidJS, iOS (Swift), Edge runtime

**Standards:** OpenFeature providers for TypeScript and Python — drop Phase Flag into any OpenFeature-compatible setup without rewriting your evaluation calls.

Here is what evaluation looks like in JavaScript:

```typescript
import { PhaseFlag } from '@phaseflag/javascript'

const client = new PhaseFlag({
  apiKey: process.env.PHASEFLAG_API_KEY,
  environment: 'production',
})

await client.initialize()

const user = { id: 'user-123', email: 'alice@example.com', plan: 'pro' }

if (await client.isEnabled('new-checkout-flow', user)) {
  // Show the new checkout UI
} else {
  // Show the legacy checkout UI
}
```

And in Python:

```python
from phaseflag import PhaseFlag

client = PhaseFlag(api_key=os.environ["PHASEFLAG_API_KEY"], environment="production")
await client.initialize()

user = {"id": "user-123", "email": "alice@example.com", "plan": "pro"}

if await client.is_enabled("new-checkout-flow", user):
    return render_new_checkout(user)
else:
    return render_legacy_checkout(user)
```

The SDK interface is deliberately minimal. `isEnabled` for boolean flags. `getVariant` for multivariate. `getPayload` when you want to ship JSON config alongside the flag. Async-first, with synchronous fallback modes for environments that need it.

## What Makes Phase Flag Different

**Sub-millisecond evaluation, locally.** The Go relay proxy caches your full ruleset in memory and evaluates flags without a network round-trip. P99 evaluation latency under 1ms even at scale. Your application never blocks on flag evaluation.

**Targeting that actually works.** Rules can match on any user attribute — plan, country, email domain, custom properties. You can target by percentage rollout, by segment membership, or by explicit user list. Rules compose with AND/OR logic.

**Environments that make sense.** Flags exist across environments (development, staging, production) with independent state. Promote a flag from staging to production with one click, without touching your code.

**Audit log from day one.** Every flag change, targeting update, and rollout adjustment is logged with the actor, timestamp, and before/after diff. Non-negotiable for teams with compliance requirements, and just good engineering practice for everyone else.

**Open source, no tricks.** The core is Apache 2.0. Not "open core" where the good stuff is locked behind a paywall. The OSS build is a complete, production-ready feature flagging platform. Enterprise modules layer on top for teams that need them.

## The Architecture in Brief

```
Your App → SDK → Go Relay Proxy → in-memory ruleset cache
                                ↑
                         FastAPI backend (Python)
                                ↑
                           PostgreSQL
```

The relay proxy is the key architectural decision. SDKs talk to the relay, not directly to the API. The relay holds the full ruleset in memory, refreshed every few seconds from the API. This means evaluation is fast, the API is protected from SDK traffic spikes, and your flags still evaluate even if the API is temporarily unreachable.

## Get Started

Phase Flag is live at [phaseflag.com](https://phaseflag.com). The source is on GitHub at [github.com/phaseflag/phaseflag](https://github.com/phaseflag/phaseflag).

To self-host:

```bash
git clone https://github.com/phaseflag/phaseflag
cd phaseflag/infra/docker
docker compose up -d
```

The API is available at `http://localhost:8000`. The dashboard at `http://localhost:3000`. Create your first flag in under two minutes.

Read the [full documentation](https://docs.phaseflag.com) for SDK setup guides, API reference, Kubernetes deployment, and the complete feature tour.

We built Phase Flag because we believe every engineering team deserves a first-class feature flagging platform, regardless of their budget. We hope you find it useful.

— The Phase Flag team
