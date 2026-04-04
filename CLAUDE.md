# Phase Flag Platform — Ralph Execution Context

You are the **Ralph execution agent** for the Phase Flag platform. You run as Claude Code (Sonnet model). Each invocation handles exactly ONE story from prd.json.

---

## Your Role

1. Read the current story's description and acceptance criteria (appended below this file)
2. Execute the work needed to satisfy every acceptance criterion
3. Update `prd.json` to set the story's `passes` field to `true`
4. Append a timestamped log entry to `progress.txt`
5. If ALL stories in prd.json now have `passes: true`, emit `<promise>COMPLETE</promise>`

---

## Project Structure

```
/Users/manav/Library/Mobile Documents/com~apple~CloudDocs/hextrot/phase-flag/
├── ralph.sh                        ← Loop orchestrator
├── CLAUDE.md                       ← This file
├── prd.json                        ← Stories, passes: true/false
├── progress.txt                    ← Accumulated log of completed work
├── prd.md                          ← Full PRD reference
│
├── core/
│   ├── api/                        ← FastAPI backend — Python 3.11 + Poetry
│   │   ├── phaseflag_api/          ← Main package (routers, services, models, repos, middleware)
│   │   ├── migrations/             ← Alembic migration versions
│   │   ├── pyproject.toml          ← fastapi 0.109, sqlalchemy 2.0, asyncpg, alembic, pyjwt
│   │   ├── alembic.ini
│   │   └── Dockerfile
│   │
│   ├── dashboard/                  ← Admin UI — React 18 + Vite + Tailwind 3 (port 3000)
│   │   ├── src/
│   │   │   ├── pages/              ← 25+ pages (Flags, Segments, Experiments, Webhooks, etc.)
│   │   │   ├── components/         ← Reusable UI (Layout, Modals, TargetingRuleBuilder, etc.)
│   │   │   ├── contexts/           ← AuthContext, EnvironmentContext, ToastContext
│   │   │   ├── hooks/
│   │   │   └── lib/api.ts          ← Axios API client
│   │   └── package.json            ← react@18, @tanstack/react-query@5, recharts, lucide-react
│   │
│   ├── cli/                        ← Go CLI (module: github.com/phaseflag/pfctl, Go 1.21)
│   │   ├── cmd/                    ← config, flags, evaluate, export, version commands
│   │   ├── main.go
│   │   └── go.mod
│   │
│   └── relay/                      ← Go edge proxy (module: github.com/phaseflag/relay)
│       ├── main.go / evaluator.go / cache.go / config.go
│       └── go.mod
│
├── sdks/                           ← All language SDK implementations
│   ├── javascript/                 ← TypeScript, tsup bundler
│   ├── python/                     ← pyproject.toml
│   ├── go/                         ← go.mod (github.com/phaseflag/go-sdk)
│   ├── rust/                       ← Cargo.toml
│   ├── java/                       ← Gradle
│   ├── dotnet/                     ← .NET 8
│   ├── php/                        ← Composer
│   ├── ios/                        ← Package.swift (Swift)
│   ├── react/                      ← npm (@phaseflag/react)
│   ├── angular/                    ← npm
│   ├── vue/                        ← npm
│   ├── svelte/                     ← npm
│   ├── solid/                      ← npm
│   ├── edge/                       ← npm (edge runtime)
│   └── openfeature/                ← OpenFeature providers (python, typescript)
│
├── enterprise/                     ← Python enterprise modules (conditionally loaded)
│   ├── analytics/                  ← Advanced flag analytics
│   ├── auth/                       ← SSO: SAML 2.0, OIDC, SCIM 2.0
│   ├── autonomous/
│   ├── compliance/
│   ├── counterfactual/
│   ├── experimentation/            ← Advanced A/B testing
│   ├── finops/                     ← Cost tracking
│   ├── governance/                 ← Change requests, approvals, freeze windows
│   ├── interactions/               ← Flag dependency graphs
│   ├── licensing/                  ← License validation & feature gating
│   ├── migration/
│   ├── simulation/
│   ├── verification/
│   └── router.py                   ← Enterprise FastAPI router aggregator
│
├── portal/                         ← SaaS portal — React 19 + Vite 7 + Tailwind 4 (port 5174)
├── marketing/                      ← Marketing site — React 19 + Vite 7 (port 5175)
├── showcase/                       ← Demo app
├── design/                         ← Brand assets, logos, favicons
│
├── infra/
│   ├── docker/
│   │   ├── docker-compose.yml          ← OSS dev (api:8000, dashboard:3000, postgres:5432)
│   │   ├── docker-compose.selfhosted.yml
│   │   └── docker-compose.enterprise.yml
│   ├── k8s/helm/phaseflag/         ← Helm chart (Chart.yaml, values.yaml, templates/)
│   ├── terraform/                  ← main.tf, resources/, examples/
│   └── ci/.github/workflows/       ← Source workflows (mirrored to root .github/workflows/)
│
├── .github/workflows/              ← Active GitHub Actions (copied from infra/ci/)
│   ├── api-ci.yml
│   ├── dashboard-ci.yml
│   ├── docker-publish.yml
│   ├── release.yml
│   └── sdk-ci.yml
│
├── docs/                           ← api/, api-reference/, architecture/, deployment/, sdk/
├── tools/                          ← import-export/, code-ref-scanner/, migration-tools/
├── tests/                          ← e2e/, integration/, sdk/ (stubs)
├── scripts/                        ← build/deployment scripts
└── scaffold/                       ← Generic SaaS scaffold templates (reference only, do not modify)
```

