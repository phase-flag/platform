#!/usr/bin/env bash
# seed-demo.sh — Populate the Phase Flag production API with comprehensive demo data
# Usage: ./scripts/seed-demo.sh
set -euo pipefail

API="https://api.phaseflag.com/api/v1"
EMAIL="admin@phaseflag.com"
PASSWORD="PhaseFlag2026!"

# ─── Helpers ─────────────────────────────────────────────────────────────────

log()  { echo "  $*"; }
ok()   { echo "  [ok] $*"; }
skip() { echo "  [skip] $* — already exists"; }
err()  { echo "  [error] $*" >&2; }

api_post() {
  local path="$1"
  local body="$2"
  curl -s -X POST "${API}${path}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "$body"
}

api_get() {
  local path="$1"
  curl -s -X GET "${API}${path}" \
    -H "Authorization: Bearer ${TOKEN}"
}

status_of() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','ERR') if isinstance(d,dict) else 'ERR')" 2>/dev/null
}

# ─── Auth ─────────────────────────────────────────────────────────────────────

echo ""
echo "Phase Flag — Demo Data Seed Script"
echo "==================================="
echo ""
echo "Authenticating as ${EMAIL}..."

LOGIN_RESP=$(curl -s -X POST "${API}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token') or d.get('access_token',''))" 2>/dev/null)

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: Authentication failed. Response: $LOGIN_RESP"
  exit 1
fi

ok "Authenticated — token obtained"

# ─── Create flag helper ───────────────────────────────────────────────────────

create_flag() {
  local key="$1"
  local payload="$2"
  local enable="${3:-false}"   # whether to toggle active after creation

  # Check if flag already exists
  local existing
  existing=$(api_get "/flags/${key}")
  if echo "$existing" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('key') else 1)" 2>/dev/null; then
    skip "$key"
    if [[ "$enable" == "true" ]]; then
      local st
      st=$(echo "$existing" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))" 2>/dev/null)
      if [[ "$st" != "active" ]]; then
        api_post "/flags/${key}/toggle" '{}' > /dev/null
      fi
    fi
    return
  fi

  local resp
  resp=$(api_post "/flags" "$payload")

  if echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('id') else 1)" 2>/dev/null; then
    ok "created $key"
    if [[ "$enable" == "true" ]]; then
      api_post "/flags/${key}/toggle" '{}' > /dev/null
    fi
  else
    err "$key — $(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d)" 2>/dev/null)"
  fi
}

# ─── Boolean Flags ────────────────────────────────────────────────────────────

echo ""
echo "Creating boolean flags..."

create_flag "dark-mode" '{
  "key": "dark-mode",
  "name": "Dark Mode",
  "description": "Toggle dark theme across the application",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "Enabled", "value": true},
    {"key": "off", "name": "Disabled", "value": false}
  ],
  "default_variation_key": "on",
  "tags": ["ui", "theme"]
}' "true"

create_flag "maintenance-mode" '{
  "key": "maintenance-mode",
  "name": "Maintenance Mode",
  "description": "Kill switch for maintenance banner",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "Enabled", "value": true},
    {"key": "off", "name": "Disabled", "value": false}
  ],
  "default_variation_key": "off",
  "tags": ["ops", "kill-switch"]
}' "false"

create_flag "new-checkout" '{
  "key": "new-checkout",
  "name": "New Checkout Flow",
  "description": "Redesigned checkout experience",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "New Flow", "value": true},
    {"key": "off", "name": "Legacy Flow", "value": false}
  ],
  "default_variation_key": "on",
  "tags": ["checkout", "experiment"]
}' "true"

create_flag "beta-features" '{
  "key": "beta-features",
  "name": "Beta Features",
  "description": "Enable beta feature set for early adopters",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "Enabled", "value": true},
    {"key": "off", "name": "Disabled", "value": false}
  ],
  "default_variation_key": "on",
  "tags": ["beta", "targeting"]
}' "true"

create_flag "signup-v2" '{
  "key": "signup-v2",
  "name": "Signup V2",
  "description": "New signup flow with social login",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "New Signup", "value": true},
    {"key": "off", "name": "Classic Signup", "value": false}
  ],
  "default_variation_key": "off",
  "tags": ["auth", "experiment"]
}' "false"

