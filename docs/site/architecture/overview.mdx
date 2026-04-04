---
title: "Architecture Overview"
description: "How Phase Flag separates flag management (control plane) from flag evaluation (data plane) for reliability and performance."
---

## System Architecture

Phase Flag follows a **control-plane / data-plane** architecture that separates flag management from flag evaluation.

```
                                    +-------------------+
                                    |    Dashboard      |
                                    |   (React + TS)    |
                                    +---------+---------+
                                              |
                                              | REST API
                                              v
+-------------------+         +-------------------+         +-------------------+
|  CLI (pfctl)      |-------->|   Control Plane   |<--------|   CI/CD Plugins   |
+-------------------+   API   |   (FastAPI)       |   API   +-------------------+
                              +---------+---------+
                                        |
                              +---------+---------+
                              |                   |
                              v                   v
                    +---------+-----+   +---------+-----+
                    |  PostgreSQL   |   |  Relay Proxy  |
                    |  (Neon/self)  |   |  (Go)         |
                    +---------------+   +-------+-------+
                                                |
                        +-----------+-----------+-----------+
                        |           |           |           |
                        v           v           v           v
                    +-------+   +-------+   +-------+   +-------+
                    | SDK   |   | SDK   |   | SDK   |   | SDK   |
                    | (JS)  |   | (Py)  |   | (Go)  |   | (Java)|
                    +-------+   +-------+   +-------+   +-------+
                        |           |           |           |
                    +-------+   +-------+   +-------+   +-------+
                    | App 1 |   | App 2 |   | App 3 |   | App 4 |
                    +-------+   +-------+   +-------+   +-------+
```

---

## Components

### Control Plane (API)

The control plane is a FastAPI application that manages all flag configuration, targeting rules, and governance workflows. It is the **single source of truth** for flag state.

**Technology stack:**
- Python 3.11, FastAPI 0.109, async SQLAlchemy 2.0, Pydantic v2
- PostgreSQL 16 (production), SQLite (development / OSS)
- JWT tokens and API keys for authentication
- Role-based access control: `admin`, `editor`, `viewer`

**Key responsibilities:**
- Flag CRUD and lifecycle management
- Targeting rule configuration and segment management
- Audit logging for all mutations (actor, timestamp, before/after diff)
- Webhook notifications on flag state changes
- Server-Sent Events (SSE) streaming for real-time ruleset distribution
- Alembic migrations for schema evolution

### Data Plane (SDKs + Relay)

The data plane handles flag evaluation at the point of use. SDKs download a **compiled ruleset** from the control plane and evaluate flags **locally** for sub-millisecond latency.

#### SDK Evaluation Flow

1. SDK initializes and fetches the ruleset from the control plane (or relay proxy)
2. Ruleset is cached in memory
3. Flag evaluations happen **locally** using the cached ruleset — no network I/O
4. SDK polls for ruleset updates on a configurable interval (default: 30s)
5. Evaluation events are batched and sent back to the control plane asynchronously

#### Relay Proxy

- Written in Go — minimal memory footprint, handles 50,000+ concurrent SDK connections
- Sits between SDKs and the control plane
- Caches rulesets with configurable TTL — reduces control plane load by orders of magnitude
- Performs local evaluation for server-to-server use cases
- Buffers and forwards evaluation events
- Supports ETag-based conditional fetching for bandwidth efficiency

### Dashboard

The admin UI for managing flags, segments, experiments, and reviewing analytics.

- **Technology**: React 18, TypeScript, Vite, Tailwind CSS 3
- **State Management**: TanStack Query for server state
- **Routing**: React Router 6
- **Charts**: Recharts

### CLI (pfctl)

Command-line tool for developers and CI/CD pipelines.

- **Technology**: Go 1.21 (zero external dependencies)
- **Configuration**: `~/.phaseflag/config.json`
- **Output formats**: Table (human-readable) and JSON (machine-readable)
- **Commands**: `config`, `flags`, `evaluate`, `export`, `version`

---

## Evaluation Engine

The evaluation engine is the core algorithm that determines which variation a user receives. It is implemented identically in the API, relay proxy, and all SDKs.

