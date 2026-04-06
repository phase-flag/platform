#!/usr/bin/env bash
# seed-nexus.sh — Populate ALL dashboard sections with Nexus project data
# Usage: ./scripts/seed-nexus.sh
set -euo pipefail

API="https://api.phaseflag.com/api/v1"
EMAIL="admin@phaseflag.com"
PASSWORD="PhaseFlag2026!"

# ─── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "  ${CYAN}→${NC} $*"; }
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
skip() { echo -e "  ${YELLOW}~${NC} $* (already exists)"; }
err()  { echo -e "  ${RED}✗${NC} $*" >&2; }
h1()   { echo -e "\n${CYAN}━━ $* ━━${NC}"; }

# ─── HTTP helpers ──────────────────────────────────────────────────────────────
api_post() {
  curl -s -X POST "${API}${1}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "$2"
}
api_put() {
  curl -s -X PUT "${API}${1}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d "$2"
}
api_get() {
  curl -s -X GET "${API}${1}" \
    -H "Authorization: Bearer ${TOKEN}"
}

py() { python3 -c "$1" 2>/dev/null; }

has_id()    { py "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('id') else 1)"; }
get_field() { py "import sys,json; d=json.load(sys.stdin); print(d.get('$1',''))"; }

# ─── Auth ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Phase Flag — Nexus Full Dataset Seed    ║"
echo "╚══════════════════════════════════════════╝"

h1 "Authentication"
LOGIN=$(curl -s -X POST "${API}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo "$LOGIN" | py "import sys,json; d=json.load(sys.stdin); print(d.get('token') or d.get('access_token',''))")
if [[ -z "$TOKEN" ]]; then
  err "Authentication failed: $LOGIN"; exit 1
fi
ok "Authenticated as ${EMAIL}"

# ─── 1. SEGMENTS ──────────────────────────────────────────────────────────────
h1 "Segments"

create_segment() {
  local key="$1"; local payload="$2"
  local existing; existing=$(api_get "/segments" | py "
import sys,json; d=json.load(sys.stdin)
items=d.get('items',d) if isinstance(d,dict) else d
items=items if isinstance(items,list) else []
match=[x for x in items if x.get('key')=='${key}']
print(match[0].get('id','') if match else '')
")
  if [[ -n "$existing" ]]; then
    skip "$key (id: $existing)"
    echo "$existing"
    return
  fi
  local resp; resp=$(api_post "/segments" "$payload")
  if echo "$resp" | has_id; then
    local id; id=$(echo "$resp" | get_field id)
    ok "Created segment: $key (id: $id)"
    echo "$id"
  else
    err "$key: $resp"; echo ""
  fi
}

log "Creating nexus-power-users segment..."
POWER_USERS_ID=$(create_segment "nexus-power-users" '{
  "key": "nexus-power-users",
  "name": "Nexus Power Users",
  "description": "Users with 50+ completed tasks and 30+ days account age — eligible for advanced tooling",
  "conditions": [
    {"attribute": "tasks_completed", "operator": "gt", "value": 50},
    {"attribute": "account_age_days", "operator": "gt", "value": 30}
  ]
}')

log "Creating nexus-enterprise-users segment..."
ENTERPRISE_ID=$(create_segment "nexus-enterprise-users" '{
  "key": "nexus-enterprise-users",
  "name": "Nexus Enterprise Users",
  "description": "Users on the enterprise plan — eligible for beta features and higher limits",
  "conditions": [
    {"attribute": "plan", "operator": "is", "value": "enterprise"}
  ]
}')

log "Creating nexus-beta-testers segment..."
BETA_ID=$(create_segment "nexus-beta-testers" '{
  "key": "nexus-beta-testers",
  "name": "Nexus Beta Testers",
  "description": "Internal team members and enterprise accounts — get early access to Labs features",
  "conditions": [
    {"attribute": "email", "operator": "contains", "value": "@nexus-internal.com"}
  ]
}')

log "Creating nexus-pro-plus-users segment..."
PRO_ID=$(create_segment "nexus-pro-plus-users" '{
  "key": "nexus-pro-plus-users",
  "name": "Nexus Pro & Enterprise Users",
  "description": "Paid plan users (pro or enterprise) — eligible for increased rate limits and project caps",
  "conditions": [
    {"attribute": "plan", "operator": "one_of", "value": ["pro", "enterprise"]}
  ]
}')

log "Creating nexus-mobile-users segment..."
MOBILE_ID=$(create_segment "nexus-mobile-users" '{
  "key": "nexus-mobile-users",
  "name": "Nexus Mobile Users",
  "description": "Users accessing Nexus via mobile platform — different UX defaults apply",
  "conditions": [
    {"attribute": "platform", "operator": "one_of", "value": ["ios", "android"]}
  ]
}')

# ─── 2. FLAG TARGETING RULES ──────────────────────────────────────────────────
h1 "Flag Targeting Rules"

# Helper: get flag variation IDs by flag key
get_var_id() {
  local flag_key="$1"; local var_key="$2"
  api_get "/flags/${flag_key}" | py "
import sys,json; d=json.load(sys.stdin)
vs=d.get('variations',[])
match=[v for v in vs if v.get('key')=='${var_key}']
print(match[0].get('id','') if match else '')
"
}

log "Adding targeting rules to nexus-max-projects (plan-based)..."
PRO_VAR=$(get_var_id "nexus-max-projects" "pro-limit")
UNLIMITED_VAR=$(get_var_id "nexus-max-projects" "unlimited")
if [[ -n "$PRO_VAR" && -n "$UNLIMITED_VAR" ]]; then
  api_put "/flags/nexus-max-projects" "{
    \"targeting_rules\": [
      {
        \"priority\": 1,
        \"conditions\": [{\"attribute\": \"plan\", \"operator\": \"is\", \"value\": \"enterprise\"}],
        \"variation_id\": \"${UNLIMITED_VAR}\"
      },
      {
        \"priority\": 2,
        \"conditions\": [{\"attribute\": \"plan\", \"operator\": \"is\", \"value\": \"pro\"}],
        \"variation_id\": \"${PRO_VAR}\"
      }
    ]
  }" > /dev/null && ok "nexus-max-projects: enterprise→999, pro→10, free→3"
