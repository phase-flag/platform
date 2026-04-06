"""Prometheus query client used by the rollout service for health gate evaluation."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def query_metric(
    prometheus_url: str,
    query: str,
    duration: str = "5m",
) -> dict[str, Any] | None:
    """Execute a Prometheus range query.

    Args:
        prometheus_url: Base URL of the Prometheus instance, e.g. "http://prometheus:9090".
        query: PromQL expression.
        duration: Look-back window, e.g. "5m", "1h".

    Returns:
        Prometheus JSON response dict or None on error.
    """
    try:
        import httpx
        from datetime import datetime, timedelta

        # Parse duration string to seconds
        _unit_map = {"s": 1, "m": 60, "h": 3600, "d": 86400}
        unit = duration[-1]
        value = int(duration[:-1])
        seconds = value * _unit_map.get(unit, 60)

        now = datetime.utcnow()
        start = now - timedelta(seconds=seconds)
        step = max(15, seconds // 60)  # at most 60 data points

        params = {
            "query": query,
            "start": start.timestamp(),
            "end": now.timestamp(),
            "step": step,
        }

        url = f"{prometheus_url.rstrip('/')}/api/v1/query_range"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.error("metrics_service.query_metric error: %s", exc)
        return None


async def check_error_rate(
    prometheus_url: str,
    service: str,
    threshold: float = 0.01,
    duration: str = "5m",
) -> dict[str, Any]:
    """Query error rate for a service and check it against a threshold.

    Returns:
        {
            "service": str,
            "error_rate": float | None,
            "threshold": float,
            "exceeded": bool,
        }
    """
    # Standard rate query for HTTP 5xx errors vs total requests
    query = (
        f'sum(rate(http_requests_total{{service="{service}",status=~"5.."}}[{duration}])) / '
        f'sum(rate(http_requests_total{{service="{service}"}}[{duration}]))'
    )

    result = await query_metric(prometheus_url, query, duration)
    error_rate: float | None = None

    if result and result.get("status") == "success":
        data = result.get("data", {})
        values = data.get("result", [])
        if values:
            # Take the last value from the range
            last_value = values[0].get("values", [])
            if last_value:
                try:
                    error_rate = float(last_value[-1][1])
                except (IndexError, ValueError, TypeError):
                    error_rate = None

    return {
        "service": service,
        "error_rate": error_rate,
        "threshold": threshold,
        "exceeded": error_rate is not None and error_rate > threshold,
    }


async def check_latency_p99(
    prometheus_url: str,
    service: str,
    threshold_ms: float = 1000.0,
    duration: str = "5m",
) -> dict[str, Any]:
    """Query p99 latency for a service and check it against a threshold.

    Args:
        threshold_ms: Latency threshold in milliseconds.

    Returns:
        {
            "service": str,
            "latency_p99_ms": float | None,
            "threshold_ms": float,
            "exceeded": bool,
        }
    """
    query = (
        f'histogram_quantile(0.99, '
        f'sum(rate(http_request_duration_seconds_bucket{{service="{service}"}}[{duration}])) by (le))'
    )

    result = await query_metric(prometheus_url, query, duration)
    latency_ms: float | None = None

    if result and result.get("status") == "success":
        data = result.get("data", {})
        values = data.get("result", [])
        if values:
            last_value = values[0].get("values", [])
            if last_value:
                try:
                    # Prometheus returns seconds — convert to ms
                    latency_ms = float(last_value[-1][1]) * 1000.0
                except (IndexError, ValueError, TypeError):
                    latency_ms = None

    return {
        "service": service,
        "latency_p99_ms": latency_ms,
        "threshold_ms": threshold_ms,
        "exceeded": latency_ms is not None and latency_ms > threshold_ms,
    }