### Algorithm

1. **Check prerequisites** — if any prerequisite flag is not satisfied, return the default variation
2. **Check flag status** — if the flag is inactive or archived, return the default variation
3. **Evaluate targeting rules** in priority order (lower number = higher priority)
4. **For each rule**: evaluate all conditions with AND logic
5. **If conditions match**: serve the rule's variation, or apply percentage rollout
6. **If no rules match**: serve the default variation
7. **Record evaluation event** with reason trace

### DJB2 Hashing for Percentage Rollouts

Percentage rollouts use the DJB2 hash function for deterministic, uniform bucketing:

```
hash = 5381
for each character c in "{flag_key}:{user_key}":
    hash = ((hash << 5) + hash + ord(c)) & 0xFFFFFFFF
bucket = hash % 100
```

This ensures:
- The same user always receives the same variation for a given flag
- Distribution is statistically uniform across the 0-99 range
- Changing the flag key redistributes users (useful for experiment resets)

### Condition Operators

| Operator | Description |
|----------|-------------|
| `is` | Exact string equality |
| `is_not` | String inequality |
| `contains` | Substring match |
| `not_contains` | Substring absence |
| `one_of` | Value is in a list |
| `not_one_of` | Value is not in a list |
| `gt` | Numeric greater than |
| `lt` | Numeric less than |
| `matches_regex` | Regular expression match |
| `version_gt` | Semantic version greater than |
| `version_lt` | Semantic version less than |

---

## Data Model

### Core Entities

| Entity | Description |
|--------|-------------|
| **Organization** | Top-level tenant (e.g., a company) |
| **Project** | An application or service within an organization |
| **Environment** | Deployment target: `development`, `staging`, `production` |
| **Feature Flag** | A named configuration that controls behavior |
| **Variation** | One possible value a flag can return |
| **Segment** | Reusable set of targeting conditions |
| **Targeting Rule** | Ordered conditions that determine which variation to serve |

### Flag Lifecycle

```
draft → active → stale → archived → deleted
```

- **draft**: Being configured, not yet live
- **active**: Serving traffic in at least one environment
- **stale**: Rolled out to 100%, pending cleanup
- **archived**: Soft-deleted, preserved in audit log
- **deleted**: Permanently removed (admin-only)

### Flag Classifications

| Classification | Purpose |
|----------------|---------|
| `release` | Feature releases, progressive rollouts |
| `experiment` | A/B tests with statistical analysis |
| `ops_killswitch` | Circuit breakers, operational controls |
| `permission` | Feature entitlements, plan gating |
| `migration` | Database or API migration orchestration |

---

## Database

- **Engine**: PostgreSQL 16 (primary) — async driver via `asyncpg`
- **ORM**: SQLAlchemy 2.0 (async session)
- **Migrations**: Alembic — versioned, auto-generated from model changes
- **Development**: SQLite supported for quick local setup without Docker

---

## Deployment Modes

| Mode | `PHASEFLAG_DEPLOYMENT_MODE` | Features |
|------|---------------------------|----------|
| **OSS** | `oss` | Core flag management, no license required |
| **SaaS** | `saas` | + Multi-tenancy, billing integration, analytics |
| **Enterprise** | `enterprise` | + SSO (SAML/OIDC/SCIM), compliance, finops, governance, advanced experiments |

Enterprise modules live in `enterprise/` and are loaded conditionally by `enterprise/router.py` when the deployment mode is set to `enterprise` and a valid license key is provided.

---

## Security

- JWT tokens for dashboard and user authentication (HS256, configurable expiry)
- API keys for SDK and service-to-service authentication (scoped per environment)
- HMAC-SHA256 signatures on all outbound webhooks
- Role-based access control with resource-level permissions (`admin`, `editor`, `viewer`)
- Complete audit log for all mutations
- Environment **freeze windows** — block changes during critical periods
- **Break-glass** emergency override workflow with mandatory justification

---

## Licensing

| Component | License |
|-----------|---------|
| `core/` | Apache License 2.0 |
| `sdks/` | Apache License 2.0 |
| `enterprise/` | Business Source License 1.1 (BSL) |
