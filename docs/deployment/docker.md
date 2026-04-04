# Docker Deployment Guide

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2+

## Quick Start (Development)

```bash
cd phaseflag/infra/docker
docker compose up
```

This starts:
- **API** at `http://localhost:8000`
- **Dashboard** at `http://localhost:3000`
- **PostgreSQL** at `localhost:5432`

## Self-Hosted Production

### 1. Configure Environment

Create a `.env` file:

```bash
# Required
PHASEFLAG_JWT_SECRET_KEY=your-random-secret-at-least-32-chars
PHASEFLAG_API_SECRET_KEY=your-api-secret-at-least-32-chars
PHASEFLAG_DB_PASSWORD=strong-database-password

# Optional
PHASEFLAG_CORS_ORIGINS=https://your-domain.com
PHASEFLAG_LOG_LEVEL=INFO
PHASEFLAG_API_EXTERNAL_URL=https://api.your-domain.com
PHASEFLAG_RELAY_API_KEY=your-relay-api-key
```

Generate secure secrets:

```bash
openssl rand -base64 32  # For JWT_SECRET_KEY
openssl rand -base64 32  # For API_SECRET_KEY
openssl rand -base64 24  # For DB_PASSWORD
```

### 2. Start Services

```bash
cd phaseflag/infra/docker
docker compose -f docker-compose.selfhosted.yml up -d
```

This starts the API, relay proxy, dashboard, and PostgreSQL.

### 3. Verify

```bash
# Health check
curl http://localhost:8000/health

# Ready check
curl http://localhost:8000/ready

# Relay health
curl http://localhost:8081/health
```

### 4. Create Admin User

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "YourStrongPassword!", "name": "Admin"}'
```

## Enterprise Deployment

Enterprise deployment adds Redis and mounts the enterprise modules:

```bash
docker compose -f docker-compose.selfhosted.yml -f docker-compose.enterprise.yml up -d
```

Additional environment variables:
```bash
PHASEFLAG_LICENSE_KEY=your-license-key
PHASEFLAG_DEPLOYMENT_MODE=enterprise
```

## Custom Configuration

### Resource Limits

Edit the `deploy.resources` section in the compose file:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '2.0'
```

### External Database

To use an external PostgreSQL instance, remove the `db` service and set:

```bash
PHASEFLAG_DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/phaseflag
```

### TLS/HTTPS

Place a reverse proxy (nginx, Caddy, Traefik) in front of the API:

```yaml
services:
  proxy:
    image: caddy:2-alpine
    ports:
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
    depends_on:
      - api
```

### Backups

Back up the PostgreSQL data volume:

```bash
docker compose exec db pg_dump -U phaseflag phaseflag > backup.sql
```

Restore:

```bash
cat backup.sql | docker compose exec -T db psql -U phaseflag phaseflag
```

## Updating

```bash
# Pull latest images
docker compose pull

# Restart with new images
docker compose up -d

# Run migrations
docker compose exec api alembic upgrade head
```

## Troubleshooting

**API won't start**: Check database connectivity and environment variables.

```bash
docker compose logs api
```

**Database connection errors**: Ensure PostgreSQL is healthy.

```bash
docker compose ps db
docker compose exec db pg_isready -U phaseflag
```

**Relay can't reach API**: Verify the upstream URL and API key.

```bash
docker compose logs relay
curl http://localhost:8081/relay/stats
```
