# Self-Host Phase Flag in 5 Minutes with Docker

**Published April 4, 2024 · 6 min read**

---

Phase Flag is open source and designed to run on your own infrastructure. This post walks through spinning up a complete Phase Flag installation with Docker Compose, creating your first flag through the API, and evaluating it with the JavaScript and Python SDKs.

Prerequisites: Docker and Docker Compose installed. That is it.

## Step 1: Clone the Repository

```bash
git clone https://github.com/phaseflag/phaseflag
cd phaseflag
```

## Step 2: Start the Stack

The OSS Docker Compose configuration lives in `infra/docker/docker-compose.yml`. It starts three services: Postgres, the Phase Flag API, and the admin dashboard.

```bash
cd infra/docker
docker compose up -d
```

The first run pulls images and takes 30–60 seconds. After that:

```
✔ Container phaseflag-postgres-1   Started
✔ Container phaseflag-api-1        Started
✔ Container phaseflag-dashboard-1  Started
```

Verify everything is running:

```bash
docker compose ps
```

Expected output:

```
NAME                       STATUS    PORTS
phaseflag-postgres-1       running   5432/tcp
phaseflag-api-1            running   0.0.0.0:8000->8000/tcp
phaseflag-dashboard-1      running   0.0.0.0:3000->3000/tcp
```

The API is live at `http://localhost:8000`. The dashboard at `http://localhost:3000`.

## Step 3: Create an Admin Account and API Key

The API exposes a `/api/v1/auth/register` endpoint for the initial admin user. This endpoint is only available when no users exist in the database:

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your-secure-password",
    "name": "Admin"
  }' | jq .
```

Log in to get a JWT token:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-secure-password"}' \
  | jq -r '.access_token')
```

Create an environment (environments group flags by deployment stage):

```bash
ENV_ID=$(curl -s -X POST http://localhost:8000/api/v1/environments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "production", "description": "Production environment"}' \
  | jq -r '.id')
```

Create an API key for SDK authentication:

```bash
API_KEY=$(curl -s -X POST http://localhost:8000/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"prod-key\", \"environment_id\": \"$ENV_ID\"}" \
  | jq -r '.key')

echo "API Key: $API_KEY"
```

Save this key. Your SDKs will use it.

## Step 4: Create Your First Flag

```bash
curl -s -X POST http://localhost:8000/api/v1/flags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "new-dashboard",
    "name": "New Dashboard",
    "description": "Rolls out the redesigned dashboard UI",
    "environment_id": "'$ENV_ID'",
    "enabled": true,
    "rollout_percentage": 100
  }' | jq .
```

You now have a flag with key `new-dashboard` that is enabled for 100% of users in your production environment.

You can also manage flags through the dashboard at `http://localhost:3000`. Log in with the admin credentials you created above.

## Step 5: Evaluate the Flag with the JavaScript SDK

Install the SDK:

```bash
npm install @phaseflag/javascript
```

Evaluate the flag:

```typescript
import { PhaseFlag } from '@phaseflag/javascript'

const client = new PhaseFlag({
  apiKey: process.env.PHASEFLAG_API_KEY,    // the key from Step 3
  apiUrl: 'http://localhost:8000',           // your self-hosted API
  environment: 'production',
})

await client.initialize()

const user = {
  id: 'user-abc-123',
  email: 'test@example.com',
}

const showNewDashboard = await client.isEnabled('new-dashboard', user)
console.log('New dashboard enabled:', showNewDashboard)  // true

// With a payload — flags can carry JSON config alongside the boolean
const config = await client.getPayload('new-dashboard', user)
```

For a Node.js backend, the pattern is identical. Create the client once at startup, call `isEnabled` per request.

## Step 6: Evaluate the Flag with the Python SDK

Install the SDK:

```bash
pip install phaseflag
```

Evaluate the flag:

```python
import asyncio
import os
from phaseflag import PhaseFlag

async def main():
    client = PhaseFlag(
        api_key=os.environ["PHASEFLAG_API_KEY"],
        api_url="http://localhost:8000",
        environment="production",
    )
    await client.initialize()

    user = {
        "id": "user-abc-123",
        "email": "test@example.com",
    }

    enabled = await client.is_enabled("new-dashboard", user)
    print(f"New dashboard enabled: {enabled}")  # True

    await client.close()

asyncio.run(main())
```

For Django or FastAPI applications, initialize the client at application startup and inject it via dependency injection or a module-level singleton.

## What the docker-compose.yml Contains

For reference, the core services in the OSS Compose file:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: phaseflag
      POSTGRES_USER: phaseflag
      POSTGRES_PASSWORD: phaseflag
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  api:
    image: ghcr.io/phaseflag/api:latest
    environment:
      PHASEFLAG_DATABASE_URL: postgresql+asyncpg://phaseflag:phaseflag@postgres:5432/phaseflag
      PHASEFLAG_JWT_SECRET_KEY: change-me-in-production
      PHASEFLAG_API_SECRET_KEY: change-me-in-production
      PHASEFLAG_DEPLOYMENT_MODE: oss
    ports:
      - "8000:8000"
    depends_on:
      - postgres

  dashboard:
    image: ghcr.io/phaseflag/dashboard:latest
    environment:
      VITE_API_URL: http://localhost:8000
    ports:
      - "3000:3000"
    depends_on:
      - api
```

For production, replace the JWT and API secret keys with strong random values. Use a managed Postgres instance or a persistent Docker volume with regular backups. Put an nginx or Caddy reverse proxy in front to handle TLS termination.

## Going Further

A self-hosted Phase Flag installation with Docker Compose is production-ready for most teams. For larger scale deployments, we ship:

- **Kubernetes Helm chart** at `infra/k8s/helm/phaseflag/` — full values.yaml reference in the [docs](https://docs.phaseflag.com/deployment/kubernetes).
- **Terraform modules** at `infra/terraform/` — provision the full stack on AWS, GCP, or Azure.
- **Go relay proxy** — for edge evaluation at sub-millisecond latency, deploy the relay proxy alongside your application. It caches the ruleset locally and evaluates flags without hitting the API on each request.

The complete deployment documentation is at [docs.phaseflag.com](https://docs.phaseflag.com). The source code is at [github.com/phaseflag/phaseflag](https://github.com/phaseflag/phaseflag).

If you run into issues or have questions, open a GitHub issue. We read them all.
