"""OpenTelemetry middleware — structured request tracing and metrics."""

import logging
import time
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# In-memory metrics counters
_metrics: dict[str, Any] = {
    "requests_total": 0,
    "requests_by_method": {},
    "requests_by_status": {},
    "requests_by_path": {},
    "latency_sum_ms": 0.0,
    "latency_count": 0,
}


def get_metrics() -> dict[str, Any]:
    """Return current metrics snapshot."""
    avg_latency = _metrics["latency_sum_ms"] / _metrics["latency_count"] if _metrics["latency_count"] > 0 else 0.0
    return {
        **_metrics,
        "avg_latency_ms": round(avg_latency, 2),
    }


def reset_metrics() -> None:
    """Reset all metrics counters."""
    _metrics["requests_total"] = 0
    _metrics["requests_by_method"] = {}
    _metrics["requests_by_status"] = {}
    _metrics["requests_by_path"] = {}
    _metrics["latency_sum_ms"] = 0.0
    _metrics["latency_count"] = 0


class TelemetryMiddleware(BaseHTTPMiddleware):
    """Collect request metrics and add trace headers."""

    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()

        response = await call_next(request)

        duration_ms = (time.monotonic() - start) * 1000

        # Update metrics
        _metrics["requests_total"] += 1
        method = request.method
        _metrics["requests_by_method"][method] = _metrics["requests_by_method"].get(method, 0) + 1

        status_code = str(response.status_code)
        _metrics["requests_by_status"][status_code] = _metrics["requests_by_status"].get(status_code, 0) + 1

        # Track by path pattern (first 2 segments to avoid cardinality explosion)
        path = request.url.path
        path_parts = path.strip("/").split("/")[:3]
        path_key = "/" + "/".join(path_parts) if path_parts else "/"
        _metrics["requests_by_path"][path_key] = _metrics["requests_by_path"].get(path_key, 0) + 1

        _metrics["latency_sum_ms"] += duration_ms
        _metrics["latency_count"] += 1

        # Add timing header
        response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"

        return response