create_flag "email-notifications" '{
  "key": "email-notifications",
  "name": "Email Notifications",
  "description": "Controls whether transactional emails are sent to users",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "Enabled", "value": true},
    {"key": "off", "name": "Disabled", "value": false}
  ],
  "default_variation_key": "on",
  "tags": ["email", "notifications"]
}' "true"

create_flag "two-factor-auth" '{
  "key": "two-factor-auth",
  "name": "Two-Factor Authentication",
  "description": "Enforce 2FA for all user accounts",
  "flag_type": "boolean",
  "variations": [
    {"key": "required", "name": "Required", "value": true},
    {"key": "optional", "name": "Optional", "value": false}
  ],
  "default_variation_key": "optional",
  "tags": ["security", "auth"]
}' "false"

# ─── String Flags ─────────────────────────────────────────────────────────────

echo ""
echo "Creating string flags..."

create_flag "onboarding-flow" '{
  "key": "onboarding-flow",
  "name": "Onboarding Experience",
  "description": "Controls which onboarding flow new users see",
  "flag_type": "string",
  "variations": [
    {"key": "classic", "name": "Classic", "value": "classic"},
    {"key": "wizard", "name": "Wizard", "value": "wizard"},
    {"key": "video-tour", "name": "Video Tour", "value": "video-tour"}
  ],
  "default_variation_key": "classic",
  "tags": ["onboarding", "experiment"]
}' "true"

create_flag "pricing-layout" '{
  "key": "pricing-layout",
  "name": "Pricing Page Layout",
  "description": "Controls the visual layout of the pricing page",
  "flag_type": "string",
  "variations": [
    {"key": "grid", "name": "Grid", "value": "grid"},
    {"key": "table", "name": "Table", "value": "table"},
    {"key": "slider", "name": "Slider", "value": "slider"}
  ],
  "default_variation_key": "grid",
  "tags": ["marketing", "experiment"]
}' "true"

create_flag "cta-text" '{
  "key": "cta-text",
  "name": "CTA Button Text",
  "description": "A/B test for the primary call-to-action button copy",
  "flag_type": "string",
  "variations": [
    {"key": "get-started", "name": "Get Started", "value": "Get Started"},
    {"key": "try-free", "name": "Try Free", "value": "Try Free"},
    {"key": "start-building", "name": "Start Building", "value": "Start Building"}
  ],
  "default_variation_key": "get-started",
  "tags": ["marketing", "copy", "experiment"]
}' "true"

create_flag "support-tier" '{
  "key": "support-tier",
  "name": "Support Tier Experience",
  "description": "Controls which support chat tier is shown based on plan",
  "flag_type": "string",
  "variations": [
    {"key": "community", "name": "Community", "value": "community"},
    {"key": "standard", "name": "Standard", "value": "standard"},
    {"key": "priority", "name": "Priority", "value": "priority"}
  ],
  "default_variation_key": "community",
  "tags": ["support", "billing"]
}' "true"

# ─── Number Flags ─────────────────────────────────────────────────────────────

echo ""
echo "Creating number flags..."

create_flag "max-projects" '{
  "key": "max-projects",
  "name": "Max Projects Per User",
  "description": "Maximum number of projects a user can create, gated by plan tier",
  "flag_type": "number",
  "variations": [
    {"key": "free-limit", "name": "Free (3)", "value": 3},
    {"key": "pro-limit", "name": "Pro (10)", "value": 10},
    {"key": "unlimited", "name": "Unlimited", "value": 999}
  ],
  "default_variation_key": "free-limit",
  "tags": ["billing", "limits"]
}' "true"

create_flag "rate-limit" '{
  "key": "rate-limit",
  "name": "API Rate Limit",
  "description": "Requests per minute allowed per API key",
  "flag_type": "number",
  "variations": [
    {"key": "standard", "name": "Standard (60)", "value": 60},
    {"key": "pro", "name": "Pro (120)", "value": 120},
    {"key": "enterprise", "name": "Enterprise (500)", "value": 500}
  ],
  "default_variation_key": "standard",
  "tags": ["api", "limits", "billing"]
}' "true"

create_flag "session-timeout" '{
  "key": "session-timeout",
  "name": "Session Timeout (min)",
  "description": "How many minutes before an idle session expires",
  "flag_type": "number",
  "variations": [
    {"key": "short", "name": "Short (15 min)", "value": 15},
    {"key": "standard", "name": "Standard (30 min)", "value": 30},
    {"key": "extended", "name": "Extended (60 min)", "value": 60}
  ],
  "default_variation_key": "standard",
  "tags": ["security", "session"]
}' "true"

