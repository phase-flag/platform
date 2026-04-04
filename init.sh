#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SaaS Scaffold Wizard — init.sh
# Creates a full product folder from the template scaffold.
# Run from anywhere: /path/to/template/init.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCAFFOLD_DIR="$TEMPLATE_DIR/scaffold"

# ── Colours ───────────────────────────────────────────────────────────────────
BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
MAGENTA='\033[0;35m'

banner() {
cat <<'EOF'

  ╔═══════════════════════════════════════════════════════════╗
  ║           SaaS Scaffold Wizard — init.sh                  ║
  ║   Generates a full multi-repo product structure           ║
  ║   powered by the Ralph AI execution agent                 ║
  ╚═══════════════════════════════════════════════════════════╝

EOF
}

prompt()  { echo -en "${CYAN}?${RESET} ${BOLD}$1${RESET}${DIM} $2${RESET}: "; }
header()  { echo -e "\n${MAGENTA}▶ $1${RESET}"; }
ok()      { echo -e "${GREEN}✓${RESET} $1"; }
warn()    { echo -e "${YELLOW}⚠${RESET} $1"; }
err()     { echo -e "${RED}✗${RESET} $1" >&2; }
info()    { echo -e "  ${DIM}$1${RESET}"; }

# ── Read with optional default ─────────────────────────────────────────────────
read_input() {
  local var_name="$1"
  local default="${2:-}"
  local value
  if [[ -n "$default" ]]; then
    read -r value
    value="${value:-$default}"
  else
    read -r value
    while [[ -z "$value" ]]; do
      err "Value is required."
      echo -en "  → "; read -r value
    done
  fi
  printf -v "$var_name" '%s' "$value"
}

# ── Slug: lowercase alphanumeric + hyphens ─────────────────────────────────────
to_slug() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g'; }

# ═════════════════════════════════════════════════════════════════════════════
banner

# ── Step 1: Product basics ────────────────────────────────────────────────────
header "Product Basics"

prompt "Product display name" "(e.g. Acme, DataFlow, ShipFast)"
read_input PRODUCT_NAME
PRODUCT_SLUG="$(to_slug "$PRODUCT_NAME")"
info "Slug: $PRODUCT_SLUG (used for folder names, repo names, package scopes)"

prompt "One-line description" "(what does it do?)"
read_input PRODUCT_DESCRIPTION

prompt "Root domain" "(e.g. acme.ca, dataflow.io)"
read_input ROOT_DOMAIN

API_DOMAIN="api.$ROOT_DOMAIN"
APP_DOMAIN="app.$ROOT_DOMAIN"
MARKETING_DOMAIN="$ROOT_DOMAIN"
OPS_DOMAIN="ops.$ROOT_DOMAIN"

info "Derived domains:"
info "  API:       $API_DOMAIN"
info "  App:       $APP_DOMAIN"
info "  Marketing: $MARKETING_DOMAIN"
info "  Ops:       $OPS_DOMAIN"

# ── Step 2: Infrastructure ────────────────────────────────────────────────────
header "Infrastructure & Accounts"

prompt "GitHub organization" "(e.g. acme-co, hextrot)"
read_input GITHUB_ORG

prompt "GitHub username" "(your personal GitHub handle)"
read_input GITHUB_USER

prompt "DigitalOcean account email" ""
read_input DO_EMAIL

prompt "Vercel username" ""
read_input VERCEL_USER

prompt "DigitalOcean region" "[tor1]"
read_input DO_REGION "tor1"

prompt "DigitalOcean Droplet size" "[s-2vcpu-4gb]"
read_input DO_SIZE "s-2vcpu-4gb"

prompt "SSH key name in DigitalOcean" "[prod-key]"
read_input SSH_KEY_NAME "prod-key"

prompt "DigitalOcean SSH key ID" "(from: doctl compute ssh-key list)"
read_input DO_SSH_KEY_ID ""

# ── Step 3: Database ──────────────────────────────────────────────────────────
header "Database Configuration"

prompt "Postgres database name" "[$PRODUCT_SLUG]"
read_input PG_DB "$PRODUCT_SLUG"

prompt "Postgres user" "[$PRODUCT_SLUG]"
read_input PG_USER "$PRODUCT_SLUG"

prompt "Postgres password (local dev)" "[${PRODUCT_SLUG}_dev]"
read_input PG_PASSWORD "${PRODUCT_SLUG}_dev"

prompt "Postgres version" "[16]"
read_input PG_VERSION "16"

prompt "Include Neo4j graph database?" "[y/N]"
read_input INCLUDE_GRAPH_INPUT "n"
INCLUDES_GRAPH=false
NEO4J_PASSWORD=""
if [[ "${INCLUDE_GRAPH_INPUT,,}" == "y" ]]; then
  INCLUDES_GRAPH=true
  prompt "Neo4j password (local dev)" "[${PRODUCT_SLUG}_graph]"
  read_input NEO4J_PASSWORD "${PRODUCT_SLUG}_graph"
fi

# ── Step 4: Ports ─────────────────────────────────────────────────────────────
header "Local Ports"

prompt "API port" "[3001]"
read_input API_PORT "3001"

prompt "App port" "[3000]"
read_input APP_PORT "3000"

prompt "Marketing site port" "[3002]"
read_input WEB_PORT "3002"

prompt "Ops dashboard port" "[3003]"
read_input OPS_PORT "3003"

