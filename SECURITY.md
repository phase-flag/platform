# Security Policy

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in Phase Flag, please report it
responsibly:

1. **Email**: Send details to **security@phaseflag.com**
2. **GitHub Security Advisories**: Use the [Security tab](../../security/advisories/new)
   to report privately

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

| Action | Timeline |
|--------|----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 5 business days |
| Patch for critical issues | Within 7 days |
| Patch for non-critical issues | Within 30 days |
| Public disclosure | After patch is released |

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x (latest) | Yes |
| < 0.1.0 | No |

## Security Best Practices for Deployment

When deploying Phase Flag in production:

- **Secrets**: Generate strong secrets with `openssl rand -base64 32` for
  `JWT_SECRET`, `API_SECRET`, and `DB_PASSWORD`
- **CORS**: Set `PHASEFLAG_CORS_ORIGINS` to specific domains (never `*`)
- **HTTPS**: Always use TLS in production
- **Database**: Use a managed PostgreSQL instance with encrypted connections
- **Rate Limiting**: The API enforces 120 req/min per IP by default
- **Environment Variables**: Never commit `.env` files to version control
- **API Keys**: Rotate API keys regularly via the Dashboard
- **Updates**: Keep all dependencies updated for security patches

## Security Features

Phase Flag includes the following security measures:

- JWT authentication with HS256 signing and expiration
- Bcrypt password hashing (cost factor 12)
- Rate limiting (token-bucket, 120 req/min per IP)
- Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- Input validation via Pydantic models
- SQL injection protection via parameterized SQLAlchemy queries
- ReDoS protection in regex targeting rules
- Constant-time API key comparison (HMAC)
- Audit logging for all state-changing operations