create_flag "search-results-limit" '{
  "key": "search-results-limit",
  "name": "Search Results Per Page",
  "description": "Controls how many results are returned per search page",
  "flag_type": "number",
  "variations": [
    {"key": "compact", "name": "Compact (10)", "value": 10},
    {"key": "default", "name": "Default (25)", "value": 25},
    {"key": "expanded", "name": "Expanded (50)", "value": 50}
  ],
  "default_variation_key": "default",
  "tags": ["search", "performance"]
}' "true"

# ─── JSON Flags ───────────────────────────────────────────────────────────────

echo ""
echo "Creating JSON flags..."

create_flag "dashboard-config" '{
  "key": "dashboard-config",
  "name": "Dashboard Widget Config",
  "description": "JSON config controlling which KPI widgets appear on the dashboard",
  "flag_type": "json",
  "variations": [
    {"key": "basic", "name": "Basic", "value": {"widgets": ["tasks", "projects"], "layout": "2-col", "refresh_interval": 60}},
    {"key": "advanced", "name": "Advanced", "value": {"widgets": ["tasks", "projects", "velocity", "burndown", "activity"], "layout": "4-col", "refresh_interval": 30}}
  ],
  "default_variation_key": "basic",
  "tags": ["ui", "dashboard"]
}' "true"

create_flag "feature-gates" '{
  "key": "feature-gates",
  "name": "Feature Gate Configuration",
  "description": "JSON map of features enabled per plan tier",
  "flag_type": "json",
  "variations": [
    {"key": "free", "name": "Free Tier", "value": {"analytics": false, "exports": false, "api_access": true, "sso": false, "audit_log": false}},
    {"key": "pro", "name": "Pro Tier", "value": {"analytics": true, "exports": true, "api_access": true, "sso": false, "audit_log": true}},
    {"key": "enterprise", "name": "Enterprise Tier", "value": {"analytics": true, "exports": true, "api_access": true, "sso": true, "audit_log": true}}
  ],
  "default_variation_key": "free",
  "tags": ["billing", "gates", "enterprise"]
}' "true"

create_flag "theme-config" '{
  "key": "theme-config",
  "name": "Theme Configuration",
  "description": "Full theme token configuration for white-labeling",
  "flag_type": "json",
  "variations": [
    {"key": "default", "name": "Phase Flag Default", "value": {"primary": "#6366f1", "secondary": "#8b5cf6", "accent": "#06b6d4", "radius": "0.5rem"}},
    {"key": "enterprise-blue", "name": "Enterprise Blue", "value": {"primary": "#1d4ed8", "secondary": "#2563eb", "accent": "#0ea5e9", "radius": "0.25rem"}}
  ],
  "default_variation_key": "default",
  "tags": ["ui", "theme", "enterprise"]
}' "true"

# ─── Nexus Showcase Flags ─────────────────────────────────────────────────────

echo ""
echo "Creating nexus showcase flags..."

create_flag "nexus-dark-mode" '{
  "key": "nexus-dark-mode",
  "name": "Dark Mode",
  "description": "Toggle the Nexus app between light and dark theme",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "Enabled", "value": true},
    {"key": "off", "name": "Disabled", "value": false}
  ],
  "default_variation_key": "on",
  "tags": ["ui", "theme"]
}' "true"

create_flag "nexus-task-layout" '{
  "key": "nexus-task-layout",
  "name": "Task Card Layout",
  "description": "Controls the visual style of task cards (compact, standard, detailed)",
  "flag_type": "string",
  "variations": [
    {"key": "compact", "name": "Compact", "value": "compact"},
    {"key": "standard", "name": "Standard", "value": "standard"},
    {"key": "detailed", "name": "Detailed", "value": "detailed"}
  ],
  "default_variation_key": "standard",
  "tags": ["ui", "experiment"]
}' "true"

create_flag "nexus-max-projects" '{
  "key": "nexus-max-projects",
  "name": "Max Projects",
  "description": "Maximum number of projects a user can create, gated by plan tier",
  "flag_type": "number",
  "variations": [
    {"key": "free-limit", "name": "Free (3)", "value": 3},
    {"key": "pro-limit", "name": "Pro (10)", "value": 10},
    {"key": "unlimited", "name": "Unlimited", "value": 999}
  ],
  "default_variation_key": "free-limit",
  "tags": ["billing", "limits"]
}' "true"

