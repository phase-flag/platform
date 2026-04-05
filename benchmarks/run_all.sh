#!/usr/bin/env bash
# =============================================================================
# Phase Flag — Run All Benchmarks
# =============================================================================
# Runs all benchmarks sequentially and captures output to benchmarks/RESULTS.md
#
# Usage:
#   cd /path/to/phase-flag
#   bash benchmarks/run_all.sh
#
# Requirements:
#   - Docker stack running (infra/docker/docker-compose.yml)
#   - pip install httpx
#   - node >= 16
#   - python >= 3.10
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RESULTS_FILE="$SCRIPT_DIR/RESULTS.md"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

API_URL="${PHASEFLAG_API_URL:-http://localhost:8000}"
RELAY_URL="${PHASEFLAG_RELAY_URL:-http://localhost:8081}"
API_KEY="${PHASEFLAG_API_SECRET_KEY:-8NAHFB8ZpIpjZsCdeiJXyV0mePWaQm3lyod8sYiqTJk=}"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

log()  { echo "[run_all.sh] $*"; }
ok()   { echo "[run_all.sh] ✓ $*"; }
warn() { echo "[run_all.sh] WARNING: $*" >&2; }
fail() { echo "[run_all.sh] ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Pre-flight: check Docker stack
# ---------------------------------------------------------------------------

log "Checking Docker stack..."

if ! command -v docker &>/dev/null; then
    fail "Docker is not installed or not in PATH"
fi

# Check if the API is reachable
if curl -sf "$API_URL/health" >/dev/null 2>&1; then
    ok "API is running at $API_URL"
else
    warn "API is not reachable at $API_URL"
    warn "Start the stack with: cd infra/docker && docker compose up -d"
    warn "Continuing — SDK benchmarks (no network) will still run."
fi

# Check relay
if curl -sf "$RELAY_URL/health" >/dev/null 2>&1; then
    ok "Relay is running at $RELAY_URL"
else
    warn "Relay is not reachable at $RELAY_URL — relay benchmark will be skipped"
fi

# ---------------------------------------------------------------------------
# Check Python deps
# ---------------------------------------------------------------------------

if ! python3 -c "import httpx" 2>/dev/null; then
    log "Installing httpx..."
    pip install httpx -q
fi

# ---------------------------------------------------------------------------
# Run benchmarks and capture output
# ---------------------------------------------------------------------------

log "Starting benchmarks..."
log "Results will be written to: $RESULTS_FILE"

# Temporary files for each benchmark output
TMP_API=$(mktemp)
TMP_SDK_PY=$(mktemp)
TMP_SDK_JS=$(mktemp)
TMP_RELAY=$(mktemp)

cleanup() {
    rm -f "$TMP_API" "$TMP_SDK_PY" "$TMP_SDK_JS" "$TMP_RELAY"
}
trap cleanup EXIT

# Run Python SDK benchmark (always runs, no network needed)
log "Running Python SDK benchmark..."
python3 "$SCRIPT_DIR/sdk_benchmark_python.py" 2>&1 | tee "$TMP_SDK_PY"
ok "Python SDK benchmark complete"

# Run JS SDK benchmark (always runs, no network needed)
log "Running JavaScript SDK benchmark..."
if command -v node &>/dev/null; then
    node "$SCRIPT_DIR/sdk_benchmark_js.mjs" 2>&1 | tee "$TMP_SDK_JS"
    ok "JavaScript SDK benchmark complete"
else
    warn "node not found — skipping JS SDK benchmark"
    echo "SKIPPED: node not found" > "$TMP_SDK_JS"
fi

# Run API benchmark (requires running API)
log "Running API benchmark..."
if curl -sf "$API_URL/health" >/dev/null 2>&1; then
    python3 "$SCRIPT_DIR/api_benchmark.py" \
        --url "$API_URL" \
        --api-key "$API_KEY" \
        2>&1 | tee "$TMP_API"
    ok "API benchmark complete"
else
    warn "API not reachable — skipping API benchmark"
    echo "SKIPPED: API not reachable at $API_URL" > "$TMP_API"
fi

# Run relay benchmark (requires running relay)
log "Running relay benchmark..."
if curl -sf "$RELAY_URL/health" >/dev/null 2>&1; then
    python3 "$SCRIPT_DIR/relay_benchmark.py" \
        --url "$RELAY_URL" \
        --api-key "$API_KEY" \
        2>&1 | tee "$TMP_RELAY"
    ok "Relay benchmark complete"
else
    warn "Relay not reachable — skipping relay benchmark"
    echo "SKIPPED: Relay not reachable at $RELAY_URL" > "$TMP_RELAY"
fi

# ---------------------------------------------------------------------------
# Write RESULTS.md
# ---------------------------------------------------------------------------

log "Writing $RESULTS_FILE..."

cat > "$RESULTS_FILE" <<HEADER
# Phase Flag Benchmark Results

**Run timestamp:** $TIMESTAMP
**API URL:** $API_URL
**Relay URL:** $RELAY_URL

---

## Python SDK — Local Evaluation

\`\`\`
$(cat "$TMP_SDK_PY")
\`\`\`

---

## JavaScript SDK — Local Evaluation

\`\`\`
$(cat "$TMP_SDK_JS")
\`\`\`

---

## API Evaluation Endpoint

\`\`\`
$(cat "$TMP_API")
\`\`\`

---

## Relay Proxy Evaluation

\`\`\`
$(cat "$TMP_RELAY")
\`\`\`

---

*Generated by benchmarks/run_all.sh*
HEADER

ok "Results written to $RESULTS_FILE"
log "Done."
