# OSS Docker Deployment

Run the full Phase Flag stack on any machine with Docker installed.

## Prerequisites

- Docker 24+ with Compose plugin
- `git`
- 2 GB available RAM

## Quick Start

```bash
# Clone
git clone https://github.com/phaseflag/phaseflag.git
cd phaseflag/infra/docker

# Configure
cp .env.example .env
# Edit .env: set PHASEFLAG_DEPLOYMENT_MODE=oss and change the secret keys

# Start
docker compose up -d

# Migrate
docker compose exec api alembic upgrade head
```

Access the dashboard at **http://localhost:3000**. Register the first user (becomes admin automatically).

## .env Minimum Configuration

```bash
PHASEFLAG_DEPLOYMENT_MODE=oss
PHASEFLAG_DATABASE_URL=postgresql+asyncpg://phaseflag:phaseflag@postgres:5432/phaseflag
PHASEFLAG_JWT_SECRET_KEY=change-me-32-chars-minimum
PHASEFLAG_API_SECRET_KEY=change-me-32-chars-minimum
PHASEFLAG_CORS_ORIGINS=http://localhost:3000
```

## Services

| Service | Port | URL |
|---------|------|-----|
| API | 8000 | http://localhost:8000 |
| Dashboard | 3000 | http://localhost:3000 |
| PostgreSQL | 5432 | postgresql://localhost:5432 |

## Common Commands

```bash
# View logs
docker compose logs -f api

# Stop
docker compose down

# Full reset (deletes database)
docker compose down -v

# Pull latest images
docker compose pull && docker compose up -d
```

## Full Documentation

See [docs.phaseflag.io/deployment/oss-docker](https://docs.phaseflag.io/deployment/oss-docker) for troubleshooting, relay proxy setup, and production hardening.