create_flag "nexus-dashboard-widgets" '{
  "key": "nexus-dashboard-widgets",
  "name": "Dashboard Widget Config",
  "description": "JSON config controlling which KPI widgets appear on the dashboard",
  "flag_type": "json",
  "variations": [
    {"key": "basic", "name": "Basic", "value": {"widgets": ["tasks", "projects"], "layout": "2-col"}},
    {"key": "advanced", "name": "Advanced", "value": {"widgets": ["tasks", "projects", "velocity", "burndown"], "layout": "4-col"}}
  ],
  "default_variation_key": "basic",
  "tags": ["ui", "dashboard"]
}' "true"

create_flag "nexus-beta-features" '{
  "key": "nexus-beta-features",
  "name": "Beta Features Access",
  "description": "Shows Labs section — only for enterprise users or internal emails",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "Enabled", "value": true},
    {"key": "off", "name": "Disabled", "value": false}
  ],
  "default_variation_key": "off",
  "tags": ["targeting", "beta"]
}' "true"

create_flag "nexus-chat-widget" '{
  "key": "nexus-chat-widget",
  "name": "Support Chat Widget",
  "description": "Floating chat widget — rolling out to 30% of users",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "Show Chat", "value": true},
    {"key": "off", "name": "Hide Chat", "value": false}
  ],
  "default_variation_key": "off",
  "tags": ["rollout", "support"]
}' "true"

create_flag "nexus-power-tools" '{
  "key": "nexus-power-tools",
  "name": "Power User Tools",
  "description": "Advanced shortcuts panel — shown to power users via segment targeting",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "Enabled", "value": true},
    {"key": "off", "name": "Disabled", "value": false}
  ],
  "default_variation_key": "off",
  "tags": ["segment", "power-users"]
}' "true"

create_flag "nexus-onboarding" '{
  "key": "nexus-onboarding",
  "name": "Onboarding Flow",
  "description": "A/B test: classic checklist vs guided tour",
  "flag_type": "string",
  "variations": [
    {"key": "classic", "name": "Classic Checklist", "value": "classic"},
    {"key": "guided-tour", "name": "Guided Tour", "value": "guided-tour"}
  ],
  "default_variation_key": "classic",
  "tags": ["experiment", "onboarding"]
}' "true"

create_flag "nexus-notifications" '{
  "key": "nexus-notifications",
  "name": "Notification Center",
  "description": "Bell icon notifications — active in dev, inactive in prod",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "Enabled", "value": true},
    {"key": "off", "name": "Disabled", "value": false}
  ],
  "default_variation_key": "on",
  "tags": ["ui", "environment"]
}' "true"

create_flag "nexus-ai-summaries" '{
  "key": "nexus-ai-summaries",
  "name": "AI Task Summaries",
  "description": "AI-generated task summaries — lifecycle demo flag",
  "flag_type": "boolean",
  "variations": [
    {"key": "on", "name": "Enabled", "value": true},
    {"key": "off", "name": "Disabled", "value": false}
  ],
  "default_variation_key": "off",
  "tags": ["ai", "lifecycle"]
}' "false"

# ─── Final verification ───────────────────────────────────────────────────────

echo ""
echo "Verifying — listing all flags..."
VERIFY=$(api_get "/flags")
TOTAL=$(echo "$VERIFY" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('items',[]); print(len(items))" 2>/dev/null)
ACTIVE=$(echo "$VERIFY" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('items',[]); print(sum(1 for f in items if f.get('status')=='active'))" 2>/dev/null)

echo ""
echo "  Total flags  : ${TOTAL}"
echo "  Active flags : ${ACTIVE}"
echo ""

echo "$VERIFY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
items = d.get('items', [])
print(f'  {'KEY':<35} {'TYPE':<10} {'STATUS':<10}')
print('  ' + '-'*57)
for f in sorted(items, key=lambda x: x['key']):
    print(f'  {f[\"key\"]:<35} {f[\"flag_type\"]:<10} {f[\"status\"]:<10}')
" 2>/dev/null

echo ""
echo "Seed complete!"