else
  err "nexus-max-projects: could not resolve variation IDs"
fi

log "Adding targeting rules to nexus-beta-features (enterprise + internal emails)..."
BETA_ON=$(get_var_id "nexus-beta-features" "on")
if [[ -n "$BETA_ON" && -n "$ENTERPRISE_ID" && -n "$BETA_ID" ]]; then
  api_put "/flags/nexus-beta-features" "{
    \"targeting_rules\": [
      {
        \"priority\": 1,
        \"segment_id\": \"${ENTERPRISE_ID}\",
        \"variation_id\": \"${BETA_ON}\"
      },
      {
        \"priority\": 2,
        \"segment_id\": \"${BETA_ID}\",
        \"variation_id\": \"${BETA_ON}\"
      }
    ]
  }" > /dev/null && ok "nexus-beta-features: enterprise + @nexus-internal.com → enabled"
else
  err "nexus-beta-features: skipped — missing IDs"
fi

log "Adding targeting rules to nexus-power-tools (power users segment)..."
TOOLS_ON=$(get_var_id "nexus-power-tools" "on")
if [[ -n "$TOOLS_ON" && -n "$POWER_USERS_ID" ]]; then
  api_put "/flags/nexus-power-tools" "{
    \"targeting_rules\": [
      {
        \"priority\": 1,
        \"segment_id\": \"${POWER_USERS_ID}\",
        \"variation_id\": \"${TOOLS_ON}\"
      }
    ]
  }" > /dev/null && ok "nexus-power-tools: power-users segment → enabled"
