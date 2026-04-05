#!/usr/bin/env bash
# =============================================================================
# Phase Flag — Production Deployment Script
# =============================================================================
# Usage: ./scripts/deploy-production.sh [--env-file PATH] [--tag IMAGE_TAG] [--skip-pull]
#
# Prerequisites:
#   - Docker Engine 24+ and Docker Compose v2+
#   - /opt/phaseflag/.env.production populated (copy .env.production.example)
#   - SSL certificates at $SSL_CERT_DIR/live/<domain>/ (or Let's Encrypt)
#   - GHCR login: echo $CR_PAT | docker login ghcr.io -u <username> --password-stdin
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
ENV_FILE="/opt/phaseflag/.env.production"
COMPOSE_FILE="$(cd "$(dirname "$0")/../infra/docker" && pwd)/docker-compose.production.yml"
SKIP_PULL=false
IMAGE_TAG=""
HEALTH_TIMEOUT=120
API_BASE_URL=""

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case $1 in
        --env-file) ENV_FILE="$2"; shift 2 ;;
        --tag)      IMAGE_TAG="$2"; shift 2 ;;
        --skip-pull) SKIP_PULL=true; shift ;;
        --help|-h)
            echo "Usage: $0 [--env-file PATH] [--tag IMAGE_TAG] [--skip-pull]"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Step 1: Check prerequisites
# ---------------------------------------------------------------------------
info "Checking prerequisites..."

if ! command -v docker &>/dev/null; then
    error "Docker is not installed or not in PATH."
fi

if ! docker compose version &>/dev/null; then
    error "Docker Compose v2+ is required (docker compose, not docker-compose)."
fi

DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "0")
info "Docker version: $DOCKER_VERSION"
info "Docker Compose version: $(docker compose version --short 2>/dev/null || echo 'unknown')"

# ---------------------------------------------------------------------------
# Step 2: Validate .env.production
# ---------------------------------------------------------------------------
info "Validating environment file: $ENV_FILE"

if [[ ! -f "$ENV_FILE" ]]; then
    error "Environment file not found: $ENV_FILE\n  Copy .env.production.example and fill in all values."
fi

# Load env file for validation
set -o allexport
# shellcheck disable=SC1090
source "$ENV_FILE"
set +o allexport

# Override IMAGE_TAG if passed on command line
if [[ -n "$IMAGE_TAG" ]]; then
    export PHASEFLAG_IMAGE_TAG="$IMAGE_TAG"
fi

REQUIRED_VARS=(
    PHASEFLAG_DB_PASSWORD
    PHASEFLAG_JWT_SECRET_KEY
    PHASEFLAG_API_SECRET_KEY
)

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
    val="${!var:-}"
    if [[ -z "$val" || "$val" == *"replace"* || "$val" == *"change-me"* || "$val" == *"placeholder"* ]]; then
        MISSING+=("$var")
    fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
    error "The following required env vars are missing or still have placeholder values:\n  ${MISSING[*]}\n  Edit $ENV_FILE and set real values."
fi

success "Environment file validated."

# ---------------------------------------------------------------------------
# Step 3: Check SSL certificates
# ---------------------------------------------------------------------------
info "Checking SSL certificates..."

SSL_DIR="${SSL_CERT_DIR:-/etc/letsencrypt}"
API_DOMAIN="${API_DOMAIN:-api.phaseflag.com}"
DASHBOARD_DOMAIN="${DASHBOARD_DOMAIN:-app.phaseflag.com}"
RELAY_DOMAIN="${RELAY_DOMAIN:-relay.phaseflag.com}"

SSL_WARNINGS=0
for domain in "$API_DOMAIN" "$DASHBOARD_DOMAIN" "$RELAY_DOMAIN"; do
    cert_path="$SSL_DIR/live/$domain/fullchain.pem"
    key_path="$SSL_DIR/live/$domain/privkey.pem"
    if [[ ! -f "$cert_path" || ! -f "$key_path" ]]; then
        warn "SSL certificate not found for $domain at $SSL_DIR/live/$domain/"
        warn "  Obtain with: certbot certonly --standalone -d $domain"
        SSL_WARNINGS=$((SSL_WARNINGS + 1))
    else
        success "SSL certificate found for $domain"
    fi
done

if [[ $SSL_WARNINGS -gt 0 ]]; then
    warn "$SSL_WARNINGS domain(s) missing SSL certificates. Nginx will fail to start."
    warn "Continuing anyway — fix certificates before running nginx."
fi

# ---------------------------------------------------------------------------
# Step 4: Pull latest images
# ---------------------------------------------------------------------------
TAG="${PHASEFLAG_IMAGE_TAG:-latest}"

if [[ "$SKIP_PULL" == "false" ]]; then
    info "Pulling images from GHCR (tag: $TAG)..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull api relay dashboard || {
        warn "Image pull failed. Continuing with cached images if available."
    }
    success "Images pulled."
else
    info "Skipping image pull (--skip-pull)."
fi

# ---------------------------------------------------------------------------
# Step 5: Run database migrations
# ---------------------------------------------------------------------------
info "Running database migrations..."

# Start only DB first, wait for it to be healthy
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d db

info "Waiting for database to be healthy..."
TRIES=0
until docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps db \
      | grep -q "healthy"; do
    TRIES=$((TRIES + 1))
    if [[ $TRIES -ge 30 ]]; then
        error "Database did not become healthy within 60 seconds."
    fi
    sleep 2
done
success "Database is healthy."

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm migrate && \
    success "Migrations applied." || \
    error "Migrations failed. Check logs: docker compose -f $COMPOSE_FILE logs migrate"

# ---------------------------------------------------------------------------
# Step 6: Start all services
# ---------------------------------------------------------------------------
info "Starting all services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d \
    --remove-orphans \
    --force-recreate

success "All services started."

# ---------------------------------------------------------------------------
# Step 7: Verify health endpoints
# ---------------------------------------------------------------------------
info "Waiting for services to become healthy (timeout: ${HEALTH_TIMEOUT}s)..."

wait_healthy() {
    local service="$1"
    local url="$2"
    local tries=0
    local max=$((HEALTH_TIMEOUT / 3))

    until curl -sf "$url" >/dev/null 2>&1; do
        tries=$((tries + 1))
        if [[ $tries -ge $max ]]; then
            warn "$service health check timed out at $url"
            return 1
        fi
        sleep 3
    done
    success "$service is healthy at $url"
}

# Internal health checks via docker network (port 8000 exposed via nginx in prod)
wait_healthy "API (internal)"     "http://localhost:8000/health" || true
wait_healthy "Relay (internal)"   "http://localhost:8081/health" || true

# ---------------------------------------------------------------------------
# Step 8: Print deployment summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}  Phase Flag Production Deployment Done  ${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "  Deployment mode: ${PHASEFLAG_DEPLOYMENT_MODE:-saas}"
echo "  Image tag:       ${TAG}"
echo ""
echo "  Service URLs:"
echo "    API       https://${API_DOMAIN}"
echo "    Dashboard https://${DASHBOARD_DOMAIN}"
echo "    Relay     https://${RELAY_DOMAIN}"
echo ""
echo "  Useful commands:"
echo "    View logs:    docker compose -f $COMPOSE_FILE logs -f"
echo "    Check status: docker compose -f $COMPOSE_FILE ps"
echo "    Stop all:     docker compose -f $COMPOSE_FILE down"
echo ""

# Show running containers
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