# ── Step 5: Components ────────────────────────────────────────────────────────
header "Components to Include"

prompt "Include marketing site (apps/web)?" "[Y/n]"
read_input INCLUDE_WEB_INPUT "y"
INCLUDES_WEB=true
[[ "${INCLUDE_WEB_INPUT,,}" == "n" ]] && INCLUDES_WEB=false

prompt "Include ops dashboard (apps/ops)?" "[Y/n]"
read_input INCLUDE_OPS_INPUT "y"
INCLUDES_OPS=true
[[ "${INCLUDE_OPS_INPUT,,}" == "n" ]] && INCLUDES_OPS=false

prompt "Include DB scripts repo (${PRODUCT_SLUG}-db)?" "[Y/n]"
read_input INCLUDE_DB_INPUT "y"
INCLUDES_DB=true
[[ "${INCLUDE_DB_INPUT,,}" == "n" ]] && INCLUDES_DB=false

INCLUDES_GRAPH_REPO=false
if $INCLUDES_GRAPH; then
  prompt "Include graph scripts repo (${PRODUCT_SLUG}-graph)?" "[Y/n]"
  read_input INCLUDE_GRAPH_REPO_INPUT "y"
  [[ "${INCLUDE_GRAPH_REPO_INPUT,,}" != "n" ]] && INCLUDES_GRAPH_REPO=true
fi

# ── Step 6: Design system ─────────────────────────────────────────────────────
header "Design System — Colors"

echo "  CSS hsl() values. Press Enter to use dark SaaS defaults."
echo ""

prompt "Accent / primary color" "[hsl(172 62% 52%) — teal]"
read_input COLOR_ACCENT "hsl(172 62% 52%)"

prompt "Secondary / highlight color" "[hsl(42 90% 58%) — gold]"
read_input COLOR_SECONDARY "hsl(42 90% 58%)"

prompt "Canvas background" "[hsl(220 15% 8%) — dark warm gray]"
read_input COLOR_BG_CANVAS "hsl(220 15% 8%)"

prompt "Base background" "[hsl(220 13% 11%)]"
read_input COLOR_BG_BASE "hsl(220 13% 11%)"

prompt "Raised background" "[hsl(220 12% 14%)]"
read_input COLOR_BG_RAISED "hsl(220 12% 14%)"

# Raw accent for box-shadow (strip the hsl() wrapper)
COLOR_ACCENT_RAW="$(echo "$COLOR_ACCENT" | sed 's/hsl(//;s/)//')"

# ── Step 7: Typography / Fonts ────────────────────────────────────────────────
header "Design System — Typography & Fonts"

echo "  Choose Google Fonts loaded via next/font (zero layout shift)."
echo "  Press Enter to use defaults."
echo ""
echo -e "  ${DIM}Popular sans: Inter, Geist, Manrope, Plus_Jakarta_Sans, DM_Sans${RESET}"
echo -e "  ${DIM}Popular mono: JetBrains_Mono, Fira_Code, Geist_Mono${RESET}"
echo ""

prompt "Sans-serif font (Google Fonts name, underscores)" "[Inter]"
read_input FONT_SANS_NAME "Inter"

# Convert e.g. "Plus_Jakarta_Sans" → "Plus Jakarta Sans" for CSS fallback
FONT_SANS_DISPLAY="${FONT_SANS_NAME//_/ }"

prompt "Monospace font (Google Fonts name)" "[JetBrains_Mono]"
read_input FONT_MONO_NAME "JetBrains_Mono"
FONT_MONO_DISPLAY="${FONT_MONO_NAME//_/ }"

# Derive CSS variable names  e.g. Inter → font-inter, JetBrains_Mono → font-jetbrains-mono
FONT_SANS_VAR="$(to_slug "$FONT_SANS_DISPLAY")"
FONT_MONO_VAR="$(to_slug "$FONT_MONO_DISPLAY")"

# next/font import names (PascalCase camelCase — Google Fonts use underscored names directly)
FONT_SANS_IMPORT="$FONT_SANS_NAME"
FONT_MONO_IMPORT="$FONT_MONO_NAME"

# Fallback stacks
FONT_SANS_FALLBACK="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
FONT_MONO_FALLBACK="'${FONT_MONO_DISPLAY}', 'Fira Code', Consolas, monospace"

# Build next/font call strings
FONT_NEXT_IMPORT="${FONT_SANS_IMPORT}, ${FONT_MONO_IMPORT}"
FONT_NEXT_CALL_SANS="${FONT_SANS_IMPORT}({ subsets: [\"latin\"], variable: \"--font-${FONT_SANS_VAR}\", display: \"swap\" })"
FONT_NEXT_CALL_MONO="${FONT_MONO_IMPORT}({ subsets: [\"latin\"], variable: \"--font-${FONT_MONO_VAR}\", display: \"swap\" })"
FONT_MONO_GOOGLE="true"  # always true in this template

info "Sans: $FONT_SANS_DISPLAY  →  var(--font-$FONT_SANS_VAR)"
info "Mono: $FONT_MONO_DISPLAY  →  var(--font-$FONT_MONO_VAR)"

# ── Step 8: Output directory ──────────────────────────────────────────────────
header "Output Location"

DEFAULT_OUTPUT="$(dirname "$TEMPLATE_DIR")/$PRODUCT_SLUG"
prompt "Create product folder at" "[$DEFAULT_OUTPUT]"
read_input OUTPUT_DIR "$DEFAULT_OUTPUT"

