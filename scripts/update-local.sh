#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }

# ─── Confirm ──────────────────────────────────────────────────────────────────
echo -e "${YELLOW}This will rebuild affected containers and restart them.${RESET}"
printf "Continue? [y/N] "
read -r answer
if [[ ! "$answer" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ─── Build ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}▶ Building containers${RESET}"
cd "$ROOT"
docker compose -f docker-compose.local.yml build
success "Build complete"

# ─── Start ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}▶ Starting containers${RESET}"
docker compose -f docker-compose.local.yml up -d
success "Containers updated and running"

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}✔ Update complete!${RESET}"
echo ""
echo -e "${BOLD}URLs${RESET}"
echo -e "─────────────────────────────────────────────────────"
echo -e "  ${CYAN}Gateway (nginx)${RESET}   http://localhost"
echo -e "  ${CYAN}Dashboard${RESET}         http://localhost/  (also :3000)"
echo -e "  ${CYAN}Portal${RESET}            http://localhost/portal/  (also :5174)"
echo -e "  ${CYAN}Marketing${RESET}         http://localhost/marketing/  (also :5175)"
echo -e "  ${CYAN}API${RESET}               http://localhost/api/v1/  (also :8000)"
echo -e "  ${CYAN}API Docs${RESET}          http://localhost/docs"
echo -e "  ${CYAN}Relay${RESET}             http://localhost/relay/  (also :8081)"
echo -e "  ${CYAN}PostgreSQL${RESET}        localhost:5433"
echo -e "─────────────────────────────────────────────────────"
echo ""
