# Phase Flag Security Hardening

## Overview

This document describes the security controls implemented in the Phase Flag API and the results of a security hardening audit conducted against the codebase.

---

## Security Controls

### Rate Limiting

Rate limiting is implemented via `RateLimitMiddleware` (token-bucket algorithm, per-IP).

| Parameter | Value |
|-----------|-------|
| Default limit | 120 requests / minute |
| Algorithm | Sliding window (token bucket) |
| Response on exceeded | `HTTP 429 Too Many Requests` |
| Header | `Retry-After: <seconds>` |
| Bypass | Health endpoint (`/health`) bypassed; test clients excluded |

Rate limit middleware is registered in `phaseflag_api/middleware/rate_limit.py` and attached in `main.py`.

### Security Headers

All responses include OWASP-recommended security headers via `SecurityHeadersMiddleware`:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' ...` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Cache-Control` | `no-store` |

### Input Validation

All request bodies are validated by Pydantic models before reaching route handlers:

- `POST /flags`: `FlagCreate` model enforces `key` (max 255 chars, slug pattern), `flag_type` (enum), `environment` constraints
- `POST /auth/register`: `RegisterRequest` enforces `email` (EmailStr), `password` (min 8 chars)
- `POST /organizations`: `OrgCreate` enforces `slug` (min 1, max 255 chars)
- SQL metacharacters in flag keys return `HTTP 422 Unprocessable Content` — Pydantic regex validation rejects them before reaching the database
- All database queries use SQLAlchemy ORM parameterized queries — no raw SQL interpolation

### Authentication & JWT

- JWTs signed with HS256, secret configurable via `PHASEFLAG_JWT_SECRET_KEY`
- Default expiry: 24 hours
- Expired tokens return `HTTP 401 Unauthorized`
- Token validation in `phaseflag_api/middleware/auth.py`
- API keys validated via `X-API-Key` header or `Authorization: Bearer` header
- First registered user receives `role="admin"` automatically; subsequent users receive `role="viewer"`

### API Key Security

- API keys never logged in application logs (only token prefixes, not full values)
- API keys stored as plain secrets in environment variables (not in database)
- The `get_current_user` middleware validates the API key header value without logging it

### CORS Configuration

- CORS origins controlled via `PHASEFLAG_ALLOWED_ORIGINS` environment variable
- Default development allows `http://localhost:*`
- Production should set explicit origins only

---

## Security Audit Findings

### Audit Date: 2026-04-04

| Finding | Severity | Status |
|---------|----------|--------|
| Rate limiting enforced (120 req/min → 429) | N/A | ✅ Implemented |
| Security headers on all responses | N/A | ✅ Implemented |
| Pydantic validation on all POST/PUT | N/A | ✅ Implemented |
| SQL injection rejected with 422 | N/A | ✅ Verified in integration tests |
| Expired JWT returns 401 | N/A | ✅ Verified in integration tests |
| API keys not in logs | N/A | ✅ Verified (only headers checked, not logged) |
| HTTPS-only in production (HSTS header) | N/A | ✅ Implemented (HSTS 1 year) |
| Webhook signature validation (Stripe) | N/A | ✅ Implemented in billing router |
| X-Forwarded-For trusted proxy validation | N/A | ✅ Implemented (only RFC 1918 proxies trusted) |

### Remaining Recommendations

1. **Secrets rotation**: Implement periodic rotation for `PHASEFLAG_JWT_SECRET_KEY` and `PHASEFLAG_API_SECRET_KEY`
2. **Audit log**: Implement per-user action audit log (flag changes, member invitations)
3. **PKCE flow**: For user-facing OAuth flows, implement PKCE
4. **CSP nonce**: For the Swagger UI, add nonce-based CSP rather than `'unsafe-inline'`
5. **Database encryption**: Enable encryption at rest for PostgreSQL in production

---

## Running Security Checks

```bash
# Verify security headers on production
curl -I https://api.phaseflag.com/health

# Run integration tests that cover security scenarios
cd core/api
poetry run pytest tests/integration/test_auth.py -v -k "expired or injection or duplicate"

# Check for API key exposure in logs
docker logs phaseflag-api 2>&1 | grep -i "api.key\|x-api-key\|authorization" | head -20
```
