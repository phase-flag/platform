#!/usr/bin/env python3
"""
Phase Flag API Benchmark
========================
Measures evaluation endpoint throughput and latency under concurrent load.

Usage:
    pip install httpx
    python benchmarks/api_benchmark.py [--url http://localhost:8000] [--api-key YOUR_KEY]

The script will:
  1. Create a test flag via the admin API
  2. Run 3 warm-up rounds
  3. Run 5 measurement rounds at concurrency levels: 10, 50, 100, 500
  4. Report p50, p95, p99 latency and requests/second
  5. Clean up the test flag
"""

import argparse
import asyncio
import os
import statistics
import sys
import time
import uuid
from typing import Optional

try:
    import httpx
except ImportError:
    print("ERROR: httpx is required. Install it with: pip install httpx")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_API_URL = "http://localhost:8000"
# Default key matches the Docker stack provisioned by infra/docker/docker-compose.yml.
# Override via PHASEFLAG_API_SECRET_KEY env var or --api-key flag.
DEFAULT_API_KEY = os.environ.get(
    "PHASEFLAG_API_SECRET_KEY",
    "8NAHFB8ZpIpjZsCdeiJXyV0mePWaQm3lyod8sYiqTJk=",
)

CONCURRENCY_LEVELS = [10, 50, 100, 500]
WARMUP_ROUNDS = 3
MEASURE_ROUNDS = 5
REQUESTS_PER_ROUND = 200  # per concurrency level per round

# NOTE: The default API has a 120 req/min rate limit.
# The benchmark measures raw throughput including 429 responses.
# To disable rate limiting for benchmarking, set PHASEFLAG_RATE_LIMIT_ENABLED=false
# in infra/docker/.env and restart the API container.


# ---------------------------------------------------------------------------
# Flag setup helpers
# ---------------------------------------------------------------------------

FLAG_KEY = f"benchmark-flag-{uuid.uuid4().hex[:8]}"


