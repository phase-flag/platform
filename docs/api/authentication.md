# API Authentication

Phase Flag supports two authentication methods: JWT tokens and API keys.

## JWT Tokens

Used by the dashboard and interactive clients.

### Register

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "name": "Jane Doe"
}
```

### Login

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 86400
}
```

### Using JWT Tokens

Include the token in the `Authorization` header:

```bash
GET /api/v1/flags
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Tokens expire after 24 hours by default (configurable via `PHASEFLAG_JWT_EXPIRE_HOURS`).

## API Keys

Used by SDKs, the CLI, CI/CD systems, and service-to-service communication.

### Types of API Keys

| Key Type | Format | Use Case |
|----------|--------|----------|
| Environment key | `pf_env_...` | SDK ruleset fetching, scoped to one environment |
| Service account | `pf_sa_...` | CI/CD and automation, configurable scopes |

### Using API Keys

Include the key in the `X-API-Key` header:

```bash
GET /api/v1/sdk/ruleset
X-API-Key: pf_env_abc123...
```

Or in the `Authorization` header:

```bash
GET /api/v1/sdk/ruleset
Authorization: Bearer pf_env_abc123...
```

### Service Accounts

Service accounts provide scoped, rotatable credentials for automated systems.

```bash
POST /api/v1/governance/service-accounts
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "name": "CI/CD Bot",
  "description": "GitHub Actions deployment pipeline",
  "role": "editor",
  "scopes": ["flags:read", "flags:write", "pipelines:write"]
}
```

## Roles and Permissions

| Role | Permissions |
|------|------------|
| `viewer` | Read flags, segments, analytics |
| `editor` | All viewer permissions + create/update/toggle flags |
| `admin` | All editor permissions + manage users, environments, governance |

## Security Best Practices

1. **Never commit API keys** to source control
2. **Rotate keys regularly**, especially after team member offboarding
3. **Use environment-scoped keys** for SDKs (least privilege)
4. **Use service accounts** for CI/CD instead of personal tokens
5. **Set `PHASEFLAG_JWT_SECRET_KEY`** in production (do not use defaults)
6. **Enable TLS** for all API traffic in production

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PHASEFLAG_JWT_SECRET_KEY` | Secret for signing JWT tokens | (auto-generated in prod) |
| `PHASEFLAG_JWT_ALGORITHM` | JWT signing algorithm | `HS256` |
| `PHASEFLAG_JWT_EXPIRE_HOURS` | Token expiration in hours | `24` |
| `PHASEFLAG_API_SECRET_KEY` | Secret for API key validation | (auto-generated in prod) |