WORKING_DIR="$OUTPUT_DIR"

# ── Confirmation ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════${RESET}"
echo -e "${BOLD} Ready to scaffold: ${CYAN}${PRODUCT_NAME}${RESET}"
echo -e "${BOLD}══════════════════════════════════════════${RESET}"
echo ""
echo -e "  Output:      ${GREEN}$OUTPUT_DIR${RESET}"
echo -e "  Slug:        $PRODUCT_SLUG"
echo -e "  Domain:      $ROOT_DOMAIN"
echo -e "  GitHub org:  $GITHUB_ORG"
echo -e "  Fonts:       $FONT_SANS_DISPLAY / $FONT_MONO_DISPLAY"
echo ""
echo -e "  Components:"
echo -e "    ✓ ${PRODUCT_SLUG}-api        (Fastify monorepo, port $API_PORT)"
echo -e "    ✓ ${PRODUCT_SLUG}-frontend/  (pnpm + Turborepo monorepo)"
echo -e "    ✓   packages/ui             (design tokens + shared components)"
echo -e "    ✓   packages/tsconfig       (shared TS presets)"
echo -e "    ✓   packages/env            (validated env schemas)"
echo -e "    ✓   apps/app               (main app, port $APP_PORT)"
$INCLUDES_WEB  && echo -e "    ✓   apps/web               (marketing, port $WEB_PORT)"
$INCLUDES_OPS  && echo -e "    ✓   apps/ops               (ops dashboard, port $OPS_PORT)"
$INCLUDES_DB   && echo -e "    ✓ ${PRODUCT_SLUG}-db       (DB scripts)"
$INCLUDES_GRAPH_REPO && echo -e "    ✓ ${PRODUCT_SLUG}-graph    (Neo4j scripts)"
echo ""

prompt "Proceed?" "[Y/n]"
read -r CONFIRM
[[ "${CONFIRM,,}" == "n" ]] && { echo "Cancelled."; exit 0; }

# ═════════════════════════════════════════════════════════════════════════════
# SCAFFOLDING
# ═════════════════════════════════════════════════════════════════════════════

CREATED_DATE="$(date -u +%Y-%m-%d)"