else
  err "nexus-power-tools: skipped — missing IDs"
fi

log "Adding 30% percentage rollout to nexus-chat-widget..."
CHAT_ON=$(get_var_id "nexus-chat-widget" "on")
CHAT_OFF=$(get_var_id "nexus-chat-widget" "off")
if [[ -n "$CHAT_ON" && -n "$CHAT_OFF" ]]; then
  api_put "/flags/nexus-chat-widget" "{
    \"targeting_rules\": [
      {
        \"priority\": 1,
        \"conditions\": [],
        \"percentage_rollout\": {\"${CHAT_ON}\": 30, \"${CHAT_OFF}\": 70}
      }
    ]
  }" > /dev/null && ok "nexus-chat-widget: 30% rollout configured"
else
  err "nexus-chat-widget: skipped — missing IDs"
fi

log "Adding dashboard widget targeting to nexus-dashboard-widgets..."
ADV_VAR=$(get_var_id "nexus-dashboard-widgets" "advanced")
if [[ -n "$ADV_VAR" && -n "$PRO_ID" ]]; then
  api_put "/flags/nexus-dashboard-widgets" "{
    \"targeting_rules\": [
      {
        \"priority\": 1,
        \"segment_id\": \"${PRO_ID}\",
        \"variation_id\": \"${ADV_VAR}\"
      }
    ]
  }" > /dev/null && ok "nexus-dashboard-widgets: pro/enterprise → advanced 4-col layout"
fi

ok "Targeting rules applied to 5 Nexus flags"

# ─── 3. EXPERIMENTS ───────────────────────────────────────────────────────────
h1 "Experiments"

