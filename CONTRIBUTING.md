# Contributing to Phase Flag

Thank you for your interest in contributing! Phase Flag is an open-source feature flagging platform and we welcome contributions of all kinds — bug fixes, new features, documentation improvements, and SDK additions.

Please read this guide before opening a pull request so we can review and merge your work as quickly as possible.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Prerequisites](#prerequisites)
4. [Local Development](#local-development)
5. [Project Structure](#project-structure)
6. [Code Style](#code-style)
7. [Testing](#testing)
8. [Commit Message Format](#commit-message-format)
9. [Pull Request Process](#pull-request-process)
10. [SDK Contribution Guidelines](#sdk-contribution-guidelines)
11. [Release Process](#release-process)
12. [Getting Help](#getting-help)

---

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold it. Please report unacceptable behaviour to [conduct@phaseflag.com](mailto:conduct@phaseflag.com).

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/phaseflag.git
   cd phaseflag
   ```
3. **Add the upstream remote** so you can pull in future changes:
   ```bash
   git remote add upstream https://github.com/phase-flag/phaseflag.git
   ```
4. **Create a branch** for your work:
   ```bash
   git checkout -b feat/my-feature
   ```

---

## Prerequisites

| Tool | Minimum version | Purpose |
|------|----------------|---------|
| Docker Desktop | 4.x (includes `docker compose` v2) | Local stack |
| Node.js | 20 LTS | Dashboard, portal, marketing, JS/TS SDKs |
| Python | 3.11 | API backend, Python SDK |
| Go | 1.21 | CLI (`pfctl`), relay proxy, Go SDK |
| Poetry | 1.7+ | Python dependency management |
| `gh` (GitHub CLI) | any recent | Optional — helpful for PRs |

> **macOS:** Install via Homebrew — `brew install node python@3.11 go poetry gh`
>
> **Windows:** Use WSL 2 with Ubuntu 22.04 for the best experience.

---

## Local Development

### Full stack (recommended)

The easiest way to run everything is with Docker Compose:

```bash
# Copy the example env file and generate secrets
cp .env.example .env     # then edit .env if needed

# Start Postgres + API + Dashboard + Relay + Gateway
docker compose -f docker-compose.local.yml up -d

# Run Alembic database migrations (first time only)
docker compose -f docker-compose.local.yml exec api alembic upgrade head

# Verify the API is healthy
curl http://localhost:8000/health
# → {"status":"ok","version":"0.1.0","database":"connected"}
```

Service URLs once the stack is running:

| Service | URL |
|---------|-----|
| Admin dashboard | http://localhost:3000 |
| API (direct) | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Relay proxy | http://localhost:8001 |
| Portal | http://localhost:5174 |
| Marketing | http://localhost:5175 |
| PostgreSQL | localhost:5433 |

See [DEVELOPING.md](DEVELOPING.md) for detailed service commands, log tailing, and reset instructions.

### API only (without Docker)

```bash
cd core/api
poetry install
export PHASEFLAG_DATABASE_URL=postgresql+asyncpg://phaseflag:phaseflag@localhost:5433/phaseflag
export PHASEFLAG_JWT_SECRET_KEY=dev-secret
export PHASEFLAG_API_SECRET_KEY=dev-api-secret
export PHASEFLAG_DEPLOYMENT_MODE=oss
poetry run alembic upgrade head
poetry run uvicorn phaseflag_api.main:app --reload --port 8000
```

### Dashboard only

```bash
cd core/dashboard
npm install
npm run dev     # dev server on http://localhost:3000
```

### CLI

```bash
cd core/cli
go build -o pfctl .
./pfctl --help
```

---

## Project Structure

```
phase-flag/
├── core/api/           ← FastAPI backend (Python)
├── core/dashboard/     ← Admin UI (React 18 + Vite)
├── core/cli/           ← pfctl CLI (Go)
├── core/relay/         ← Edge proxy (Go)
├── sdks/               ← Language SDKs (JS, Python, Go, Rust, Java, …)
├── enterprise/         ← Enterprise-only modules (loaded when mode=enterprise)
├── portal/             ← SaaS portal (React 19)
├── marketing/          ← Marketing site (React 19)
├── docs/               ← Documentation source
├── infra/              ← Docker, Helm, Terraform
└── tests/              ← Integration + E2E tests
```

---

## Code Style

### Python (API + Python SDK)

We use **ruff** for linting and formatting. The config lives in `core/api/pyproject.toml`.

```bash
cd core/api
poetry run ruff check .           # lint
poetry run ruff format .          # format
poetry run mypy phaseflag_api/    # type-check
```

- Follow PEP 8 naming conventions.
- Annotate all public functions with type hints.
- Keep functions focused — prefer many small, well-named functions over large ones.
- Async all the way down in the API layer.

### JavaScript / TypeScript (Dashboard, Portal, SDKs)

We use **ESLint** + **Prettier**. Configs are in each package's directory.

```bash
# Dashboard
cd core/dashboard
npm run lint        # ESLint
npm run format      # Prettier

# JS SDK
cd sdks/javascript
npm run lint
npm run format
```

- Use TypeScript for all new code. Avoid `any` — use `unknown` and narrow properly.
- Prefer named exports over default exports.
- React components: use functional components with hooks. No class components.

### Go (CLI + Relay + Go SDK)

```bash
cd core/cli
gofmt -l .          # list files that need formatting
gofmt -w .          # format in place
go vet ./...        # static analysis
```

- Follow standard Go idioms (`errors.Is`, table-driven tests, etc.).
- Exported types and functions must have godoc comments.
- Avoid dependencies — the CLI is intentionally zero-dep.

---

## Testing

### API tests

```bash
cd core/api
PHASEFLAG_DATABASE_URL=sqlite+aiosqlite:///:memory: \
PHASEFLAG_JWT_SECRET_KEY=test-secret \
PHASEFLAG_API_SECRET_KEY=test-api-secret \
poetry run pytest tests/ -v
```

Integration tests live in `tests/integration/` and use an in-memory SQLite database so they require no running services.

### Dashboard tests

```bash
cd core/dashboard
npm test
```

### CLI / Relay tests

```bash
cd core/cli
go test ./...

cd core/relay
go test ./...
```

### SDK tests

Each SDK has its own test suite. Refer to the README in the relevant `sdks/<lang>/` directory for instructions.

### E2E tests

E2E tests in `tests/e2e/` require a running API server. They skip gracefully if the server is unavailable.

```bash
cd tests/e2e
PHASEFLAG_BASE_URL=http://localhost:8000 pytest -v
```

---

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

**Scope examples:** `api`, `dashboard`, `cli`, `relay`, `js-sdk`, `python-sdk`, `go-sdk`, `infra`, `docs`

**Examples:**

```
feat(api): add per-flag rate limiting endpoint
fix(js-sdk): handle network timeout on initialize()
docs(contributing): add SDK contribution guidelines
chore(ci): pin ruff to 0.3.x
```

Breaking changes must be noted with `!` after the type/scope and described in the footer:

```
feat(api)!: rename /flags endpoint to /feature-flags

BREAKING CHANGE: The /v1/flags endpoint has been renamed to /v1/feature-flags.
Clients must update their base URLs. A redirect shim will be removed in v1.0.
```

---

## Pull Request Process

1. **Ensure your branch is up to date** with `upstream/main`:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run the full test suite** and fix any failures before opening the PR.

3. **Open a PR** against `main` in the upstream repository. Fill out the PR template completely.

4. **Respond to review comments** promptly. Maintainers aim to review within 3 business days.

5. **Squash-merge** is the default merge strategy. Keep your commit history clean — the PR title becomes the squash commit message.

6. **One concern per PR.** Large PRs are harder to review and slower to merge. Split unrelated changes into separate PRs.

---

## SDK Contribution Guidelines

Phase Flag SDKs live in `sdks/<language>/`. Each SDK must:

- Implement `initialize(config)`, `evaluateFlag(key, context)`, `getAllFlags(context)`, and `close()`.
- Handle network failures gracefully (return the `defaultValue` / last-cached value, never throw).
- Support streaming updates via the `/v1/stream` SSE endpoint.
- Ship TypeScript types / language-appropriate type annotations.
- Include a `README.md` with a quick-start example.
- Pass the shared test matrix in `tests/sdk/`.

If you are adding a **new SDK language**, please open a discussion first so we can agree on the API surface before investing in implementation.

---

## Release Process

Phase Flag uses [Semantic Versioning](https://semver.org/).

1. Maintainers cut releases by pushing a version tag (`v0.4.0`, `v1.0.0`, etc.).
2. The `release.yml` GitHub Actions workflow builds CLI binaries, Docker images, and publishes SDKs to npm and PyPI automatically.
3. Release notes are drafted from the Conventional Commits log.

Contributors do not need to manage releases — just land your PR and it will be included in the next release.

---

## Getting Help

- **Documentation:** [docs.phaseflag.com](https://docs.phaseflag.com)
- **Q&A:** [GitHub Discussions — Q&A](https://github.com/phase-flag/phaseflag/discussions/categories/q-a)
- **Bug reports:** [GitHub Issues](https://github.com/phase-flag/phaseflag/issues)
- **Security issues:** See [SECURITY.md](SECURITY.md) — do NOT file public issues for vulnerabilities

Thank you for contributing to Phase Flag!