# ── Template substitution ─────────────────────────────────────────────────────
apply_template() {
  local src="$1"
  local dest="$2"
  local content
  content="$(cat "$src")"

  content="${content//\{\{PRODUCT_NAME\}\}/$PRODUCT_NAME}"
  content="${content//\{\{PRODUCT_SLUG\}\}/$PRODUCT_SLUG}"
  content="${content//\{\{PRODUCT_DESCRIPTION\}\}/$PRODUCT_DESCRIPTION}"
  content="${content//\{\{ROOT_DOMAIN\}\}/$ROOT_DOMAIN}"
  content="${content//\{\{API_DOMAIN\}\}/$API_DOMAIN}"
  content="${content//\{\{APP_DOMAIN\}\}/$APP_DOMAIN}"
  content="${content//\{\{MARKETING_DOMAIN\}\}/$MARKETING_DOMAIN}"
  content="${content//\{\{OPS_DOMAIN\}\}/$OPS_DOMAIN}"
  content="${content//\{\{GITHUB_ORG\}\}/$GITHUB_ORG}"
  content="${content//\{\{GITHUB_USER\}\}/$GITHUB_USER}"
  content="${content//\{\{DO_EMAIL\}\}/$DO_EMAIL}"
  content="${content//\{\{VERCEL_USER\}\}/$VERCEL_USER}"
  content="${content//\{\{DO_REGION\}\}/$DO_REGION}"
  content="${content//\{\{DO_SIZE\}\}/$DO_SIZE}"
  content="${content//\{\{DO_SSH_KEY_ID\}\}/$DO_SSH_KEY_ID}"
  content="${content//\{\{SSH_KEY_NAME\}\}/$SSH_KEY_NAME}"
  content="${content//\{\{PG_DB\}\}/$PG_DB}"
  content="${content//\{\{PG_USER\}\}/$PG_USER}"
  content="${content//\{\{PG_PASSWORD\}\}/$PG_PASSWORD}"
  content="${content//\{\{PG_VERSION\}\}/$PG_VERSION}"
  content="${content//\{\{NEO4J_PASSWORD\}\}/$NEO4J_PASSWORD}"
  content="${content//\{\{API_PORT\}\}/$API_PORT}"
  content="${content//\{\{APP_PORT\}\}/$APP_PORT}"
  content="${content//\{\{WEB_PORT\}\}/$WEB_PORT}"
  content="${content//\{\{OPS_PORT\}\}/$OPS_PORT}"
  content="${content//\{\{COLOR_ACCENT\}\}/$COLOR_ACCENT}"
  content="${content//\{\{COLOR_ACCENT_RAW\}\}/$COLOR_ACCENT_RAW}"
  content="${content//\{\{COLOR_SECONDARY\}\}/$COLOR_SECONDARY}"
  content="${content//\{\{COLOR_BG_CANVAS\}\}/$COLOR_BG_CANVAS}"
  content="${content//\{\{COLOR_BG_BASE\}\}/$COLOR_BG_BASE}"
  content="${content//\{\{COLOR_BG_RAISED\}\}/$COLOR_BG_RAISED}"
  content="${content//\{\{FONT_SANS_VAR\}\}/$FONT_SANS_VAR}"
  content="${content//\{\{FONT_MONO_VAR\}\}/$FONT_MONO_VAR}"
  content="${content//\{\{FONT_SANS_FALLBACK\}\}/$FONT_SANS_FALLBACK}"
  content="${content//\{\{FONT_MONO_FALLBACK\}\}/$FONT_MONO_FALLBACK}"
  content="${content//\{\{FONT_NEXT_IMPORT\}\}/$FONT_NEXT_IMPORT}"
  content="${content//\{\{FONT_NEXT_CALL_SANS\}\}/$FONT_NEXT_CALL_SANS}"
  content="${content//\{\{FONT_NEXT_CALL_MONO\}\}/$FONT_NEXT_CALL_MONO}"
  content="${content//\{\{WORKING_DIR\}\}/$WORKING_DIR}"
  content="${content//\{\{CREATED_DATE\}\}/$CREATED_DATE}"

  # Conditional blocks — use perl for both branches so each flag/closing pair
  # is matched precisely without clobbering adjacent blocks.
  for flag_var in INCLUDES_GRAPH INCLUDES_WEB INCLUDES_OPS INCLUDES_DB INCLUDES_GRAPH_REPO INCLUDES_PARSER FONT_MONO_GOOGLE; do
    flag_val="${!flag_var:-false}"
    if [[ "$flag_val" == "true" ]]; then
      # Keep content between tags, remove only the tag markers
      content="$(printf '%s' "$content" | perl -0777 -pe "s/\{\{#if ${flag_var}\}\}(.*?)\{\{\/if\}\}/\$1/gs")"
    else
      # Remove entire block including content
      content="$(printf '%s' "$content" | perl -0777 -pe "s/\{\{#if ${flag_var}\}\}.*?\{\{\/if\}\}//gs")"
    fi
  done

  # Clean up stray placeholders
  content="$(echo "$content" | sed 's/{{[^}]*}}//g')"

  mkdir -p "$(dirname "$dest")"
  printf '%s\n' "$content" > "$dest"
}

# ── Create output folder ──────────────────────────────────────────────────────
echo ""
header "Creating folder structure"

mkdir -p "$OUTPUT_DIR"
ok "Created: $OUTPUT_DIR"

# ── Root files ────────────────────────────────────────────────────────────────
apply_template "$SCAFFOLD_DIR/CLAUDE.md.tmpl"    "$OUTPUT_DIR/CLAUDE.md"
apply_template "$SCAFFOLD_DIR/prd.json.tmpl"     "$OUTPUT_DIR/prd.json"
apply_template "$SCAFFOLD_DIR/progress.txt.tmpl" "$OUTPUT_DIR/progress.txt"
cp             "$SCAFFOLD_DIR/ralph.sh"          "$OUTPUT_DIR/ralph.sh"
chmod +x       "$OUTPUT_DIR/ralph.sh"

cat > "$OUTPUT_DIR/prd.md" <<PRDEOF
# ${PRODUCT_NAME} — Product Requirements Document

> **Status:** Draft  |  **Created:** ${CREATED_DATE}
> **Description:** ${PRODUCT_DESCRIPTION}

---

## Overview

[Write your full PRD here.]

## Core Features

1. [Feature 1]
2. [Feature 2]

## Tech Stack

- **Backend:** Fastify, TypeScript, Drizzle ORM, Postgres ${PG_VERSION}
- **Frontend:** Next.js 15 (Turborepo monorepo), ${FONT_SANS_DISPLAY} font
- **Infrastructure:** DigitalOcean ${DO_REGION}, Vercel, GitHub Actions

## Domain Model

[Describe core entities]

## API Endpoints

[List key endpoints]
PRDEOF

ok "Created: CLAUDE.md, prd.json, progress.txt, ralph.sh, prd.md"

# ─────────────────────────────────────────────────────────────────────────────
# API MONOREPO
# ─────────────────────────────────────────────────────────────────────────────
API_DIR="$OUTPUT_DIR/${PRODUCT_SLUG}-api"
mkdir -p "$API_DIR/packages/api/src/routes"
mkdir -p "$API_DIR/packages/api/src/middleware"
mkdir -p "$API_DIR/packages/db/src/schema"
mkdir -p "$API_DIR/packages/db/drizzle"
mkdir -p "$API_DIR/packages/shared/src/types"
mkdir -p "$API_DIR/nginx"
mkdir -p "$API_DIR/scripts"
mkdir -p "$API_DIR/.github/workflows"

apply_template "$SCAFFOLD_DIR/components/api/docker-compose.yml.tmpl"      "$API_DIR/docker-compose.yml"
apply_template "$SCAFFOLD_DIR/components/api/docker-compose.prod.yml.tmpl" "$API_DIR/docker-compose.prod.yml"
apply_template "$SCAFFOLD_DIR/components/api/.env.example.tmpl"            "$API_DIR/.env.example"
apply_template "$SCAFFOLD_DIR/components/api/nginx/nginx.conf.tmpl"        "$API_DIR/nginx/nginx.conf"

cat > "$API_DIR/pnpm-workspace.yaml" <<'EOF'
packages:
  - "packages/*"
EOF

cat > "$API_DIR/package.json" <<EOF
{
  "name": "${PRODUCT_SLUG}-api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev":       "pnpm --filter @${PRODUCT_SLUG}/api dev",
    "build":     "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint":      "biome lint .",
    "format":    "biome format --write .",
    "check":     "biome check --write .",
    "db:migrate":"pnpm --filter @${PRODUCT_SLUG}/db migrate",
    "db:studio": "pnpm --filter @${PRODUCT_SLUG}/db studio"
  },
  "devDependencies": { "@biomejs/biome": "^1.9.0", "typescript": "^5.4.0" },
  "engines": { "node": ">=20", "pnpm": ">=9" }
}
EOF

cat > "$API_DIR/packages/api/package.json" <<EOF
{
  "name": "@${PRODUCT_SLUG}/api",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev":       "tsx watch src/index.ts",
    "build":     "tsc",
    "start":     "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@${PRODUCT_SLUG}/db":     "workspace:*",
    "@${PRODUCT_SLUG}/shared": "workspace:*",
    "@fastify/cors":   "^9.0.0",
    "@fastify/jwt":    "^8.0.0",
    "@fastify/swagger": "^8.0.0",
    "@fastify/swagger-ui": "^3.0.0",
    "fastify": "^4.28.0",
    "zod":     "^3.23.0"
  },
  "devDependencies": { "tsx": "^4.7.0", "typescript": "^5.4.0" }
}
EOF

cat > "$API_DIR/packages/api/src/index.ts" <<EOF
import Fastify from "fastify";
import cors    from "@fastify/cors";
import jwt     from "@fastify/jwt";
import swagger   from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: (process.env.CORS_ORIGIN ?? "http://localhost:${APP_PORT}").split(","),
});
await app.register(jwt, { secret: process.env.JWT_SECRET ?? "dev-secret-change-me" });
await app.register(swagger, {
  openapi: { info: { title: "${PRODUCT_NAME} API", version: "0.1.0" } },
});
await app.register(swaggerUi, { routePrefix: "/docs" });