---

## Tech Stack

| Component | Technology | Notes |
|-----------|-----------|-------|
| API | Python 3.11 + FastAPI 0.109 | Poetry for deps, uvicorn server, port 8000 |
| ORM | SQLAlchemy 2.0 async + Alembic | asyncpg driver for Postgres |
| Database | PostgreSQL 16 | Docker in dev, managed in prod |
| Admin UI | React 18 + Vite + Tailwind 3 | @tanstack/react-query, recharts |
| Portal | React 19 + Vite 7 + Tailwind 4 | SaaS customer-facing portal, port 5174 |
| Marketing | React 19 + Vite 7 + Tailwind 4 | Public marketing site, port 5175 |
| CLI | Go 1.21 (zero deps) | module: github.com/phaseflag/pfctl |
| Relay | Go 1.21 | Edge evaluation proxy, port 8001 |
| Containers | Docker + Docker Compose | Multi-arch: linux/amd64, linux/arm64 |
| K8s | Helm chart (infra/k8s/helm/phaseflag/) | |
| IaC | Terraform | infra/terraform/ |

---

## Deployment Modes

The API supports three deployment modes via `PHASEFLAG_DEPLOYMENT_MODE`:

| Mode | Value | Features |
|------|-------|----------|
| OSS | `oss` | Core flag management, SQLite OK, no license required |
| SaaS | `saas` | + Multi-tenancy, billing, analytics |
| Enterprise | `enterprise` | + All enterprise/ modules, compliance, finops, SSO |

---

## Key Environment Variables

```bash
PHASEFLAG_DATABASE_URL=postgresql+asyncpg://phaseflag:PASSWORD@localhost:5432/phaseflag
PHASEFLAG_JWT_SECRET_KEY=<strong-secret>
PHASEFLAG_API_SECRET_KEY=<strong-secret>
PHASEFLAG_DEPLOYMENT_MODE=oss|saas|enterprise
PHASEFLAG_LICENSE_KEY=<enterprise-license>
PHASEFLAG_CORS_ORIGINS=https://app.phaseflag.io,https://portal.phaseflag.io
PHASEFLAG_LOG_LEVEL=INFO
PHASEFLAG_RELAY_API_KEY=<relay-key>
```

---

## Key Configuration Values

```
# Domains
API_DOMAIN=api.phaseflag.io
DASHBOARD_DOMAIN=app.phaseflag.io
PORTAL_DOMAIN=portal.phaseflag.io
MARKETING_DOMAIN=phaseflag.io
RELAY_DOMAIN=relay.phaseflag.io
DOCS_DOMAIN=docs.phaseflag.io

# Local development ports
core/api:       8000  (uvicorn)
core/dashboard: 3000  (vite dev)
portal:         5174  (vite dev)
marketing:      5175  (vite dev)
relay:          8001  (go run)
postgres:       5432

# GitHub
GITHUB_ORG=phaseflag

# Docker images (GHCR)
ghcr.io/phaseflag/api:latest
ghcr.io/phaseflag/relay:latest
ghcr.io/phaseflag/dashboard:latest

# CLI binary name
pfctl
```

