---
title: "API Overview"
description: "The Phase Flag REST API — base URLs, authentication, rate limits, and response formats."
---

## Base URL

```
https://api.phaseflag.io/api/v1
```

For local development (OSS Docker):

```
http://localhost:8000/api/v1
```

All endpoints return JSON. All request bodies must use `Content-Type: application/json`.

---

## Authentication

The API supports two authentication methods:

### 1. Bearer Token (JWT)

Used for dashboard and user-facing operations. Obtain a token via [POST /auth/login](/api-reference/authentication).

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. SDK API Key

Used by SDKs and server-to-server integrations. Generated per environment in the dashboard under **Settings → API Keys**.

```http
X-API-Key: sdk-prod-xxxxxxxxxxxx
```

<Note>
  SDK API keys are scoped to a single environment. Use separate keys for development, staging, and production.
</Note>

---

## Rate Limiting

Rate limit information is returned in response headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `Retry-After` | Seconds to wait after a 429 response |

Default limits:

| Endpoint Category | Limit |
|-------------------|-------|
| Auth endpoints | 10 req/min per IP |
| Management API (JWT) | 1000 req/min per organization |
| Evaluation API (SDK key) | 10,000 req/min per environment |
| SDK ruleset fetch | 100 req/min per API key |

---

## Standard Response Format

### Success

```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 50,
    "total": 127
  }
}
```

List endpoints include a `meta` object with pagination info. Single-resource endpoints return the resource directly under `data`.

### Error

```json
{
  "error": {
    "code": "FLAG_NOT_FOUND",
    "message": "Feature flag 'my-flag' does not exist in environment 'production'.",
    "details": {}
  }
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200 OK` | Request succeeded |
| `201 Created` | Resource created |
| `204 No Content` | Deletion succeeded |
| `400 Bad Request` | Validation error — check `error.details` |
| `401 Unauthorized` | Missing or invalid credentials |
| `403 Forbidden` | Authenticated but insufficient permissions |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Duplicate resource (e.g., flag key already exists) |
| `422 Unprocessable Entity` | Semantic validation error |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Server-side error |

---

## Error Codes Reference

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `TOKEN_EXPIRED` | 401 | JWT has expired — re-authenticate |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role |
| `FLAG_NOT_FOUND` | 404 | Flag key does not exist |
| `ENVIRONMENT_NOT_FOUND` | 404 | Environment does not exist |
| `FLAG_KEY_CONFLICT` | 409 | Flag key already exists in this project |
| `VARIATION_COUNT_INVALID` | 422 | Boolean flags must have exactly 2 variations |
| `RULE_ROLLOUT_EXCEEDS_100` | 422 | Percentage allocations sum to more than 100 |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

---

## Pagination

List endpoints support cursor-based pagination:

```http
GET /api/v1/flags?page=2&per_page=50
```

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `page` | `1` | — | Page number |
| `per_page` | `50` | `200` | Items per page |

---

## Filtering and Sorting

```http
GET /api/v1/flags?environment_id=env_abc&status=active&sort=name&order=asc
```

---

## OpenAPI / Swagger

The interactive API documentation (Swagger UI) is available at:

```
https://api.phaseflag.io/docs
```

The raw OpenAPI 3.1 schema:

```
https://api.phaseflag.io/openapi.json
```

For local development:

```
http://localhost:8000/docs
http://localhost:8000/openapi.json
```