app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

const port = Number(process.env.PORT ?? ${API_PORT});
await app.listen({ port, host: process.env.HOST ?? "0.0.0.0" });
EOF

cat > "$API_DIR/packages/db/package.json" <<EOF
{
  "name": "@${PRODUCT_SLUG}/db",
  "version": "0.1.0",
  "private": true,
  "scripts": { "migrate": "drizzle-kit migrate", "studio": "drizzle-kit studio", "typecheck": "tsc --noEmit" },
  "dependencies": { "drizzle-orm": "^0.31.0", "postgres": "^3.4.4" },
  "devDependencies": { "drizzle-kit": "^0.22.0", "typescript": "^5.4.0" }
}
EOF

cat > "$API_DIR/packages/db/src/schema/users.ts" <<'EOF'
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id:           uuid("id").primaryKey().defaultRandom(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
EOF

cat > "$API_DIR/packages/db/src/index.ts" <<EOF
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/users.js";

const client = postgres(process.env.DATABASE_URL ?? "postgresql://${PG_USER}:${PG_PASSWORD}@localhost:5432/${PG_DB}");
export const db = drizzle(client, { schema });
export * from "./schema/users.js";
EOF

cat > "$API_DIR/packages/shared/package.json" <<EOF
{
  "name": "@${PRODUCT_SLUG}/shared",
  "version": "0.1.0",
  "private": true,
  "scripts": { "typecheck": "tsc --noEmit" },
  "devDependencies": { "typescript": "^5.4.0" }
}
EOF

cat > "$API_DIR/packages/shared/src/types/index.ts" <<'EOF'
export interface ApiResponse<T> { data: T; meta?: Record<string, unknown>; }
export interface ApiError { error: string; message: string; statusCode: number; }
export interface Paginated<T> extends ApiResponse<T[]> {
  meta: { total: number; page: number; limit: number };
}
EOF

cat > "$API_DIR/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "outDir": "dist", "declaration": true
  },
  "exclude": ["node_modules", "dist"]
}
EOF

cat > "$API_DIR/.gitignore" <<'EOF'
node_modules/
dist/
.env
*.env.local
.DS_Store
EOF

cp "$SCAFFOLD_DIR/components/api/biome.json" "$API_DIR/biome.json"

cat > "$API_DIR/packages/api/Dockerfile" <<EOF
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm i -g pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/api/package.json    packages/api/
COPY packages/db/package.json     packages/db/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE ${API_PORT}
CMD ["node", "dist/index.js"]
EOF

cat > "$API_DIR/.github/workflows/ci.yml" <<'EOF'
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm build
EOF

ok "Created: ${PRODUCT_SLUG}-api/"

# ─────────────────────────────────────────────────────────────────────────────
# FRONTEND MONOREPO  ({slug}-frontend/)
# ─────────────────────────────────────────────────────────────────────────────
FE_DIR="$OUTPUT_DIR/${PRODUCT_SLUG}-frontend"

# packages/ui
UI_DIR="$FE_DIR/packages/ui"
mkdir -p "$UI_DIR/src/components"

