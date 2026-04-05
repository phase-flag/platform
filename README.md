# Phase Flag

**Production-grade feature flagging SaaS** — OSS, Self-Hosted, and Enterprise deployment modes.

Phase Flag is a complete feature flagging platform with a FastAPI control plane, multi-language SDKs, an admin dashboard, SaaS portal, Go edge relay, and enterprise modules for SSO, governance, experimentation, and compliance.

---

## What's in this repo

```
phase-flag/                         ← Master product monorepo
│
├── core/api/                       ← FastAPI backend (Python 3.11, SQLAlchemy 2.0, Alembic)
├── core/dashboard/                 ← Admin UI (React 18 + Vite, Tailwind 3)
├── core/cli/                       ← pfctl CLI (Go 1.21, zero deps)
├── core/relay/                     ← Edge evaluation proxy (Go 1.21)
│
├── sdks/                           ← 13+ language SDKs
│   ├── javascript/                 ← @phaseflag/js-sdk (TypeScript)
│   ├── python/                     ← phaseflag-sdk (PyPI)
│   ├── go/                         ← github.com/phaseflag/go-sdk
│   ├── react/                      ← @phaseflag/react (useFlag hook)
│   ├── rust/, java/, dotnet/, php/ ← Additional language SDKs
│   ├── angular/, vue/, svelte/     ← Framework SDKs
│   └── openfeature/                ← OpenFeature providers (Python, TypeScript)
│
├── enterprise/                     ← Enterprise modules (loaded when mode=enterprise)
│   ├── auth/                       ← SAML 2.0, OIDC, SCIM 2.0
│   ├── governance/                 ← Change requests, approvals, freeze windows
│   ├── experimentation/            ← Advanced A/B testing with statistics
│   ├── analytics/                  ← Advanced flag analytics
│   ├── compliance/                 ← SOC 2, audit exports
│   └── finops/                     ← Cost tracking per project
│
├── portal/                         ← SaaS portal (React 19 + Vite 7)
├── marketing/                      ← Marketing site (React 19 + Vite 7)
├── showcase/                       ← Interactive demo app
│
├── infra/docker/                   ← Docker Compose (OSS, self-hosted, enterprise)
├── infra/k8s/helm/                 ← Kubernetes Helm chart
├── infra/terraform/                ← Terraform IaC
│
├── docs/                           ← Documentation source
├── tools/                          ← Migration tools (LaunchDarkly, Unleash, Flagsmith)
│
├── CLAUDE.md                       ← Ralph agent execution context
├── prd.json                        ← Story deck (35 stories across 7 phases)
├── progress.txt                    ← Append-only execution log
├── ralph.sh                        ← Story execution orchestrator
└── scaffold/                       ← Generic SaaS scaffold templates (reference only)
```

---

## Deployment Modes

| Mode | `PHASEFLAG_DEPLOYMENT_MODE` | Use case |
|------|--------------------------|---------|
| OSS | `oss` | Self-hosted, SQLite OK, no license required |
| SaaS | `saas` | Cloud-hosted multi-tenant service |
| Enterprise | `enterprise` | Self-hosted with SSO, governance, compliance |

---

## Quick Start (OSS / Local Dev)

**Prerequisites:** Docker, Docker Compose v2, Poetry, Node.js 20+, Go 1.21+

```bash
# Start Postgres + API + Dashboard
cd infra/docker
docker compose up -d

# Run database migrations
cd ../../core/api
poetry install
poetry run alembic upgrade head

# Verify
curl http://localhost:8000/health
# → {"status":"ok","mode":"oss"}

# Dashboard UI
open http://localhost:3000
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| API | Python 3.11 + FastAPI 0.109 + SQLAlchemy 2.0 + Alembic |
| Database | PostgreSQL 16 (asyncpg driver) |
| Admin UI | React 18 + Vite + Tailwind CSS 3 |
| Portal/Marketing | React 19 + Vite 7 + Tailwind CSS 4 |
| CLI | Go 1.21 (zero external dependencies) |
| Relay proxy | Go 1.21 |
| Containers | Docker + Docker Compose v2 |
| Kubernetes | Helm chart (infra/k8s/helm/phaseflag/) |
| IaC | Terraform (infra/terraform/) |

---

## Domains

| Domain | Service |
|--------|---------|
| `api.phaseflag.com` | FastAPI backend |
| `relay.phaseflag.com` | Go edge relay proxy |
| `app.phaseflag.com` | Admin dashboard |
| `portal.phaseflag.com` | SaaS customer portal |
| `phaseflag.com` | Marketing site |
| `docs.phaseflag.com` | Documentation |

---

## Running with Ralph (AI Story Execution)

Phase Flag uses the **Ralph** pattern — an AI agent that reads stories from `prd.json` and executes them one at a time.

```bash
# Run next story
./ralph.sh

# Run a specific story
./ralph.sh --story US-006

# Preview next story without executing
./ralph.sh --dry-run
```

See `prd.json` for the full 35-story roadmap across 7 phases: Migration, GitHub/CI, Production Infra, SaaS Billing, SDK Publishing, Docs, and QA.

---

## SDK Usage (JavaScript)

```bash
npm install @phaseflag/js-sdk
```

```typescript
import { PhaseFlag } from '@phaseflag/js-sdk';

const client = new PhaseFlag({ apiKey: 'your-api-key' });
await client.initialize();

const enabled = client.evaluateFlag('my-feature', { userId: 'user-123' });
```

---

## Prerequisites

- `gh` — GitHub CLI (authenticated)
- `vercel` — Vercel CLI (authenticated)
- `doctl` — DigitalOcean CLI (authenticated)
- `docker` + `docker compose` v2
- `poetry` — Python dependency manager
- `npm`, `node` v20+
- `go` 1.21+
- SSH key at `~/.ssh/id_ed25519` (added to DigitalOcean)
