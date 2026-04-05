#!/usr/bin/env bash
# check.sh — Phase Flag service health checker
#
# Usage:
#   ./check.sh                   # print JSON status report to stdout
#   ./check.sh --alert           # send alert webhook on any failure
#   ./check.sh --quiet           # suppress stdout, only exit 1 on failure
#
# Environment variables:
#   ALERT_WEBHOOK_URL   Slack incoming webhook URL (or any JSON-accepting endpoint)
#   ALERT_EMAIL         Email address to notify on failure (requires 'mail' command)
#   TIMEOUT             Per-request timeout in seconds (default: 5)
#
# Cron example (check every 5 minutes, alert on failure):
#   */5 * * * * ALERT_WEBHOOK_URL=https://hooks.slack.com/... /path/to/check.sh --alert >> /var/log/phaseflag-status.log 2>&1

set -euo pipefail

TIMEOUT="${TIMEOUT:-5}"
ALERT=false
QUIET=false

for arg in "$@"; do
  case "$arg" in
    --alert) ALERT=true ;;
    --quiet) QUIET=true ;;
  esac
done

# ─── Service catalogue ────────────────────────────────────────────────────────
declare -A SERVICES
SERVICES=(
  ["API"]="https://api.phaseflag.com/health"
  ["Relay"]="https://relay.phaseflag.com/health"
  ["Dashboard"]="https://app.phaseflag.com"
  ["Portal"]="https://portal.phaseflag.com"
  ["Marketing"]="https://phaseflag.com"
  ["Docs"]="https://docs.phaseflag.com"
)

# ─── Check each service ───────────────────────────────────────────────────────
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
ALL_OK=true
FAILURES=()

# Build JSON incrementally
json_items=()

for name in "${!SERVICES[@]}"; do
  url="${SERVICES[$name]}"
  start_ns="$(date +%s%N 2>/dev/null || echo 0)"

  http_code="$(curl -o /dev/null -s -w "%{http_code}" \
    --max-time "$TIMEOUT" \
    --connect-timeout "$TIMEOUT" \
    "$url" 2>/dev/null || echo "000")"

  end_ns="$(date +%s%N 2>/dev/null || echo 0)"
  if [[ "$start_ns" != "0" && "$end_ns" != "0" ]]; then
    latency_ms=$(( (end_ns - start_ns) / 1000000 ))
  else
    latency_ms=-1
  fi

  if [[ "$http_code" =~ ^[23] ]]; then
    service_status="operational"
  elif [[ "$http_code" == "000" ]]; then
    service_status="down"
    ALL_OK=false
    FAILURES+=("$name ($url)")
  else
    service_status="degraded"
    ALL_OK=false
    FAILURES+=("$name — HTTP $http_code ($url)")
  fi

  json_items+=("{\"service\":\"$name\",\"url\":\"$url\",\"status\":\"$service_status\",\"http_code\":\"$http_code\",\"latency_ms\":$latency_ms}")
done

# ─── Build JSON report ────────────────────────────────────────────────────────
overall="operational"
if [[ ${#FAILURES[@]} -gt 0 ]]; then
  overall="degraded"
fi

services_json="$(printf '%s,' "${json_items[@]}")"
services_json="[${services_json%,}]"

report="{\"timestamp\":\"$TIMESTAMP\",\"overall\":\"$overall\",\"services\":$services_json}"

if [[ "$QUIET" == false ]]; then
  # Pretty-print if jq is available
  if command -v jq &>/dev/null; then
    echo "$report" | jq .
  else
    echo "$report"
  fi
fi

# ─── Alerts on failure ────────────────────────────────────────────────────────
if [[ "$ALERT" == true && ${#FAILURES[@]} -gt 0 ]]; then
  failure_list="$(printf '• %s\n' "${FAILURES[@]}")"

  # Slack webhook
  if [[ -n "${ALERT_WEBHOOK_URL:-}" ]]; then
    slack_payload="{\"text\":\"*Phase Flag Status Alert* :rotating_light:\n\nThe following services are unhealthy:\n${failure_list}\n\nTimestamp: ${TIMESTAMP}\",\"username\":\"Phase Flag Status\",\"icon_emoji\":\":warning:\"}"
    curl -s -X POST \
      -H 'Content-Type: application/json' \
      -d "$slack_payload" \
      "$ALERT_WEBHOOK_URL" \
      --max-time 10 \
      -o /dev/null \
      || echo "[check.sh] Warning: failed to send Slack alert" >&2
  fi

  # Email alert (requires mail command on host)
  if [[ -n "${ALERT_EMAIL:-}" ]]; then
    if command -v mail &>/dev/null; then
      echo -e "Phase Flag Status Alert\n\nThe following services are unhealthy at ${TIMESTAMP}:\n${failure_list}\n\nCheck the status page at https://status.phaseflag.com" \
        | mail -s "[Phase Flag] Service Alert — ${overall}" "$ALERT_EMAIL" \
        || echo "[check.sh] Warning: failed to send email alert" >&2
    else
      echo "[check.sh] Warning: ALERT_EMAIL set but 'mail' command not found" >&2
    fi
  fi
fi

# Exit code: 0 = all OK, 1 = one or more services unhealthy
if [[ "$ALL_OK" == false ]]; then
  exit 1
fi
exit 0
