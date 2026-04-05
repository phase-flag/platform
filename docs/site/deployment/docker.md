---
title: "Docker Compose"
description: "Run the full Phase Flag stack locally or on a server with Docker Compose."
---

# Docker Compose Setup

This page covers running Phase Flag with Docker Compose for local development or a simple single-server deployment.

For a production-grade self-hosted deployment with SSL and nginx, see [Self-Hosted (Production)](/deployment/self-hosted).

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

# Secrets — generate strong values for any non-local deployment
PHASEFLAG_JWT_SECRET_KEY=change-me-use-a-long-random-string
PHASEFLAG_API_SECRET_KEY=change-me-use-another-long-random-string

# CORS — comma-separated list of allowed origins
PHASEFLAG_CORS_ORIGINS=http://localhost:3000,http://localhost:5174

# Log level
PHASEFLAG_LOG_LEVEL=INFO
```

> **Never use the default secret values in production.** Generate strong secrets with `openssl rand -hex 32`.

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

Verify all containers are running:

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

You should see Alembic applying all migrations:

```
INFO  [alembic.runtime.migration] Running upgrade  -> abc123, initial schema
INFO  [alembic.runtime.migration] Running upgrade abc123 -> def456, add segments table
...
```

---

## 5. Access the Dashboard

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

Click **Register** and create your first user. On a fresh installation, the first user to register automatically receives the **admin** role.

From the dashboard you can:
- Create an organization and project
- Create feature flags
- Generate SDK API keys from **Settings → API Keys**

---

## 6. Verify the API

The interactive Swagger UI is available at:

```
http://localhost:8000/docs
```

Quick health check:

```bash
curl http://localhost:8000/health
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

### Stop and remove all data (full reset)

```bash
docker compose down -v
```

### Pull the latest images

```bash
docker compose pull
docker compose up -d
```

### Create a new Alembic migration (during development)

```bash
docker compose exec api alembic revision --autogenerate -m "add my table"
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `PHASEFLAG_DEPLOYMENT_MODE` | Yes | `oss`, `saas`, or `enterprise` |
| `PHASEFLAG_DATABASE_URL` | Yes | PostgreSQL connection string |
| `PHASEFLAG_JWT_SECRET_KEY` | Yes | Secret for signing JWT tokens |
| `PHASEFLAG_API_SECRET_KEY` | Yes | Secret for API key HMAC signing |
| `PHASEFLAG_CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `PHASEFLAG_LOG_LEVEL` | No | `DEBUG`, `INFO`, `WARNING`, `ERROR` (default: `INFO`) |
| `PHASEFLAG_SMTP_HOST` | No | SMTP host for password-reset emails |
| `PHASEFLAG_SMTP_PORT` | No | SMTP port (default: `587`) |
| `PHASEFLAG_FROM_EMAIL` | No | Sender address for transactional email |

---

## Troubleshooting

**API container exits immediately**

Check the logs:

```bash
docker compose logs api
```

Common causes:
- Missing or malformed `PHASEFLAG_DATABASE_URL`
- PostgreSQL not yet ready when API starts — wait a few seconds and retry

**Dashboard shows a blank screen**

1. Confirm the API is healthy: `curl http://localhost:8000/health`
2. Check the browser console for CORS errors — ensure `PHASEFLAG_CORS_ORIGINS` includes `http://localhost:3000`

**Database connection refused**

```bash
# Wait for the postgres container to be healthy before running migrations
docker compose ps postgres
# Wait for "Up (healthy)" status, then:
docker compose exec api alembic upgrade head
```