create_experiment() {
  local key="$1"; local payload="$2"
  local existing; existing=$(api_get "/experiments" | py "
import sys,json; d=json.load(sys.stdin)
items=d.get('items',[])
match=[x for x in items if x.get('key')=='${key}']
print(match[0].get('id','') if match else '')
")
  if [[ -n "$existing" ]]; then
    skip "$key (id: $existing)"
    echo "$existing"; return
  fi
  local resp; resp=$(api_post "/experiments" "$payload")
  if echo "$resp" | has_id; then
    local id; id=$(echo "$resp" | get_field id)
    ok "Created experiment: $key"
    echo "$id"
  else
    err "$key: $resp"; echo ""
  fi
}

log "Creating onboarding A/B test..."
EXP1_ID=$(create_experiment "nexus-onboarding-ab-test" '{
  "key": "nexus-onboarding-ab-test",
  "name": "Nexus Onboarding Flow A/B Test",
  "flag_key": "nexus-onboarding",
  "description": "Testing classic checklist vs guided tour for new user activation",
  "hypothesis": "The guided tour will increase 7-day activation rate by 15% compared to the classic checklist",
  "experiment_type": "ab",
  "traffic_percentage": 100,
  "goals": [
    {
      "name": "7-Day Activation",
      "metric_key": "user_activated_7d",
      "description": "User completes their first project within 7 days",
      "goal_type": "conversion",
      "is_primary": true,
      "min_sample_size": 200
    },
    {
      "name": "Onboarding Completion Rate",
      "metric_key": "onboarding_completed",
      "description": "User completes all onboarding steps",
      "goal_type": "conversion",
      "is_primary": false
    }
  ]
}')

log "Creating task layout multivariate test..."
EXP2_ID=$(create_experiment "nexus-task-layout-mvt" '{
  "key": "nexus-task-layout-mvt",
  "name": "Nexus Task Card Layout MVT",
  "flag_key": "nexus-task-layout",
  "description": "3-way test of compact vs standard vs detailed task card layouts",
  "hypothesis": "Detailed layout improves task completion rate for power users; compact improves mobile engagement",
  "experiment_type": "ab",
  "traffic_percentage": 80,
  "goals": [
    {
      "name": "Task Completion Rate",
      "metric_key": "task_completed",
      "description": "User marks a task as complete within the session",
      "goal_type": "conversion",
      "is_primary": true,
      "min_sample_size": 500
    },
    {
      "name": "Time on Tasks Page",
      "metric_key": "tasks_page_session_duration",
      "description": "Average seconds spent on the tasks page",
      "goal_type": "conversion",
      "is_primary": false
    }
  ]
}')

log "Creating AI summaries adoption experiment..."
EXP3_ID=$(create_experiment "nexus-ai-summaries-rollout-exp" '{
  "key": "nexus-ai-summaries-rollout-exp",
  "name": "Nexus AI Summaries Adoption",
  "flag_key": "nexus-ai-summaries",
  "description": "Measuring impact of AI-generated task summaries on user productivity and retention",
  "hypothesis": "AI summaries will reduce time-to-context by 40% and increase daily active usage",
  "experiment_type": "ab",
  "traffic_percentage": 20,
  "goals": [
    {
      "name": "Daily Active Usage",
      "metric_key": "dau_with_summaries",
      "description": "User views AI summary at least once per day",
      "goal_type": "conversion",
      "is_primary": true
    },
    {
      "name": "Summary Feedback Rate",
      "metric_key": "summary_thumbs_up",
      "description": "User gives positive feedback on AI summary",
      "goal_type": "conversion",
      "is_primary": false
    }
  ]
}')

# Start experiments
if [[ -n "$EXP1_ID" ]]; then
  api_post "/experiments/${EXP1_ID}/start" '{}' > /dev/null && ok "Started: nexus-onboarding-ab-test"
fi
if [[ -n "$EXP2_ID" ]]; then
  api_post "/experiments/${EXP2_ID}/start" '{}' > /dev/null && ok "Started: nexus-task-layout-mvt"
fi

# ─── 4. WEBHOOKS ──────────────────────────────────────────────────────────────
h1 "Webhooks"

create_webhook() {
  local url="$1"; local payload="$2"
  local existing; existing=$(api_get "/webhooks" | py "
import sys,json; d=json.load(sys.stdin)
items=d.get('items',[])
match=[x for x in items if x.get('url')=='${url}']
print(match[0].get('id','') if match else '')
")
  if [[ -n "$existing" ]]; then
    skip "$url"
    return
  fi
  local resp; resp=$(api_post "/webhooks" "$payload")
  if echo "$resp" | has_id; then
    ok "Created webhook: $url"
  else
    err "$url — $resp"
  fi
}

log "Creating Nexus CI/CD deploy webhook..."
create_webhook "https://nexus-internal.com/hooks/phaseflag" '{
  "url": "https://nexus-internal.com/hooks/phaseflag",
  "events": ["flag.toggled", "flag.created", "flag.updated", "flag.archived"],
  "secret": "whsec_nexus_cicd_deploy_2026"
}'

log "Creating Nexus Slack notification webhook..."
create_webhook "https://hooks.slack.com/services/nexus/phaseflag-alerts" '{
  "url": "https://hooks.slack.com/services/nexus/phaseflag-alerts",
  "events": ["flag.toggled", "flag.archived", "segment.created"],
  "secret": "whsec_nexus_slack_alerts_2026"
}'

log "Creating Nexus analytics pipeline webhook..."
create_webhook "https://analytics.nexus-internal.com/ingest/phaseflag" '{
  "url": "https://analytics.nexus-internal.com/ingest/phaseflag",
  "events": ["flag.created", "flag.updated", "flag.toggled", "segment.created", "segment.updated"],
  "secret": "whsec_nexus_analytics_2026"
}'

# ─── 5. PIPELINES ─────────────────────────────────────────────────────────────
h1 "Pipelines"

