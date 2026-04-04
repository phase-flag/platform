"""FastAPI application entry-point."""

import json
import logging
import sys
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from phaseflag_api import __version__
from phaseflag_api.config import DeploymentMode, settings
from phaseflag_api.database import create_tables
from phaseflag_api.middleware.error_handler import install_error_handlers
from phaseflag_api.middleware.license import get_license_info, init_license
from phaseflag_api.middleware.rate_limit import RateLimitMiddleware
from phaseflag_api.middleware.security_headers import SecurityHeadersMiddleware
from phaseflag_api.routers import (
    admin,
    analytics,
    audit,
    auth,
    billing,
    code_refs,
    developer,
    environments,
    evaluation,
    experiments,
    flags,
    governance,
    health,
    lifecycle,
    migrations,
    observability,
    pipelines,
    projects,
    remote_config,
    reporting,
    rollback,
    sdk,
    segments,
    sso,
    webhooks,
)


# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------


class _JsonFormatter(logging.Formatter):
    """Emit log records as single-line JSON for log aggregation (ELK, Loki, Datadog)."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            log_entry["request_id"] = record.request_id
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, default=str)


def _configure_logging() -> None:
    root = logging.getLogger()
    root.setLevel(settings.LOG_LEVEL.upper())
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())
    root.addHandler(handler)


_configure_logging()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Request correlation ID middleware
# ---------------------------------------------------------------------------


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach a unique request ID to every request for distributed tracing."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 1)

        response.headers["X-Request-ID"] = request_id

        if request.url.path != "/health":
            logger.info(
                "%s %s %s %sms",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
                extra={"request_id": request_id},
            )

        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Creating database tables ...")
    import phaseflag_api.models  # noqa: F401

    await create_tables()
    init_license()

    logger.info(
        "Phase Flag API v%s ready (mode=%s)",
        __version__,
        settings.DEPLOYMENT_MODE.value,
    )
    yield
    logger.info("Shutting down Phase Flag API")


_DESCRIPTION = """\
Phase Flag is an open-source feature flag management platform.

## Authentication

