#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

info()    { echo -e "${BLUE}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}"; }

# ─── 1. Check prerequisites ───────────────────────────────────────────────────
step "Checking prerequisites"

command -v docker >/dev/null 2>&1 || error "docker is not installed. Install Docker Desktop from https://docs.docker.com/get-docker/"
command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 || error "docker compose plugin not found. Upgrade Docker Desktop to 4.x+."
command -v openssl >/dev/null 2>&1 || error "openssl is not installed."
success "docker and docker compose found"

# ─── 2. Copy .env.example → .env if not present ───────────────────────────────
step "Checking .env file"

ENV_FILE="$ROOT/.env"
ENV_EXAMPLE="$ROOT/.env.example"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  info "Created .env from .env.example"
else
  info ".env already exists — skipping copy"
fi

# ─── 3. Auto-generate secrets if still placeholders ──────────────────────────
step "Generating secrets"

generate_secret() {
  openssl rand -base64 32
}

replace_secret() {
  local key="$1"
  local file="$2"
  local secret
  secret="$(generate_secret)"
  # Portable sed for macOS and Linux
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|^${key}=change_me_use_openssl_rand|${key}=${secret}|" "$file"
  else
    sed -i "s|^${key}=change_me_use_openssl_rand|${key}=${secret}|" "$file"
  fi
  success "Generated ${key}"
}

for key in DB_PASSWORD JWT_SECRET API_SECRET; do
  current_val="$(grep "^${key}=" "$ENV_FILE" | cut -d= -f2- || true)"
  if [[ "$current_val" == "change_me_use_openssl_rand" ]]; then
    replace_secret "$key" "$ENV_FILE"
  else
    info "${key} is already set — skipping"
  fi
done

# ─── 4. Build and start containers ───────────────────────────────────────────
step "Building and starting containers"
cd "$ROOT"
docker compose -f docker-compose.local.yml up -d --build
success "Containers started"

# ─── 5. Wait for API health check ────────────────────────────────────────────
step "Waiting for API to become healthy"

API_URL="http://localhost:8000/health"
MAX_RETRIES=30
RETRY_INTERVAL=5
attempt=0

while true; do
  attempt=$((attempt + 1))
  if curl -sf "$API_URL" >/dev/null 2>&1; then
    success "API is healthy"
    break
  fi
  if [[ $attempt -ge $MAX_RETRIES ]]; then
    error "API did not become healthy after $((MAX_RETRIES * RETRY_INTERVAL))s. Check logs: docker compose -f docker-compose.local.yml logs api"
  fi
  info "Attempt ${attempt}/${MAX_RETRIES} — waiting ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

# ─── 6. Run DB migrations ────────────────────────────────────────────────────
step "Running database migrations"
docker compose -f docker-compose.local.yml exec api alembic upgrade head
success "Migrations complete"

# ─── 7. Print summary ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}✔ Phase Flag is running!${RESET}"
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
echo -e "Logs:   ${YELLOW}docker compose -f docker-compose.local.yml logs -f api${RESET}"
echo -e "Stop:   ${YELLOW}docker compose -f docker-compose.local.yml down${RESET}"
echo -e "Reset:  ${YELLOW}docker compose -f docker-compose.local.yml down -v${RESET}  (removes DB)"
echo ""