create_pipeline() {
  local flag_key="$1"; local payload="$2"
  local existing; existing=$(api_get "/pipelines" | py "
import sys,json; d=json.load(sys.stdin)
items=d.get('items',d) if isinstance(d,dict) else d
items=items if isinstance(items,list) else []
match=[x for x in items if x.get('flag_key')=='${flag_key}']
print(match[0].get('id','') if match else '')
" 2>/dev/null)
  if [[ -n "$existing" ]]; then
    skip "${flag_key} pipeline (id: $existing)"
    return
  fi
  local resp; resp=$(api_post "/pipelines" "$payload")
  if echo "$resp" | has_id; then
    ok "Created pipeline for ${flag_key}"
  else
    err "${flag_key} pipeline — $resp"
  fi
}

log "Creating chat widget canary rollout pipeline..."
create_pipeline "nexus-chat-widget" '{
  "flag_key": "nexus-chat-widget",
  "name": "Nexus Chat Widget — Canary Rollout",
  "description": "Staged rollout of the support chat widget to 100% of Nexus users over 4 weeks",
  "environment": "production",
  "stages": [
    {
      "name": "Internal Canary",
      "rollout_percentage": 5,
      "duration_minutes": 2880,
      "health_check_url": "https://nexus-internal.com/health/chat",
      "success_threshold": 0.99
    },
    {
      "name": "Limited Beta",
      "rollout_percentage": 15,
      "duration_minutes": 4320,
      "health_check_url": "https://nexus-internal.com/health/chat",
      "success_threshold": 0.995
    },
    {
      "name": "Broad Rollout",
      "rollout_percentage": 30,
      "duration_minutes": 7200,
      "success_threshold": 0.99
    },
    {
      "name": "General Availability",
      "rollout_percentage": 100,
      "duration_minutes": null,
      "success_threshold": 0.99
    }
  ]
}'

log "Creating AI summaries staged launch pipeline..."
create_pipeline "nexus-ai-summaries" '{
  "flag_key": "nexus-ai-summaries",
  "name": "Nexus AI Summaries — Staged Launch",
  "description": "Progressive rollout of AI task summaries, gated by model performance metrics",
  "environment": "production",
  "stages": [
    {
      "name": "Alpha (Internal)",
      "rollout_percentage": 2,
      "duration_minutes": 1440,
      "health_check_url": "https://nexus-internal.com/health/ai",
      "success_threshold": 0.95
    },
    {
      "name": "Pro Users Beta",
      "rollout_percentage": 10,
      "duration_minutes": 2880,
      "success_threshold": 0.97
    },
    {
      "name": "General Release",
      "rollout_percentage": 50,
      "duration_minutes": 4320,
      "success_threshold": 0.97
    },
    {
      "name": "Full Rollout",
      "rollout_percentage": 100,
      "duration_minutes": null
    }
  ]
}'

log "Creating dark mode kill-switch pipeline..."
create_pipeline "nexus-dark-mode" '{
  "flag_key": "nexus-dark-mode",
  "name": "Nexus Dark Mode — Emergency Rollback",
  "description": "Fast rollback pipeline in case of rendering issues in dark mode",
  "environment": "production",
  "stages": [
    {"name": "Disable for 10%", "rollout_percentage": 90, "duration_minutes": 30},
    {"name": "Disable for 50%", "rollout_percentage": 50, "duration_minutes": 60},
    {"name": "Full Disable",    "rollout_percentage": 0,  "duration_minutes": null}
  ]
}'

# ─── 6. REMOTE CONFIG ─────────────────────────────────────────────────────────
h1 "Remote Config"

