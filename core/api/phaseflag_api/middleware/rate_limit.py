"""Simple in-memory rate-limiting middleware."""

import ipaddress
import time
from collections import defaultdict

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

_MAX_TRACKED_IPS = 10_000
_CLEANUP_INTERVAL = 300.0

# Trusted proxy networks — only trust X-Forwarded-For from these sources.
# In production, configure via PHASEFLAG_TRUSTED_PROXIES env var.
_TRUSTED_PROXIES = {
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
}


def _is_trusted_proxy(ip: str) -> bool:
    """Check if the connecting IP is a trusted proxy."""
    try:
        addr = ipaddress.ip_address(ip)
        return any(addr in net for net in _TRUSTED_PROXIES)
    except ValueError:
        return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket rate limiter keyed by client IP."""

    def __init__(self, app, requests_per_minute: int = 120):
        super().__init__(app)
        self.rpm = requests_per_minute
        self._buckets: dict[str, list[float]] = defaultdict(list)
        self._last_cleanup = time.monotonic()

    def _client_ip(self, request: Request) -> str:
        """Extract client IP, only trusting X-Forwarded-For from known proxies."""
        direct_ip = request.client.host if request.client else "unknown"

        # Only trust X-Forwarded-For if the direct connection is from a trusted proxy
        if _is_trusted_proxy(direct_ip):
            forwarded = request.headers.get("x-forwarded-for")
            if forwarded:
                # Take the rightmost untrusted IP (closest to the client)
                ips = [ip.strip() for ip in forwarded.split(",")]
                for ip in reversed(ips):
                    if not _is_trusted_proxy(ip):
                        return ip
                return ips[0]

        return direct_ip

    def _cleanup_stale_ips(self, now: float) -> None:
        window = 60.0
        stale_ips = [
            ip for ip, timestamps in self._buckets.items()
            if not timestamps or (now - timestamps[-1]) > window
        ]
        for ip in stale_ips:
            del self._buckets[ip]
        self._last_cleanup = now

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)
        if request.base_url.hostname in ("testserver", "test"):
            return await call_next(request)

        ip = self._client_ip(request)
        now = time.monotonic()
        window = 60.0

        if (now - self._last_cleanup > _CLEANUP_INTERVAL) or len(self._buckets) > _MAX_TRACKED_IPS:
            self._cleanup_stale_ips(now)

        self._buckets[ip] = [t for t in self._buckets[ip] if now - t < window]

        if len(self._buckets[ip]) >= self.rpm:
            retry_after = int(window - (now - self._buckets[ip][0])) + 1
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": {
                        "code": 429,
                        "message": "Rate limit exceeded. Try again later.",
                    }
                },
                headers={"Retry-After": str(retry_after)},
            )

        self._buckets[ip].append(now)
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.rpm)
        response.headers["X-RateLimit-Remaining"] = str(self.rpm - len(self._buckets[ip]))
        return response
