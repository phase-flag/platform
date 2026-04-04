# Phase Flag Architecture Overview

## System Architecture

Phase Flag follows a control-plane / data-plane architecture that separates flag management from flag evaluation.

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

## Components

### Control Plane (API)

The control plane is a FastAPI application that manages all flag configuration, targeting rules, and governance workflows. It is the single source of truth for flag state.

- **Technology**: Python 3.11, FastAPI, async SQLAlchemy 2.0, Pydantic v2
- **Database**: PostgreSQL (production), SQLite (development)
- **Authentication**: JWT tokens and API keys
- **Authorization**: Role-based access control (admin, editor, viewer)

Key responsibilities:
- Flag CRUD and lifecycle management
- Targeting rule configuration
- Segment management
- Audit logging
- Webhook notifications
- SSE streaming for real-time updates

### Data Plane (SDKs + Relay)

The data plane handles flag evaluation at the point of use. SDKs download a compiled ruleset from the control plane and evaluate flags locally for minimal latency.

**SDK Evaluation Flow:**
1. SDK initializes and fetches the ruleset from the control plane (or relay)
2. Ruleset is cached in memory
3. Flag evaluations happen locally using the cached ruleset
4. SDK polls for updates on a configurable interval (default: 30s)
5. Evaluation events are batched and sent back to the control plane

**Relay Proxy:**
- Sits between SDKs and the control plane
- Caches rulesets with configurable TTL
- Performs local evaluation for server-to-server use cases
- Buffers and forwards evaluation events
- Supports ETag-based conditional fetching

### Dashboard

The admin UI for managing flags, segments, experiments, and reviewing analytics.

- **Technology**: React 18, TypeScript, Vite, Tailwind CSS
- **State Management**: TanStack Query for server state
- **Routing**: React Router 6

### CLI (pfctl)

Command-line tool for developers and CI/CD pipelines.

- **Technology**: Go (stdlib only, no external dependencies)
- **Configuration**: `~/.phaseflag/config.json`
- **Output formats**: Table (human) and JSON (machine)

## Evaluation Engine

The evaluation engine is the core algorithm that determines which variation a user receives. It is implemented identically across the API, relay, and all SDKs.

### Algorithm

1. **Check prerequisites** -- if any prerequisite flag is not met, return the default variation
2. **Check flag status** -- if the flag is inactive or archived, return the default variation
3. **Evaluate targeting rules** by priority (lower number = higher priority)
4. **For each rule**: check all conditions using AND logic
5. **If conditions match**: serve the rule's variation or apply percentage rollout
6. **If no rules match**: serve the default variation
7. **Record evaluation event** with reason trace

### DJB2 Hashing

Percentage rollouts use the DJB2 hash function for deterministic bucketing:

```
hash = 5381
for each character c in "{flag_key}:{user_id}":
    hash = ((hash << 5) + hash + ord(c)) & 0xFFFFFFFF
bucket = hash % 100
```

This ensures:
- The same user always gets the same variation for a given flag
- Distribution is uniform across the 0-99 range
- Changing the flag key redistributes users

### Condition Operators

| Operator | Description |
|----------|-------------|
| `is` | Exact string equality |
| `is_not` | String inequality |
| `contains` | Substring match |
| `not_contains` | Substring absence |
| `one_of` | Value in list |
| `not_one_of` | Value not in list |
| `gt` | Numeric greater than |
| `lt` | Numeric less than |
| `matches_regex` | Regular expression match |
| `version_gt` | Semantic version greater than |
| `version_lt` | Semantic version less than |

## Data Model

### Core Entities

- **Organization**: Top-level tenant
- **Project**: Application or service within an organization
- **Environment**: Deployment target (development, staging, production)
- **Feature Flag**: Configuration that controls behavior
- **Variation**: A possible value a flag can return
- **Segment**: Reusable group of targeting conditions
- **Targeting Rule**: Conditions that determine which variation to serve

### Flag Lifecycle

```
development --> testing --> production --> stale --> archived --> deleted
```

### Flag Classifications

| Type | Purpose |
|------|---------|
| `release` | Feature releases, A/B tests |
| `experiment` | Experiments with statistical analysis |
| `ops_killswitch` | Operational controls, circuit breakers |
| `permission` | Feature entitlements, plan gating |
| `migration` | System migration orchestration |

## Security

- JWT tokens for dashboard/API authentication
- API keys for SDK and service-to-service authentication
- HMAC-SHA256 webhook signatures
- Role-based access control with resource-level permissions
- Audit logging for all mutations
- Environment freeze windows
- Break-glass emergency override workflow

## Deployment Options

1. **Docker Compose**: Single-machine deployment for development and small production
2. **Kubernetes (Helm)**: Production deployment with horizontal scaling
3. **Cloud Hosted**: Managed service at phaseflag.dev

## Licensing

- **Core** (`core/`): Apache License 2.0
- **Enterprise** (`enterprise/`): Business Source License 1.1
