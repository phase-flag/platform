# Phase Flag — Product Requirements Document

> Fill this in with your full PRD. This file is the human-readable reference that informs story generation.
> Ralph reads prd.json for story execution — this file is for context and planning only.

---

## Product Overview

**Phase Flag** is a production-grade feature flagging SaaS platform.

Target users: engineering teams at software companies who need safe, controlled feature rollouts.

Competitors: LaunchDarkly, Unleash, Flagsmith, Split.io, DevCycle.

Differentiators:
- OSS core with enterprise modules (no vendor lock-in)
- OpenFeature compatible out of the box
- Go relay proxy for edge evaluation (sub-millisecond latency)
- 13+ language SDKs with identical evaluation engine
- Three deployment modes: OSS / SaaS / Enterprise

---

## Core Features (implemented)

- Boolean and multivariate feature flags
- Percentage rollout with deterministic bucketing (DJB2)
- Targeting rules with user attribute conditions
- Reusable audience segments
- Multi-environment support (development, staging, production)
- Multi-project / multi-tenant organization model
- A/B testing and experiments
- Real-time flag updates via Server-Sent Events (SSE)
- Audit logging (immutable)
- Webhook support
- Role-based access control (admin, editor, viewer)
- Flag lifecycle management (development → testing → production → stale → archived)
- Code reference scanning (pfctl code-refs)
- Migration tools (LaunchDarkly, Unleash, Flagsmith importers)

---

## Enterprise Features (implemented)

- SSO: SAML 2.0, OIDC, SCIM 2.0
- Change governance: change requests, approval workflows, freeze windows
- Advanced A/B testing with statistical analysis
- Advanced analytics and reporting
- FinOps: cost tracking per project
- Compliance module (SOC 2 evidence export)
- Flag dependency interaction graphs
- Rollout simulation and prediction
- Counterfactual analysis

---

## Remaining Work (tracked in prd.json)

See `prd.json` for the 35-story roadmap covering:

1. **Migration & Scaffold Setup** — verify migration, local dev stack, git setup
2. **GitHub & CI/CD** — repo creation, secrets, workflow validation
3. **Production Infrastructure** — Droplet, DNS, SSL, deployment
4. **SaaS Portal & Billing** — Stripe, org model, onboarding
5. **SDK Publishing** — npm, PyPI, pkg.go.dev, GitHub Releases
6. **Documentation Site** — Mintlify/Docusaurus, guides, API reference
7. **Quality & Security** — integration tests, E2E tests, security audit

---

## Architecture

See `docs/architecture/overview.md` for the full architecture document.

**Key design decisions:**
- Control plane (API) is separate from data plane (SDK + relay)
- SDKs download compiled rulesets and evaluate locally (no round-trip per flag check)
- DJB2 hashing for deterministic percentage rollout bucketing
- PostgreSQL is the only supported production database (SQLite for OSS dev only)
- All env vars prefixed with `PHASEFLAG_`