---

## Available Tools (All Authenticated)

| Tool | Command | Purpose |
|------|---------|---------|
| GitHub CLI | `gh` | Create repos, set secrets, view workflows |
| Docker | `docker` / `docker compose` | Local + production containers |
| Python/Poetry | `poetry` | API dependency management |
| Node/npm | `npm` | Dashboard, portal, marketing builds |
| Go | `go` | CLI and relay builds |
| SSH | `ssh` | Access production server |
| Git | `git` | All version control |
| jq | `jq` | JSON processing for prd.json updates |

---

## Common Commands

### Start local development stack
```bash
cd infra/docker
docker compose up -d
```

### Run API locally (dev mode)
```bash
cd core/api
poetry install
poetry run uvicorn phaseflag_api.main:app --reload --port 8000
```

### Run Alembic migrations
```bash
cd core/api
poetry run alembic upgrade head
```

### Create a new Alembic migration
```bash
cd core/api
poetry run alembic revision --autogenerate -m "description"
```

### Build & run dashboard
```bash
cd core/dashboard
npm install
npm run dev     # dev server on port 3000
npm run build   # production build
```

### Build CLI binary
```bash
cd core/cli
go build -o pfctl .
```

### Run API tests
```bash
cd core/api
PHASEFLAG_DATABASE_URL=postgresql+asyncpg://phaseflag:phaseflag@localhost:5432/phaseflag_test \
PHASEFLAG_JWT_SECRET_KEY=test-secret \
PHASEFLAG_API_SECRET_KEY=test-api-secret \
poetry run pytest tests/ -v
```

---

## Story Execution Protocol

### Before starting
1. Read `progress.txt` — understand what has already been done
2. Check the current state of the relevant directories
3. Identify the exact files to create or modify

### While executing
- Make focused, precise changes — do NOT change functionality beyond what the story requires
- For stories that involve shell commands (gh, docker, ssh): run them via the Bash tool
- For infrastructure stories: capture outputs (IPs, URLs, etc.) and write them to `progress.txt`
- For code stories: run build/typecheck/test to verify before marking complete

### After completing
1. Verify EVERY acceptance criterion is met — check each one explicitly
2. Update prd.json: set the story's `passes` field to `true`:
   ```bash
   PARENT="/Users/manav/Library/Mobile Documents/com~apple~CloudDocs/hextrot/phase-flag"
   jq --arg id "US-XXX" '(.stories[] | select(.id == $id) | .passes) |= true' \
     "$PARENT/prd.json" > "$PARENT/prd.tmp" && mv "$PARENT/prd.tmp" "$PARENT/prd.json"
   ```
3. Append to progress.txt:
   ```
   ## [ISO timestamp] — US-XXX: Story Title — PASSED
   Changes: [list of files created/modified]
   Key values: [any IPs, URLs, secrets captured]
   Notes: [anything the next story should know]
   ```
4. Check if ALL stories pass: `jq '[.stories[] | select(.passes == false)] | length' prd.json`
5. If count is 0: emit `<promise>COMPLETE</promise>`

### Critical rules
- NEVER mark a story as passing if any acceptance criterion is unmet
- NEVER change existing functionality beyond what the story requires
- NEVER commit secrets to git — use .env files (gitignored)
- ALWAYS check that Docker containers are running before infra stories (`docker compose ps`)
- The API uses `PHASEFLAG_` prefix for ALL env vars
- Do NOT use Next.js — dashboard/portal/marketing are all Vite-based
- Do NOT use Drizzle or Prisma — this project uses SQLAlchemy + Alembic exclusively
- Do NOT use Fastify — the API is FastAPI (Python), not Node.js

---

## Current Working Directory

All paths in this project are relative to:
```
/Users/manav/Library/Mobile Documents/com~apple~CloudDocs/hextrot/phase-flag
```

---

## Story to Execute

(The current story's description and acceptance criteria are appended below by ralph.sh)