create_remote_config() {
  local key="$1"; local payload="$2"
  local existing; existing=$(api_get "/configs" | py "
import sys,json; d=json.load(sys.stdin)
items=d.get('items',[]) if isinstance(d,dict) else d
items=items if isinstance(items,list) else []
match=[x for x in items if x.get('key')=='${key}']
print(match[0].get('id','') if match else '')
" 2>/dev/null)
  if [[ -n "$existing" ]]; then
    skip "$key (id: $existing)"; return
  fi
  local resp; resp=$(api_post "/configs" "$payload")
  if echo "$resp" | has_id; then
    ok "Remote config: $key"
  else
    err "$key — $resp"
  fi
}

log "Creating Nexus remote config values..."
create_remote_config "nexus-api-base-url" '{
  "key": "nexus-api-base-url",
  "name": "Nexus API Base URL",
  "description": "Base URL for the Nexus backend API — overridden per environment",
  "config_type": "string",
  "value": "https://api.nexus-internal.com/v2",
  "default_value": "https://api.nexus-staging.com/v2"
}'

create_remote_config "nexus-upload-limit-mb" '{
  "key": "nexus-upload-limit-mb",
  "name": "File Upload Limit (MB)",
  "description": "Maximum file attachment size in megabytes for user-uploaded content",
  "config_type": "number",
  "value": 25,
  "default_value": 10
}'

create_remote_config "nexus-ai-model-version" '{
  "key": "nexus-ai-model-version",
  "name": "AI Model Version",
  "description": "Which AI model version to use for task summary generation",
  "config_type": "string",
  "value": "gpt-4o-mini",
  "default_value": "gpt-3.5-turbo"
}'

create_remote_config "nexus-rate-limit-rpm" '{
  "key": "nexus-rate-limit-rpm",
  "name": "API Rate Limit (req/min)",
  "description": "Maximum API requests per minute per authenticated user",
  "config_type": "number",
  "value": 300,
  "default_value": 60
}'

create_remote_config "nexus-maintenance-window" '{
  "key": "nexus-maintenance-window",
  "name": "Maintenance Window Config",
  "description": "Scheduled maintenance window — controls banner and redirect behaviour",
  "config_type": "json",
  "value": "{\"enabled\": false, \"start\": \"2026-05-01T02:00:00Z\", \"end\": \"2026-05-01T04:00:00Z\", \"message\": \"Planned maintenance window\"}",
  "default_value": "{\"enabled\": false}"
}'

# ─── 7. GOVERNANCE CHANGE REQUESTS ────────────────────────────────────────────
h1 "Governance — Change Requests"

create_change_request() {
  local title="$1"; local payload="$2"
  local resp; resp=$(api_post "/changes" "$payload")
  if echo "$resp" | has_id; then
    local id; id=$(echo "$resp" | get_field id)
    ok "Change request: $title (id: $id)"
    echo "$id"
  else
    err "$title — $resp"; echo ""
  fi
}

log "Creating change request: enable nexus-dark-mode for prod..."
CR1_ID=$(create_change_request "Enable dark mode for production" '{
  "title": "Enable nexus-dark-mode in Production",
  "description": "Promote nexus-dark-mode from 20% staging rollout to 100% production after zero reported incidents over 14 days",
  "entity_type": "flag",
  "entity_key": "nexus-dark-mode",
  "change_type": "update",
  "environment": "production",
  "payload": {"status": "active", "rollout_percentage": 100},
  "requires_approval_count": 2
}')

log "Creating change request: archive nexus-legacy-export..."
CR2_ID=$(create_change_request "Archive nexus-legacy-export flag" '{
  "title": "Archive nexus-legacy-export Flag",
  "description": "The legacy CSV export feature has been replaced by nexus-bulk-export. Safe to archive after migration confirmed complete.",
  "entity_type": "flag",
  "entity_key": "nexus-legacy-export",
  "change_type": "archive",
  "environment": "production",
  "payload": {"status": "archived"},
  "requires_approval_count": 1
}')

