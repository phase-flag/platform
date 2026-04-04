# Local Development Guide

## Prerequisites

- **Docker Desktop 4.x+** (includes the `docker compose` plugin)
- Minimum **4 GB RAM** allocated to Docker
- `openssl` (pre-installed on macOS/Linux, available via Git Bash on Windows)

---

## Quick start

```bash
./scripts/setup-local.sh
```

The script will:
1. Check that Docker and `openssl` are available
2. Copy `.env.example` to `.env` if it does not exist
3. Auto-generate `DB_PASSWORD`, `JWT_SECRET`, and `API_SECRET` secrets
4. Build and start all containers
5. Wait for the API health check to pass
6. Run Alembic database migrations
7. Print a URL summary

---

## Service URLs

| Service | Via Gateway (port 80) | Direct port |
|---|---|---|
| Dashboard | http://localhost/ | http://localhost:3000 |
| Portal | http://localhost/portal/ | http://localhost:5174 |
| Marketing | http://localhost/marketing/ | http://localhost:5175 |
| API | http://localhost/api/v1/ | http://localhost:8000 |
| API Docs (Swagger) | http://localhost/docs | http://localhost:8000/docs |
| Relay | http://localhost/relay/ | http://localhost:8081 |
| PostgreSQL | — | localhost:5433 |

---

## Changing configuration

1. Edit `.env` at the project root
2. Run:
   ```bash
   ./scripts/update-local.sh
   ```

The update script will prompt for confirmation, rebuild all images, and restart containers.

### When a rebuild is required vs not

| Change | Rebuild needed? |
|---|---|
| API/relay/db config (env vars only) | No — `docker compose -f docker-compose.local.yml up -d` is enough |
| `VITE_*` build args (frontend) | Yes — frontend images bake env vars at build time |
| Source code changes | Yes — rebuild the affected service |
| `.env` secrets (non-VITE) | No for frontends; `up -d` picks up new values for API/relay/db |

---

## Individual service commands

```bash
# Tail logs for a specific service
docker compose -f docker-compose.local.yml logs -f api
docker compose -f docker-compose.local.yml logs -f dashboard
docker compose -f docker-compose.local.yml logs -f gateway

# Restart a single service
docker compose -f docker-compose.local.yml restart api

# Rebuild a single service
docker compose -f docker-compose.local.yml build api
docker compose -f docker-compose.local.yml up -d api

# Open a shell in a running container
docker compose -f docker-compose.local.yml exec api bash

# Run a one-off command
docker compose -f docker-compose.local.yml exec api alembic upgrade head
```

---

## Resetting everything

To stop all containers and remove the database volume (full reset):

```bash
docker compose -f docker-compose.local.yml down -v
```

Then run `./scripts/setup-local.sh` again to start fresh.

To stop without removing data:

```bash
docker compose -f docker-compose.local.yml down
```