apply_template "$SCAFFOLD_DIR/components/frontend/packages/ui/src/tokens.css.tmpl" "$UI_DIR/src/tokens.css"
cp             "$SCAFFOLD_DIR/components/frontend/packages/ui/src/base.css"         "$UI_DIR/src/base.css"
cp             "$SCAFFOLD_DIR/components/frontend/packages/ui/src/components/Button.tsx" "$UI_DIR/src/components/Button.tsx"
cp             "$SCAFFOLD_DIR/components/frontend/packages/ui/src/components/Card.tsx"   "$UI_DIR/src/components/Card.tsx"
cp             "$SCAFFOLD_DIR/components/frontend/packages/ui/src/components/Input.tsx"  "$UI_DIR/src/components/Input.tsx"
cp             "$SCAFFOLD_DIR/components/frontend/packages/ui/src/components/Badge.tsx"  "$UI_DIR/src/components/Badge.tsx"
cp             "$SCAFFOLD_DIR/components/frontend/packages/ui/src/index.ts"              "$UI_DIR/src/index.ts"
apply_template "$SCAFFOLD_DIR/components/frontend/packages/ui/package.json.tmpl"         "$UI_DIR/package.json"

# tsconfig in ui uses @{slug}/tsconfig but it will be a local ref — write directly
cat > "$UI_DIR/tsconfig.json" <<EOF
{
  "extends": "@${PRODUCT_SLUG}/tsconfig/base.json",
  "compilerOptions": {
    "jsx": "react-jsx", "outDir": "./dist", "rootDir": "./src", "declaration": true
  },
  "include": ["src"], "exclude": ["node_modules", "dist"]
}
EOF

# packages/tsconfig
TSCONFIG_DIR="$FE_DIR/packages/tsconfig"
mkdir -p "$TSCONFIG_DIR"
cp "$SCAFFOLD_DIR/components/frontend/packages/tsconfig/base.json"   "$TSCONFIG_DIR/base.json"
cp "$SCAFFOLD_DIR/components/frontend/packages/tsconfig/nextjs.json" "$TSCONFIG_DIR/nextjs.json"
apply_template "$SCAFFOLD_DIR/components/frontend/packages/tsconfig/package.json.tmpl" "$TSCONFIG_DIR/package.json"

# packages/env
ENV_DIR="$FE_DIR/packages/env"
mkdir -p "$ENV_DIR/src"
apply_template "$SCAFFOLD_DIR/components/frontend/packages/env/src/index.ts.tmpl" "$ENV_DIR/src/index.ts"
apply_template "$SCAFFOLD_DIR/components/frontend/packages/env/package.json.tmpl" "$ENV_DIR/package.json"
cat > "$ENV_DIR/tsconfig.json" <<EOF
{
  "extends": "@${PRODUCT_SLUG}/tsconfig/base.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src" },
  "include": ["src"]
}
EOF

# Monorepo root
apply_template "$SCAFFOLD_DIR/components/frontend/turbo.json.tmpl"    "$FE_DIR/turbo.json"
apply_template "$SCAFFOLD_DIR/components/frontend/package.json.tmpl"   "$FE_DIR/package.json"
cp             "$SCAFFOLD_DIR/components/frontend/pnpm-workspace.yaml" "$FE_DIR/pnpm-workspace.yaml"
cp             "$SCAFFOLD_DIR/components/frontend/biome.json"          "$FE_DIR/biome.json"

cat > "$FE_DIR/.gitignore" <<'EOF'
node_modules/
.next/
.vercel/
dist/
.env*.local
.DS_Store
.turbo/
EOF

# VS Code workspace config
mkdir -p "$FE_DIR/.vscode"
cp "$SCAFFOLD_DIR/components/frontend/.vscode/extensions.json" "$FE_DIR/.vscode/extensions.json"
cp "$SCAFFOLD_DIR/components/frontend/.vscode/settings.json"   "$FE_DIR/.vscode/settings.json"

# GitHub Actions CI
mkdir -p "$FE_DIR/.github/workflows"
apply_template "$SCAFFOLD_DIR/components/frontend/.github/workflows/ci.yml.tmpl" \
               "$FE_DIR/.github/workflows/ci.yml"

# packages/api-client
API_CLIENT_DIR="$FE_DIR/packages/api-client"
mkdir -p "$API_CLIENT_DIR/src" "$API_CLIENT_DIR/scripts"
apply_template "$SCAFFOLD_DIR/components/frontend/packages/api-client/package.json.tmpl"    "$API_CLIENT_DIR/package.json"
apply_template "$SCAFFOLD_DIR/components/frontend/packages/api-client/tsconfig.json.tmpl"   "$API_CLIENT_DIR/tsconfig.json"
apply_template "$SCAFFOLD_DIR/components/frontend/packages/api-client/src/index.ts.tmpl"    "$API_CLIENT_DIR/src/index.ts"
cp             "$SCAFFOLD_DIR/components/frontend/packages/api-client/src/api.gen.ts"        "$API_CLIENT_DIR/src/api.gen.ts"
cp             "$SCAFFOLD_DIR/components/frontend/packages/api-client/scripts/sync-types.ts" "$API_CLIENT_DIR/scripts/sync-types.ts"
# Replace slug placeholder in sync-types.ts (it has a literal {slug} reference in a comment)
sed -i '' "s/{slug}/${PRODUCT_SLUG}/g" "$API_CLIENT_DIR/scripts/sync-types.ts" 2>/dev/null || \
  sed -i    "s/{slug}/${PRODUCT_SLUG}/g" "$API_CLIENT_DIR/scripts/sync-types.ts"