log "Creating change request: update AI model config..."
CR3_ID=$(create_change_request "Update AI model to gpt-4o" '{
  "title": "Upgrade nexus-ai-model-version to gpt-4o",
  "description": "Upgrading the AI model from gpt-4o-mini to gpt-4o for improved summary quality. Requires sign-off from engineering and finance due to cost impact.",
  "entity_type": "config",
  "entity_key": "nexus-ai-model-version",
  "change_type": "update",
  "environment": "production",
  "payload": {"value": "gpt-4o"},
  "requires_approval_count": 2
}')

# ─── 8. SUMMARY ───────────────────────────────────────────────────────────────
h1 "Verification"

FLAGS_RESP=$(api_get "/flags?limit=50")
TOTAL_FLAGS=$(echo "$FLAGS_RESP" | py "import sys,json; d=json.load(sys.stdin); print(d.get('total', len(d.get('items',[]))))")
ACTIVE_FLAGS=$(echo "$FLAGS_RESP" | py "import sys,json; d=json.load(sys.stdin); print(sum(1 for f in d.get('items',[]) if f.get('status')=='active'))")

SEGS_RESP=$(api_get "/segments?limit=50")
TOTAL_SEGS=$(echo "$SEGS_RESP" | py "import sys,json; d=json.load(sys.stdin); print(d.get('total', len(d.get('items',[]))))")

EXPS_RESP=$(api_get "/experiments?limit=50")
TOTAL_EXPS=$(echo "$EXPS_RESP" | py "import sys,json; d=json.load(sys.stdin); print(d.get('total', len(d.get('items',[]))))")

HOOKS_RESP=$(api_get "/webhooks?limit=50")
TOTAL_HOOKS=$(echo "$HOOKS_RESP" | py "import sys,json; d=json.load(sys.stdin); print(d.get('total', len(d.get('items',[]))))")

PIPES_RESP=$(api_get "/pipelines")
TOTAL_PIPES=$(echo "$PIPES_RESP" | py "import sys,json; d=json.load(sys.stdin); items=d.get('items',d) if isinstance(d,dict) else d; print(len(items) if isinstance(items,list) else 0)")

CONFIGS_RESP=$(api_get "/configs")
TOTAL_CONFIGS=$(echo "$CONFIGS_RESP" | py "import sys,json; d=json.load(sys.stdin); print(d.get('total', len(d.get('items',[]))))")

CHANGES_RESP=$(api_get "/changes")
TOTAL_CHANGES=$(echo "$CHANGES_RESP" | py "import sys,json; d=json.load(sys.stdin); print(d.get('total', len(d.get('items',[]))))")

echo ""
echo "  ┌──────────────────────────────────┐"
echo "  │      Nexus Dataset Summary       │"
echo "  ├──────────────────────────────────┤"
printf "  │  Flags          : %-4s active    │\n" "${ACTIVE_FLAGS}/${TOTAL_FLAGS}"
printf "  │  Segments       : %-4s total     │\n" "${TOTAL_SEGS}"
printf "  │  Experiments    : %-4s total     │\n" "${TOTAL_EXPS}"
printf "  │  Webhooks       : %-4s total     │\n" "${TOTAL_HOOKS}"
printf "  │  Pipelines      : %-4s total     │\n" "${TOTAL_PIPES}"
printf "  │  Remote Configs : %-4s total     │\n" "${TOTAL_CONFIGS}"
printf "  │  Change Requests: %-4s total     │\n" "${TOTAL_CHANGES}"
echo "  └──────────────────────────────────┘"
echo ""

# Show nexus flags specifically
echo "  Nexus flags:"
echo "$FLAGS_RESP" | py "
import sys,json
d=json.load(sys.stdin)
flags=[f for f in d.get('items',[]) if f.get('key','').startswith('nexus-')]
for f in sorted(flags,key=lambda x:x['key']):
    rules=len(f.get('targeting_rules',[]))
    print(f'    {f[\"key\"]:<35} {f[\"flag_type\"]:<8} {f[\"status\"]:<10} {rules} rules')
" 2>/dev/null

echo ""
ok "Nexus full dataset seeded successfully!"
echo ""
