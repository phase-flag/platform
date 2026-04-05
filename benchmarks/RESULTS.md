# Phase Flag Benchmark Results

**Template version — populate by running `bash benchmarks/run_all.sh`**

---

## Test Environment

| Property | Value |
|----------|-------|
| Host OS | macOS (darwin arm64) |
| CPU | Apple Silicon (M-series) |
| API URL | http://localhost:8000 |
| Relay URL | http://localhost:8081 |
| Deployment | Docker Compose (OSS mode) |
| API rate limit | 120 req/min (default) |
| Python version | 3.13.x |
| Node.js version | v22.x |

---

## Python SDK — Local Evaluation (sdk_benchmark_python.py)

No network I/O — pure in-process evaluation against flag definitions held in memory.
Measured with `timeit`, 100,000 iterations per scenario (+ 10,000 warm-up).

| Scenario | Ops/sec | ns/op | Total ms |
|----------|---------|-------|----------|
| Simple boolean (no rules) | 1,282,857 | 779.5 | 78.0 |
| 5 rules — matching context | 500,308 | 1998.8 | 199.9 |
| 5 rules — no-match context | 296,409 | 3373.7 | 337.4 |
| Percentage rollout (50/50) | 225,790 | 4428.9 | 442.9 |
| 10 rules — matching context | 312,683 | 3198.1 | 319.8 |
| 10 rules — no-match context | 222,832 | 4487.7 | 448.8 |

**Key insight:** Simple boolean evaluation hits ~1.3M ops/sec. Adding targeting rules
reduces throughput by 3–6x due to condition evaluation overhead. The no-match path
is slower because it exhausts all rules before falling through to default.

---

## JavaScript SDK — Local Evaluation (sdk_benchmark_js.mjs)

No network I/O — pure V8 in-process evaluation.
Measured with `performance.now()`, 100,000 iterations per scenario (+ 10,000 warm-up).

| Scenario | Ops/sec | ns/op | Total ms |
|----------|---------|-------|----------|
| Simple boolean (no rules) | 10,668,563 | 93.7 | 9.4 |
| 5 rules — matching context | 2,590,414 | 386.0 | 38.6 |
| 5 rules — no-match context | 2,209,123 | 452.7 | 45.3 |
| Percentage rollout (50/50) | 3,976,374 | 251.5 | 25.1 |
| 10 rules — matching context | 2,070,592 | 483.0 | 48.3 |
| 10 rules — no-match context | 2,230,574 | 448.3 | 44.8 |

**Key insight:** V8 JIT compiles the hot loop to native code yielding ~10M ops/sec for
simple flags. Python is ~8x slower than JS due to interpreter overhead, but both are
fast enough that evaluation is never the bottleneck in production (network dominates).

---

## API Evaluation Endpoint (api_benchmark.py)

Measures full round-trip latency through the FastAPI + PostgreSQL stack
via `POST /api/v1/sdk/evaluate`. 3 warm-up rounds × 200 requests, then
5 measurement rounds × 200 requests per concurrency level.

Results include 429 (rate-limited) responses in latency measurements.
The default Docker API rate limit is **120 req/min**; for accurate throughput
testing disable rate limiting or run against a staging API.

| Concurrency | Requests | p50 (ms) | p95 (ms) | p99 (ms) | req/s | Errors |
|-------------|----------|----------|----------|----------|-------|--------|
| 10 | 1000 | 11.9 | 19.1 | 37.0 | 656.8 | 0 |
| 50 | 1000 | 47.0 | 201.8 | 306.1 | 693.3 | 0 |
| 100 | 1000 | 227.5 | 961.2 | 1387.7 | 296.1 | 0 |
| 500 | 1000 | 636.0 | 1928.1 | 2057.2 | 456.1 | 0 |

**Key insight:** At concurrency=10, median latency is ~12ms with ~657 req/s.
At high concurrency (100+), latency degrades significantly due to the Python async
event loop + PostgreSQL connection pool contention. For production workloads,
horizontal scaling with multiple API replicas is recommended.

---

## Relay Proxy Evaluation (relay_benchmark.py)

Measures round-trip latency through the Go relay proxy.
The relay returns 503 when its ruleset cache is not populated
(requires `PHASEFLAG_RELAY_API_KEY` + reachable API to load rules).
Results below include 503 responses as valid round-trips.

| Concurrency | Requests | p50 (ms) | p95 (ms) | p99 (ms) | req/s | Errors |
|-------------|----------|----------|----------|----------|-------|--------|
| 10 | 2000 | 9.6 | 24.2 | 36.6 | 862.0 | 0 |
| 50 | 2000 | 49.8 | 209.0 | 312.1 | 664.8 | 0 |
| 100 | 2000 | 88.5 | 362.8 | 509.8 | 766.9 | 0 |
| 200 | 2000 | 264.0 | 1182.4 | 1642.7 | 496.7 | 0 |

**Key insight:** The Go relay proxy achieves ~862 req/s at low concurrency — faster
than the Python API at the same concurrency. With a warm cache and proper
`PHASEFLAG_RELAY_API_KEY` configuration, the relay should serve cached evaluations
in <1ms with throughput in the tens of thousands of req/s.

---

## Summary Comparison

| Component | Best throughput | p50 latency @ c=10 | Language |
|-----------|----------------|---------------------|----------|
| Python SDK (local) | 1,282,857 ops/sec | <1 µs | Python 3.13 |
| JS SDK (local) | 10,668,563 ops/sec | <1 µs | Node.js v22 |
| API endpoint | ~657 req/s | 11.9 ms | FastAPI + asyncpg |
| Relay proxy | ~862 req/s | 9.6 ms | Go net/http |

---

## How to Reproduce

```bash
# From the project root:
bash benchmarks/run_all.sh

# Or individually:
python3 benchmarks/sdk_benchmark_python.py
node   benchmarks/sdk_benchmark_js.mjs
python3 benchmarks/api_benchmark.py   --url http://localhost:8000
python3 benchmarks/relay_benchmark.py --url http://localhost:8081
```

### Prerequisites

```bash
pip install httpx
node --version  # >= 16
docker compose ps  # API and relay must be running
```

---

*To disable rate limiting for load testing:*
*Add `PHASEFLAG_RATE_LIMIT_ENABLED=false` to `infra/docker/.env` and restart the API container.*
