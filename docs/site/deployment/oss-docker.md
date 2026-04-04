---
title: "OSS Docker"
description: "Run the full Phase Flag stack locally with a single docker compose command."
---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 24+ with the Compose plugin
- `git` (to clone the repository)
- 2 GB RAM available for the stack

---

## 1. Clone the Repository

```bash
git clone https://github.com/phaseflag/phaseflag.git
cd phaseflag
```

---

## 2. Configure Environment Variables

```bash
cp infra/docker/.env.example infra/docker/.env
```

Open `infra/docker/.env` and set the required values:

```bash
# Deployment mode — use "oss" for the open-source stack
PHASEFLAG_DEPLOYMENT_MODE=oss

# Database connection (the docker-compose service name is "postgres")
PHASEFLAG_DATABASE_URL=postgresql+asyncpg://phaseflag:phaseflag@postgres:5432/phaseflag

# Secrets — change these before exposing to the network
PHASEFLAG_JWT_SECRET_KEY=change-me-use-a-long-random-string
PHASEFLAG_API_SECRET_KEY=change-me-use-another-long-random-string

# CORS — comma-separated list of allowed origins
PHASEFLAG_CORS_ORIGINS=http://localhost:3000,http://localhost:5174

# Log level
PHASEFLAG_LOG_LEVEL=INFO
```

<Warning>
  Never use the default secret values in a production or internet-facing deployment. Generate strong secrets with `openssl rand -hex 32`.
</Warning>

---

## 3. Start the Stack

```bash
cd infra/docker
docker compose up -d
```

This starts three services:

| Service | Port | Description |
|---------|------|-------------|
| `api` | 8000 | FastAPI control plane |
| `dashboard` | 3000 | React admin UI |
| `postgres` | 5432 | PostgreSQL 16 database |

Check that all containers are running:

```bash
docker compose ps
```

Expected output:
```
NAME                STATUS          PORTS
phaseflag-api       Up (healthy)    0.0.0.0:8000->8000/tcp
phaseflag-dashboard Up              0.0.0.0:3000->3000/tcp
phaseflag-postgres  Up (healthy)    0.0.0.0:5432->5432/tcp
```

---

## 4. Run Database Migrations

```bash
docker compose exec api alembic upgrade head
```

This applies all Alembic migrations to create the database schema. You should see output like:

```
INFO  [alembic.runtime.migration] Running upgrade  -> abc123, initial schema
INFO  [alembic.runtime.migration] Running upgrade abc123 -> def456, add segments table
...
```

---

## 5. Access the Dashboard

Open [http://localhost:3000](http://localhost:3000) in your browser.

Click **Register** and create your first user account. On a fresh installation, the first user to register automatically receives the **admin** role.

You can now:
- Create an organization and project
- Create feature flags
- Generate SDK API keys from **Settings → API Keys**

---

## 6. Access the API

The API is available at `http://localhost:8000`. The interactive Swagger UI is at:

```
http://localhost:8000/docs
```

---

## 7. Verify with a curl Request

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "changeme123", "full_name": "Admin"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "changeme123"}'
```

---

## Managing the Stack

### View logs

```bash
docker compose logs -f api
docker compose logs -f dashboard
```

### Stop the stack

```bash
docker compose down
```

### Stop and remove volumes (full reset)

```bash
docker compose down -v
```

### Pull the latest images

```bash
docker compose pull
docker compose up -d
```

### Create a new Alembic migration (development)

```bash
docker compose exec api alembic revision --autogenerate -m "add my table"
```

---

## Troubleshooting

**API container exits immediately**

Check the logs:
```bash
docker compose logs api
```

Common causes:
- Missing or malformed `PHASEFLAG_DATABASE_URL`
- PostgreSQL not yet ready when API starts (retry in a few seconds — the healthcheck handles this automatically)

**Dashboard shows a blank screen**

1. Confirm the API is healthy: `curl http://localhost:8000/health`
2. Check the browser console for CORS errors — ensure `PHASEFLAG_CORS_ORIGINS` includes `http://localhost:3000`

**Database connection refused**

Ensure the `postgres` container is healthy before running migrations:
```bash
docker compose ps postgres
# Wait for "Up (healthy)" status
```