All endpoints (except `/health`) require an API key via:
- **Header**: `X-API-Key: <your-key>` or `Authorization: Bearer <your-key>`
"""

_TAGS_METADATA = [
    {
        "name": "flags",
        "description": "Create, read, update, toggle, archive, and delete feature flags.",
    },
    {
        "name": "segments",
        "description": "Manage reusable audience segments with targeting conditions.",
    },
    {
        "name": "sdk",
        "description": "SDK-facing endpoints for ruleset download, server-side evaluation, and event ingestion.",
    },
    {
        "name": "evaluation",
        "description": "Flag evaluation explainability and batch evaluation.",
    },
    {
        "name": "audit",
        "description": "Query the immutable audit log of all flag mutations.",
    },
    {
        "name": "analytics",
        "description": "Flag evaluation analytics aggregated by time period and variation.",
    },
    {
        "name": "webhooks",
        "description": "Configure webhooks that fire on flag lifecycle events.",
    },
    {
        "name": "auth",
        "description": "User registration, login, and session management.",
    },
    {
        "name": "lifecycle",
        "description": "Flag lifecycle management: stage transitions, stale detection, expiration.",
    },
    {"name": "projects", "description": "Organization and project management."},
    {
        "name": "environments",
        "description": "Environment management, cloning, and promotion.",
    },
    {
        "name": "governance",
        "description": "Change requests, approvals, freeze windows, service accounts.",
    },
    {
        "name": "pipelines",
        "description": "Progressive rollout pipelines with canary/blue-green templates.",
    },
    {
        "name": "rollback",
        "description": "Rollback rules and metric-triggered rollbacks.",
    },
    {
        "name": "remote_config",
        "description": "Typed remote configuration with schema validation.",
    },
    {
        "name": "experiments",
        "description": "A/B and multivariate experiments with statistical analysis.",
    },
    {
        "name": "migrations",
        "description": "Migration flags with staged workflow support.",
    },
    {
        "name": "code_refs",
        "description": "Code reference scanning and flag usage tracking.",
    },
    {
        "name": "observability",
        "description": "System metrics, flag health, and inventory.",
    },
    {
        "name": "developer",
        "description": "Developer workflow tools: test users, forced treatments, rollout simulation.",
    },
    {
        "name": "reporting",
        "description": "Analytics reports: stale flags, releases, drift, timelines, top flags.",
    },
    {
        "name": "admin",
        "description": "Platform-wide admin endpoints for SaaS operators.",
    },
    {"name": "health", "description": "Service health and readiness checks."},
    {
        "name": "sso",
        "description": "SSO configuration: SAML 2.0, OIDC, and SCIM 2.0 provisioning.",
    },
    {"name": "license", "description": "License and feature-gate information."},
]

app = FastAPI(
    title="Phase Flag API",
    description=_DESCRIPTION,
    version=__version__,
    lifespan=lifespan,
    openapi_tags=_TAGS_METADATA,
    contact={"name": "Phase Flag", "url": "https://phaseflag.dev"},
    license_info={
        "name": "Apache 2.0",
        "url": "https://www.apache.org/licenses/LICENSE-2.0",
    },
)

# -- Middleware (order matters: last added = first executed) --
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-API-Key",
        "X-PhaseFlag-Environment",
        "X-Request-ID",
        "If-None-Match",
    ],
)
app.add_middleware(RateLimitMiddleware, requests_per_minute=120)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIdMiddleware)

# -- Error handlers --
install_error_handlers(app)

# -- Auth Router (no auth required) --
app.include_router(auth.router, prefix="/api/v1", tags=["auth"])

# -- Core Routers --
app.include_router(health.router, tags=["health"])
app.include_router(flags.router, prefix="/api/v1", tags=["flags"])
app.include_router(segments.router, prefix="/api/v1", tags=["segments"])
app.include_router(sdk.router, prefix="/api/v1", tags=["sdk"])
app.include_router(evaluation.router, prefix="/api/v1", tags=["evaluation"])
app.include_router(lifecycle.router, prefix="/api/v1", tags=["lifecycle"])
app.include_router(audit.router, prefix="/api/v1", tags=["audit"])
app.include_router(webhooks.router, prefix="/api/v1", tags=["webhooks"])
app.include_router(analytics.router, prefix="/api/v1", tags=["analytics"])

# -- Multi-tenancy Routers --
app.include_router(projects.router, prefix="/api/v1", tags=["projects"])
app.include_router(environments.router, prefix="/api/v1", tags=["environments"])

# -- Governance Routers --
app.include_router(governance.router, prefix="/api/v1", tags=["governance"])

# -- SSO --
app.include_router(sso.router, prefix="/api/v1", tags=["sso"])

# -- Release Management Routers --
app.include_router(pipelines.router, prefix="/api/v1", tags=["pipelines"])
app.include_router(rollback.router, prefix="/api/v1", tags=["rollback"])

# -- Remote Config --
app.include_router(remote_config.router, prefix="/api/v1", tags=["remote_config"])

# -- Experimentation --
app.include_router(experiments.router, prefix="/api/v1", tags=["experiments"])

# -- Migration Flags --
app.include_router(migrations.router, prefix="/api/v1", tags=["migrations"])

# -- Code References --
app.include_router(code_refs.router, prefix="/api/v1", tags=["code_refs"])

# -- Observability --
app.include_router(observability.router, prefix="/api/v1", tags=["observability"])

# -- Developer Workflow --
app.include_router(developer.router, prefix="/api/v1", tags=["developer"])

# -- Reporting --
app.include_router(reporting.router, prefix="/api/v1", tags=["reporting"])

# -- Admin --
app.include_router(admin.router, prefix="/api/v1", tags=["admin"])

# -- Billing (SaaS) --
app.include_router(billing.router, prefix="/api/v1", tags=["billing"])

# -- License info endpoint --
app.add_api_route(
    "/api/v1/license/features",
    get_license_info,
    methods=["GET"],
    tags=["license"],
)

# -- Enterprise Routers (conditionally mounted) --
if settings.DEPLOYMENT_MODE != DeploymentMode.OSS:
    try:
        from phaseflag_api.routers.enterprise import router as enterprise_router

        app.include_router(enterprise_router, tags=["enterprise"])
        logger.info("Enterprise routers mounted")
    except ImportError:
        logger.warning(
            "Enterprise mode enabled but enterprise routers not found. Enterprise API endpoints will not be available."
        )
# CI verification 2026-04-04T04:30:48Z
