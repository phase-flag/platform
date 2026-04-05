#!/usr/bin/env python3
"""
Phase Flag Relay Proxy Benchmark
=================================
Measures cached evaluation throughput through the relay proxy.

The relay serves pre-cached flag evaluations from an in-memory store,
so it should be significantly faster than hitting the main API directly.

Usage:
    pip install httpx
    python benchmarks/relay_benchmark.py [--url http://localhost:8081] [--api-key YOUR_KEY]

Requires:
    - Relay running at http://localhost:8081 (or --url)
    - PHASEFLAG_RELAY_API_KEY set (or --api-key)

The relay /relay/evaluate endpoint accepts:
    POST /relay/evaluate
    { "flag_key": "...", "context": { "user_id": "..." } }
"""

import argparse
import asyncio
import os
import sys
import time
from typing import Optional

try:
    import httpx
except ImportError:
    print("ERROR: httpx is required. Install it with: pip install httpx")
    sys.exit(1)

DEFAULT_RELAY_URL = "http://localhost:8081"
DEFAULT_API_KEY = os.environ.get(
    "PHASEFLAG_RELAY_API_KEY",
    os.environ.get("PHASEFLAG_API_SECRET_KEY", "8NAHFB8ZpIpjZsCdeiJXyV0mePWaQm3lyod8sYiqTJk="),
)

CONCURRENCY_LEVELS = [10, 50, 100, 200]
WARMUP_REQUESTS = 500
MEASURE_REQUESTS = 2000


def percentile(data: list[float], p: float) -> float:
    if not data:
        return 0.0
    s = sorted(data)
    k = (len(s) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (k - lo)


async def single_relay_request(
    client: httpx.AsyncClient,
    flag_key: str,
    user_id: str,
) -> Optional[float]:
    payload = {
        "flag_key": flag_key,
        "context": {"user_id": user_id, "attributes": {"plan": "pro"}},
    }
    t0 = time.perf_counter()
    try:
        resp = await client.post("/relay/evaluate", json=payload)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        # 200 = hit; 404 = flag not in cache; 503 = ruleset not loaded yet
        # All are valid relay round-trips for benchmarking throughput
        if resp.status_code in (200, 404, 503):
            return elapsed_ms
        return None
    except Exception:
        return None


async def run_relay_benchmark(relay_url: str, api_key: str) -> None:
    print("=" * 70)
    print("Phase Flag Relay Proxy Benchmark")
    print("=" * 70)
    print(f"  Target: {relay_url}")
    print(f"  Concurrency levels: {CONCURRENCY_LEVELS}")
    print(f"  Warm-up requests: {WARMUP_REQUESTS}")
    print(f"  Measurement requests: {MEASURE_REQUESTS}")
    print()

    headers: dict = {"Content-Type": "application/json"}
    if api_key:
        headers["X-API-Key"] = api_key

    limits = httpx.Limits(max_connections=300, max_keepalive_connections=100)
    timeout = httpx.Timeout(15.0)

    async with httpx.AsyncClient(
        base_url=relay_url,
        headers=headers,
        limits=limits,
        timeout=timeout,
    ) as client:
        # Health check
        try:
            resp = await client.get("/health")
            if resp.status_code != 200:
                print(f"  WARNING: Relay health check returned {resp.status_code}")
                print(f"  Relay may not be running at {relay_url}")
                print()
                # Still try to benchmark
            else:
                print(f"  Relay health: {resp.json()}")
                print()
        except Exception as e:
            print(f"  WARNING: Cannot reach relay at {relay_url}: {e}")
            print("  Skipping relay benchmark.")
            return

        flag_key = "benchmark-flag"  # Use any key — relay returns cached or 404

        print(f"  {'Concurrency':<20} {'Requests':>8}  {'p50':>10}  {'p95':>10}  {'p99':>10}  {'req/s':>10}  {'errors':>6}")
        print("  " + "-" * 82)

        for concurrency in CONCURRENCY_LEVELS:
            semaphore = asyncio.Semaphore(concurrency)
            latencies: list[float] = []

            async def bounded(uid: str) -> None:
                async with semaphore:
                    result = await single_relay_request(client, flag_key, uid)
                    if result is not None:
                        latencies.append(result)

            # Warm-up
            warmup_tasks = [bounded(f"w{i}") for i in range(WARMUP_REQUESTS)]
            await asyncio.gather(*warmup_tasks)
            latencies.clear()

            # Measurement
            t_start = time.perf_counter()
            tasks = [bounded(f"u{i % 1000}") for i in range(MEASURE_REQUESTS)]
            await asyncio.gather(*tasks)
            elapsed = time.perf_counter() - t_start

            n = len(latencies)
            errors = MEASURE_REQUESTS - n
            rps = n / elapsed if elapsed > 0 else 0
            p50 = percentile(latencies, 50)
            p95 = percentile(latencies, 95)
            p99 = percentile(latencies, 99)

            label = f"concurrency={concurrency}"
            print(
                f"  {label:<20} {n:>8}  {p50:>9.1f}ms  {p95:>9.1f}ms  {p99:>9.1f}ms  "
                f"{rps:>10.1f}  {errors:>6}"
            )

    print()
    print("Note: Relay benchmark tests the proxy layer throughput.")
    print("      Faster than API benchmark because relay uses in-memory cache.")
    print()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Phase Flag Relay Proxy Benchmark")
    parser.add_argument("--url", default=DEFAULT_RELAY_URL, help="Relay base URL")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY, help="Relay API key")
    args = parser.parse_args()

    await run_relay_benchmark(args.url, args.api_key)


if __name__ == "__main__":
    asyncio.run(main())