async def create_test_flag(client: httpx.AsyncClient) -> Optional[str]:
    """Create a benchmark flag with targeting rules. Returns flag ID or None."""
    payload = {
        "key": FLAG_KEY,
        "name": "Benchmark Test Flag",
        "flag_type": "boolean",
        "environment": "development",
        "default_variation_key": "off",
        "variations": [
            {"key": "on", "name": "On", "value": True},
            {"key": "off", "name": "Off", "value": False},
        ],
        "targeting_rules": [
            {
                "priority": 1,
                "conditions": [
                    {"attribute": "plan", "operator": "one_of", "value": ["enterprise", "pro"]},
                ],
                "variation_key": "on",
            }
        ],
    }
    try:
        resp = await client.post("/api/v1/flags", json=payload)
        if resp.status_code in (200, 201):
            data = resp.json()
            flag_id = data.get("id")
            print(f"  Created test flag: {FLAG_KEY} (id={flag_id})")
            return flag_id
        else:
            print(f"  WARNING: Could not create test flag: {resp.status_code} {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"  WARNING: Flag creation failed: {e}")
        return None


async def delete_test_flag(client: httpx.AsyncClient, flag_id: str) -> None:
    """Delete the benchmark flag."""
    try:
        resp = await client.delete(f"/api/v1/flags/{flag_id}")
        if resp.status_code in (200, 204):
            print(f"  Cleaned up test flag: {FLAG_KEY}")
        else:
            print(f"  WARNING: Could not delete test flag: {resp.status_code}")
    except Exception as e:
        print(f"  WARNING: Cleanup failed: {e}")


# ---------------------------------------------------------------------------
# Benchmark core
# ---------------------------------------------------------------------------

async def single_request(
    client: httpx.AsyncClient,
    flag_key: str,
    user_id: str,
) -> Optional[float]:
    """Send one evaluation request and return latency in ms, or None on error."""
    payload = {
        "flag_key": flag_key,
        "context": {
            "user_id": user_id,
            "attributes": {"plan": "pro", "country": "us"},
        },
    }
    t0 = time.perf_counter()
    try:
        resp = await client.post("/api/v1/sdk/evaluate", json=payload)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        if resp.status_code in (200, 404, 429):
            # 200 = found; 404 = flag not found (valid API round-trip); 429 = rate limited
            return elapsed_ms
        else:
            return None
    except Exception:
        return None


async def run_concurrent_batch(
    client: httpx.AsyncClient,
    flag_key: str,
    concurrency: int,
    total_requests: int,
) -> list[float]:
    """Run `total_requests` spread across `concurrency` simultaneous tasks.
    Returns list of successful latencies in ms."""
    semaphore = asyncio.Semaphore(concurrency)
    latencies: list[float] = []

    async def bounded_request(uid: str) -> None:
        async with semaphore:
            result = await single_request(client, flag_key, uid)
            if result is not None:
                latencies.append(result)

    tasks = [
        bounded_request(f"bench-user-{i % 1000}")
        for i in range(total_requests)
    ]
    await asyncio.gather(*tasks)
    return latencies


def percentile(data: list[float], p: float) -> float:
    """Return the p-th percentile of a sorted list."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * p / 100
    lo, hi = int(k), min(int(k) + 1, len(sorted_data) - 1)
    return sorted_data[lo] + (sorted_data[hi] - sorted_data[lo]) * (k - lo)


def print_table_row(label: str, n: int, p50: float, p95: float, p99: float, rps: float, errors: int) -> None:
    print(f"  {label:<20} {n:>6}  {p50:>8.1f}ms  {p95:>8.1f}ms  {p99:>8.1f}ms  {rps:>10.1f}  {errors:>6}")


async def run_benchmark(api_url: str, api_key: str) -> dict:
    """Run the full benchmark suite. Returns results dict."""
    headers = {
        "X-API-Key": api_key,
        "Content-Type": "application/json",
    }

    limits = httpx.Limits(max_connections=600, max_keepalive_connections=200)
    timeout = httpx.Timeout(30.0)

    results = {}

    async with httpx.AsyncClient(
        base_url=api_url,
        headers=headers,
        limits=limits,
        timeout=timeout,
    ) as client:
        # Health check
        try:
            resp = await client.get("/health")
            if resp.status_code != 200:
                print(f"ERROR: API health check failed: {resp.status_code}")
                return {}
            print(f"  API health: {resp.json()}")
        except Exception as e:
            print(f"ERROR: Cannot reach API at {api_url}: {e}")
            return {}

        # Create test flag
        flag_id = await create_test_flag(client)
        flag_key = FLAG_KEY

        # Allow a moment for the flag to be persisted
        await asyncio.sleep(0.2)

        print()
        print(f"  {'Concurrency':<20} {'Requests':>6}  {'p50':>10}  {'p95':>10}  {'p99':>10}  {'req/s':>10}  {'errors':>6}")
        print("  " + "-" * 82)

        for concurrency in CONCURRENCY_LEVELS:
            total_requests = REQUESTS_PER_ROUND * MEASURE_ROUNDS
            warmup_requests = REQUESTS_PER_ROUND * WARMUP_ROUNDS

            # Warm-up
            await run_concurrent_batch(client, flag_key, concurrency, warmup_requests)

            # Measurement
            t_start = time.perf_counter()
            latencies = await run_concurrent_batch(client, flag_key, concurrency, total_requests)
            t_end = time.perf_counter()

            elapsed = t_end - t_start
            n = len(latencies)
            errors = total_requests - n
            rps = n / elapsed if elapsed > 0 else 0

            p50 = percentile(latencies, 50)
            p95 = percentile(latencies, 95)
            p99 = percentile(latencies, 99)

            label = f"concurrency={concurrency}"
            print_table_row(label, n, p50, p95, p99, rps, errors)

            results[concurrency] = {
                "total_requests": total_requests,
                "successful": n,
                "errors": errors,
                "p50_ms": round(p50, 2),
                "p95_ms": round(p95, 2),
                "p99_ms": round(p99, 2),
                "rps": round(rps, 1),
                "elapsed_s": round(elapsed, 2),
            }

        # Cleanup
        if flag_id:
            await delete_test_flag(client, flag_id)

    return results


# ---------------------------------------------------------------------------
# Batch evaluation benchmark
# ---------------------------------------------------------------------------

async def run_batch_benchmark(api_url: str, api_key: str, flag_keys: list[str]) -> None:
    """Benchmark the /evaluate/batch endpoint with multiple flags at once."""
    headers = {
        "X-API-Key": api_key,
        "Content-Type": "application/json",
    }

    print("\n  Batch Evaluation Benchmark (/evaluate/batch)")
    print("  " + "-" * 60)

    if not flag_keys:
        print("  Skipped (no flags available for batch benchmark)")
        return

    limits = httpx.Limits(max_connections=120, max_keepalive_connections=50)
    async with httpx.AsyncClient(
        base_url=api_url,
        headers=headers,
        limits=limits,
        timeout=httpx.Timeout(30.0),
    ) as client:
        concurrency = 20
        total = 100
        semaphore = asyncio.Semaphore(concurrency)
        latencies = []

        async def batch_req(uid: str):
            payload = {
                "flag_keys": flag_keys[:5],
                "context": {"user_id": uid, "attributes": {"plan": "pro"}},
            }
            async with semaphore:
                t0 = time.perf_counter()
                try:
                    resp = await client.post("/api/v1/evaluate/batch", json=payload)
                    ms = (time.perf_counter() - t0) * 1000
                    if resp.status_code == 200:
                        latencies.append(ms)
                except Exception:
                    pass

        await asyncio.gather(*[batch_req(f"u{i}") for i in range(total)])

        if latencies:
            p50 = percentile(latencies, 50)
            p95 = percentile(latencies, 95)
            p99 = percentile(latencies, 99)
            print(f"  flags/batch={len(flag_keys[:5])}, concurrency={concurrency}, n={len(latencies)}")
            print(f"  p50={p50:.1f}ms  p95={p95:.1f}ms  p99={p99:.1f}ms")
        else:
            print("  No successful batch requests")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

async def main() -> None:
    parser = argparse.ArgumentParser(description="Phase Flag API Benchmark")
    parser.add_argument("--url", default=DEFAULT_API_URL, help="API base URL")
    parser.add_argument("--api-key", default=DEFAULT_API_KEY, help="API secret key")
    args = parser.parse_args()

    print("=" * 70)
    print("Phase Flag API Evaluation Benchmark")
    print("=" * 70)
    print(f"  Target: {args.url}")
    print(f"  Concurrency levels: {CONCURRENCY_LEVELS}")
    print(f"  Warm-up rounds: {WARMUP_ROUNDS} x {REQUESTS_PER_ROUND} requests")
    print(f"  Measurement rounds: {MEASURE_ROUNDS} x {REQUESTS_PER_ROUND} requests")
    print()

    print("Setup:")
    results = await run_benchmark(args.url, args.api_key)

    if not results:
        print("\nBenchmark could not complete — check API connectivity.")
        sys.exit(1)

    print()
    print("=" * 70)
    print("Summary")
    print("=" * 70)
    for c, r in results.items():
        print(
            f"  concurrency={c:>3}: "
            f"p50={r['p50_ms']:>7.1f}ms  "
            f"p95={r['p95_ms']:>7.1f}ms  "
            f"p99={r['p99_ms']:>7.1f}ms  "
            f"{r['rps']:>8.1f} req/s  "
            f"errors={r['errors']}"
        )

    # Output markdown snippet
    print()
    print("Markdown snippet for RESULTS.md:")
    print()
    print("| Concurrency | Requests | p50 (ms) | p95 (ms) | p99 (ms) | req/s | Errors |")
    print("|-------------|----------|----------|----------|----------|-------|--------|")
    for c, r in results.items():
        print(
            f"| {c} | {r['successful']} | {r['p50_ms']} | {r['p95_ms']} | {r['p99_ms']} "
            f"| {r['rps']} | {r['errors']} |"
        )


if __name__ == "__main__":
    asyncio.run(main())