# ── Helper to create a Next.js app within the monorepo ────────────────────────
create_next_app() {
  local app_name="$1"    # app | web | ops
  local app_port="$2"
  local app_title="$3"
  local app_dir="$FE_DIR/apps/$app_name"

  mkdir -p "$app_dir/src/app" "$app_dir/src/components" "$app_dir/public"

  # package.json
  apply_template "$SCAFFOLD_DIR/components/frontend/apps/app/package.json.tmpl" \
                 "$app_dir/package_raw.json"
  # Patch name + port
  sed "s/@${PRODUCT_SLUG}\/app/@${PRODUCT_SLUG}\/${app_name}/g; \
       s/\"dev\": \"next dev -p ${APP_PORT}\"/\"dev\": \"next dev -p ${app_port}\"/g; \
       s/\"start\": \"next start -p ${APP_PORT}\"/\"start\": \"next start -p ${app_port}\"/g" \
       "$app_dir/package_raw.json" > "$app_dir/package.json"
  rm "$app_dir/package_raw.json"

  # tsconfig
  apply_template "$SCAFFOLD_DIR/components/frontend/apps/app/tsconfig.json.tmpl" "$app_dir/tsconfig.json"

  # postcss
  cat > "$app_dir/postcss.config.mjs" <<'PCSS'
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
PCSS

  # next.config.ts — only app gets API rewrite
  if [[ "$app_name" == "app" ]]; then
    apply_template "$SCAFFOLD_DIR/components/app/next.config.ts.tmpl" "$app_dir/next.config.ts"
  else
    cat > "$app_dir/next.config.ts" <<'NCF'
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
NCF
  fi

  # .env.local.example
  cat > "$app_dir/.env.local.example" <<EOF
NEXT_PUBLIC_API_URL=http://localhost:${API_PORT}
NEXT_PUBLIC_APP_NAME=${PRODUCT_NAME}
EOF

  # globals.css — imports from @{slug}/ui
  cat > "$app_dir/src/globals.css" <<EOF
@import "tailwindcss";

/* Tell Tailwind v4 to scan the shared UI package for component classes.
   Without this, classes used in packages/ui components won't be included. */
@source "../../packages/ui/src";

@import "@${PRODUCT_SLUG}/ui/tokens.css";
@import "@${PRODUCT_SLUG}/ui/base.css";

/* ${app_title} — app-specific overrides only */
EOF

  # layout.tsx with next/font
  apply_template "$SCAFFOLD_DIR/components/frontend/apps/app/src/app/layout.tsx.tmpl" \
                 "$app_dir/src/app/layout.tsx"
  # Patch title for non-app apps
  if [[ "$app_name" != "app" ]]; then
    sed -i '' "s/default:  \"${PRODUCT_NAME}\"/default:  \"${app_title}\"/" "$app_dir/src/app/layout.tsx" 2>/dev/null || true
  fi

  # page.tsx
  cat > "$app_dir/src/app/page.tsx" <<EOF
export default function Home() {
  return (
    <main style={{ padding: "var(--space-8)" }}>
      <h1>${app_title}</h1>
      <p style={{ color: "var(--color-neutral-200)", marginTop: "var(--space-2)" }}>
        ${PRODUCT_DESCRIPTION}
      </p>
    </main>
  );
}
EOF
}

create_next_app "app" "$APP_PORT" "$PRODUCT_NAME"
ok "Created: ${PRODUCT_SLUG}-frontend/apps/app/"

if $INCLUDES_WEB; then
  create_next_app "web" "$WEB_PORT" "$PRODUCT_NAME — Landing"
  ok "Created: ${PRODUCT_SLUG}-frontend/apps/web/"
fi

if $INCLUDES_OPS; then
  create_next_app "ops" "$OPS_PORT" "$PRODUCT_NAME Ops"
  ok "Created: ${PRODUCT_SLUG}-frontend/apps/ops/"
fi

ok "Created: ${PRODUCT_SLUG}-frontend/ (Turborepo monorepo)"

# ─────────────────────────────────────────────────────────────────────────────
# DB SCRIPTS
# ─────────────────────────────────────────────────────────────────────────────
if $INCLUDES_DB; then
  DB_DIR="$OUTPUT_DIR/${PRODUCT_SLUG}-db"
  mkdir -p "$DB_DIR/ddl" "$DB_DIR/seeds" "$DB_DIR/backups" "$DB_DIR/maintenance"

  apply_template "$SCAFFOLD_DIR/components/db/Makefile.tmpl" "$DB_DIR/Makefile"

  cat > "$DB_DIR/.env.example" <<EOF
PG_HOST=localhost
PG_PORT=5432
PG_USER=${PG_USER}
PG_PASSWORD=${PG_PASSWORD}
PG_DB=${PG_DB}
EOF

  cat > "$DB_DIR/.gitignore" <<'EOF'
.env
backups/
EOF

  cat > "$DB_DIR/ddl/001_core.sql" <<EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
EOF

  ok "Created: ${PRODUCT_SLUG}-db/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GRAPH SCRIPTS
# ─────────────────────────────────────────────────────────────────────────────
if $INCLUDES_GRAPH_REPO; then
  GRAPH_DIR="$OUTPUT_DIR/${PRODUCT_SLUG}-graph"
  mkdir -p "$GRAPH_DIR/cypher" "$GRAPH_DIR/scripts"

  cat > "$GRAPH_DIR/.env.example" <<EOF
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=${NEO4J_PASSWORD}
EOF

  cat > "$GRAPH_DIR/.gitignore" <<'EOF'
.env
node_modules/
EOF

  cat > "$GRAPH_DIR/Makefile" <<EOF
