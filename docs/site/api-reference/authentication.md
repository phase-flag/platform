---
title: "Authentication"
description: "Register, log in, and manage your session with the Phase Flag API."
---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Create a new user account |
| `POST` | `/auth/login` | Obtain a JWT access token |
| `GET` | `/auth/me` | Get the authenticated user's profile |
| `POST` | `/auth/refresh` | Refresh an expired access token |
| `POST` | `/auth/logout` | Invalidate the current token |

---

## POST /auth/register

Create a new user account. On a fresh OSS installation, the first user to register automatically receives the `admin` role.

### Request

```bash
curl -X POST https://api.phaseflag.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "super-secret-password-123",
    "full_name": "Alice Smith"
  }'
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `password` | string | Yes | Minimum 8 characters |
| `full_name` | string | No | Display name |

### Response `201 Created`

```json
{
  "data": {
    "id": "usr_01HXKQ4R9C2BVNZFM5T7WE6J8D",
    "email": "alice@example.com",
    "full_name": "Alice Smith",
    "role": "admin",
    "created_at": "2026-04-04T12:00:00Z"
  }
}
```

### Error Responses

```json
// 409 Conflict — email already registered
{
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "An account with this email address already exists."
  }
}
```

---

## POST /auth/login

Exchange credentials for a JWT access token.

### Request

```bash
curl -X POST https://api.phaseflag.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "super-secret-password-123"
  }'
```

### Response `200 OK`

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfMDFIWEtRNFI5QzJCVk5aRk01VDdXRTZKOEQiLCJleHAiOjE3NDM4NzM2MDB9.abc123",
    "token_type": "bearer",
    "expires_in": 86400,
    "refresh_token": "rt_01HXKR7M2P3QNZFVM6T8WE9J0E"
  }
}
```

| Field | Description |
|-------|-------------|
| `access_token` | JWT — include in `Authorization: Bearer <token>` header |
| `expires_in` | Seconds until the access token expires (default: 24h) |
| `refresh_token` | Opaque token for refreshing the access token |

### Error Responses

```json
// 401 Unauthorized — wrong credentials
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "The email or password you provided is incorrect."
  }
}
```

---

## GET /auth/me

Return the profile of the currently authenticated user.

### Request

```bash
curl https://api.phaseflag.com/api/v1/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response `200 OK`

```json
{
  "data": {
    "id": "usr_01HXKQ4R9C2BVNZFM5T7WE6J8D",
    "email": "alice@example.com",
    "full_name": "Alice Smith",
    "role": "admin",
    "created_at": "2026-04-04T12:00:00Z",
    "last_login_at": "2026-04-04T14:30:00Z",
    "organizations": [
      {
        "id": "org_01HXKQ5A8D3CVNZGM6U8XF7K9E",
        "name": "Acme Corp",
        "role": "admin"
      }
    ]
  }
}
```

---

## POST /auth/refresh

Obtain a new access token using a refresh token.

### Request

```bash
curl -X POST https://api.phaseflag.com/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "rt_01HXKR7M2P3QNZFVM6T8WE9J0E"}'
```

### Response `200 OK`

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 86400
  }
}
```

---

## POST /auth/logout

Invalidate the current access token and refresh token.

### Request

```bash
curl -X POST https://api.phaseflag.com/api/v1/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response `204 No Content`

---

## Using API Keys

For machine-to-machine authentication (SDKs, CI/CD, server code), use an SDK API Key instead of JWT tokens. Generate one in the dashboard under **Settings → API Keys**.

```bash
curl https://api.phaseflag.com/api/v1/sdk/ruleset \
  -H "X-API-Key: sdk-prod-xxxxxxxxxxxx"
```

API keys are:
- Scoped to a single environment
- Revocable individually without affecting other keys
- Prefixed with the environment type (`sdk-dev-`, `sdk-staging-`, `sdk-prod-`)