include .env
export

.PHONY: shell seed

shell:
	cypher-shell -a \$(NEO4J_URI) -u \$(NEO4J_USER) -p \$(NEO4J_PASSWORD)

seed:
	@for f in cypher/*.cypher; do \\
		echo "  → \$\$f"; \\
		cypher-shell -a \$(NEO4J_URI) -u \$(NEO4J_USER) -p \$(NEO4J_PASSWORD) -f "\$\$f"; \\
	done
EOF

  ok "Created: ${PRODUCT_SLUG}-graph/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# GIT INIT ALL REPOS
# ─────────────────────────────────────────────────────────────────────────────
header "Initializing git repos"

for repo_dir in \
    "$OUTPUT_DIR/${PRODUCT_SLUG}-api" \
    "$OUTPUT_DIR/${PRODUCT_SLUG}-frontend" \
    $( $INCLUDES_DB   && echo "$OUTPUT_DIR/${PRODUCT_SLUG}-db"    ) \
    $( $INCLUDES_GRAPH_REPO && echo "$OUTPUT_DIR/${PRODUCT_SLUG}-graph" ); do
  [[ -d "$repo_dir" ]] || continue
  cd "$repo_dir"
  git init -q
  git add -A
  git commit -q -m "chore: initial scaffold from template"
  ok "git init: $(basename "$repo_dir")"
done

cd "$OUTPUT_DIR"

# ═════════════════════════════════════════════════════════════════════════════
# DONE
# ═════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}  Scaffold complete! 🎉${RESET}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Product:${RESET}  ${PRODUCT_NAME}"
echo -e "  ${BOLD}Location:${RESET} ${OUTPUT_DIR}"
echo -e "  ${BOLD}Fonts:${RESET}    ${FONT_SANS_DISPLAY} (sans) / ${FONT_MONO_DISPLAY} (mono)"
echo ""
echo -e "${BOLD}Repo structure:${RESET}"
echo -e "  ${PRODUCT_SLUG}-api/              backend Fastify monorepo"
echo -e "  ${PRODUCT_SLUG}-frontend/         Next.js 15 Turborepo"
echo -e "    packages/ui/                  design tokens + shared components"
echo -e "    packages/tsconfig/            shared TS presets"
echo -e "    packages/env/                 validated env schemas (t3-env)"
echo -e "    packages/api-client/          typed fetch client (openapi-fetch)"
echo -e "    apps/app/                     main app"
$INCLUDES_WEB && echo -e "    apps/web/                     marketing site"
$INCLUDES_OPS && echo -e "    apps/ops/                     ops dashboard"
$INCLUDES_DB  && echo -e "  ${PRODUCT_SLUG}-db/              DB scripts"
$INCLUDES_GRAPH_REPO && echo -e "  ${PRODUCT_SLUG}-graph/           Neo4j scripts"
echo ""
echo -e "${BOLD}Single-edit points:${RESET}"
echo -e "  Brand tokens:  ${PRODUCT_SLUG}-frontend/packages/ui/src/tokens.css"
echo -e "  TS config:     ${PRODUCT_SLUG}-frontend/packages/tsconfig/{base,nextjs}.json"
echo -e "  API types:     pnpm api-client:sync  (run after API schema changes)"
echo -e "  Lint rules:    ${PRODUCT_SLUG}-frontend/biome.json  (covers all apps)"
echo ""
echo -e "${BOLD}Next steps:${RESET}"
echo ""
echo -e "  ${CYAN}1. Edit prd.md with your product spec${RESET}"
echo ""
echo -e "  ${CYAN}2. Expand prd.json — paste this prompt into Claude Code:${RESET}"
echo ""
echo -e "${DIM}────────────────────────────────────────────────────────${RESET}"
cat <<INITPROMPT
Read prd.md and the existing prd.json (21 infra stories).

Extend prd.json with 20-30 product-specific stories for ${PRODUCT_NAME}.
Continue IDs from US-022. Cover: data model, API endpoints, frontend
pages, background jobs, integrations, and product-specific infra.

Each story needs: id, title, priority, phase, description,
acceptance_criteria (array), passes: false.

Do not modify the existing 21 stories. Write the full updated prd.json.

Product: ${PRODUCT_DESCRIPTION}
INITPROMPT
echo -e "${DIM}────────────────────────────────────────────────────────${RESET}"
echo ""
echo -e "  ${CYAN}3. Run Ralph:${RESET}"
echo -e "     cd \"${OUTPUT_DIR}\""
echo -e "     ./ralph.sh"
echo ""
echo -e "  ${CYAN}4. Develop locally:${RESET}"
echo -e "     cd ${PRODUCT_SLUG}-api && pnpm install && docker compose up -d && pnpm dev"
echo -e "     cd ${PRODUCT_SLUG}-frontend && pnpm install && pnpm dev"
echo ""
echo -e "  ${CYAN}5. Sync API types (after API schema changes):${RESET}"
echo -e "     cd ${PRODUCT_SLUG}-frontend && pnpm api-client:sync"
echo -e "     # fetches /docs/json from running API → regenerates packages/api-client/src/api.gen.ts"
echo ""
echo -e "${DIM}Tip: pnpm dev:app  |  pnpm dev:web  |  pnpm dev:ops  (run individual apps)${RESET}"
echo -e "${DIM}     pnpm check                                        (Biome lint + format all)${RESET}"
echo ""
