#!/usr/bin/env bash
# ralph.sh — Story execution loop
# Reads prd.json, finds the next unpassed story, invokes Claude Code to execute it.
# Usage: ./ralph.sh [--dry-run] [--story US-XXX]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD="$SCRIPT_DIR/prd.json"
PROGRESS="$SCRIPT_DIR/progress.txt"
CLAUDE_MD="$SCRIPT_DIR/CLAUDE.md"

# ── Colours ─────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'

log()  { echo -e "${CYAN}[ralph]${NC} $*"; }
warn() { echo -e "${YELLOW}[ralph]${NC} $*"; }
ok()   { echo -e "${GREEN}[ralph]${NC} $*"; }
err()  { echo -e "${RED}[ralph]${NC} $*" >&2; }

# ── Parse args ──────────────────────────────────────────────────────────────
DRY_RUN=false
TARGET_STORY=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --story)   TARGET_STORY="$2"; shift 2 ;;
    *) err "Unknown arg: $1"; exit 1 ;;
  esac
done

# ── Guards ───────────────────────────────────────────────────────────────────
[[ -f "$PRD" ]] || { err "prd.json not found at $PRD"; exit 1; }
command -v jq  >/dev/null 2>&1 || { err "jq is required"; exit 1; }
command -v claude >/dev/null 2>&1 || { err "claude CLI is required (npm i -g @anthropic-ai/claude-code)"; exit 1; }

# ── Find next story ──────────────────────────────────────────────────────────
if [[ -n "$TARGET_STORY" ]]; then
  STORY_JSON=$(jq --arg id "$TARGET_STORY" '.stories[] | select(.id == $id)' "$PRD")
  [[ -z "$STORY_JSON" ]] && { err "Story $TARGET_STORY not found in prd.json"; exit 1; }
else
  STORY_JSON=$(jq 'first(.stories[] | select(.passes == false))' "$PRD")
fi

if [[ -z "$STORY_JSON" || "$STORY_JSON" == "null" ]]; then
  ok "All stories passing! Product deployment complete."
  echo ""
  jq -r '.stories | length as $total | ([.[] | select(.passes == true)] | length) as $done | "\($done)/\($total) stories passed"' "$PRD"
  exit 0
fi

STORY_ID=$(echo "$STORY_JSON"    | jq -r '.id')
STORY_TITLE=$(echo "$STORY_JSON" | jq -r '.title')
STORY_PHASE=$(echo "$STORY_JSON" | jq -r '.phase')

log "Next story: ${YELLOW}$STORY_ID${NC} — $STORY_TITLE"
log "Phase: $STORY_PHASE"

# ── Progress stats ───────────────────────────────────────────────────────────
TOTAL=$(jq '.stories | length' "$PRD")
DONE=$(jq '[.stories[] | select(.passes == true)] | length' "$PRD")
warn "Progress: $DONE / $TOTAL stories complete"

if $DRY_RUN; then
  warn "--dry-run: would invoke Claude for $STORY_ID"
  echo "$STORY_JSON" | jq .
  exit 0
fi

# ── Build the prompt ─────────────────────────────────────────────────────────
# Append the current story to CLAUDE.md as context, then invoke claude
STORY_BLOCK=$(cat <<EOF

---

## Story to Execute

$(echo "$STORY_JSON" | jq -r '"**ID:** \(.id)\n**Title:** \(.title)\n**Phase:** \(.phase)\n**Priority:** \(.priority)\n\n### Description\n\(.description)\n\n### Acceptance Criteria\n" + (.acceptance_criteria | map("- " + .) | join("\n"))')
EOF
)

# Write temp CLAUDE.md with story appended
TMP_CLAUDE=$(mktemp)
cat "$CLAUDE_MD" > "$TMP_CLAUDE"
echo "$STORY_BLOCK" >> "$TMP_CLAUDE"

log "Invoking Claude Code for $STORY_ID..."
echo "────────────────────────────────────────────────────────────"

# Run claude in the project root, with the story-appended CLAUDE.md
claude \
  --model claude-sonnet-4-6 \
  --allowedTools "Bash,Read,Write,Edit,Glob,Grep,Agent" \
  --print \
  --system-prompt "$(cat "$TMP_CLAUDE")" \
  "Execute story $STORY_ID: $STORY_TITLE. Follow every acceptance criterion. When done, update prd.json and append to progress.txt as instructed in CLAUDE.md."

EXIT_CODE=$?
rm -f "$TMP_CLAUDE"

echo "────────────────────────────────────────────────────────────"

if [[ $EXIT_CODE -ne 0 ]]; then
  err "Claude exited with code $EXIT_CODE for story $STORY_ID"
  exit $EXIT_CODE
fi

# ── Check if story now passes ────────────────────────────────────────────────
PASSES=$(jq --arg id "$STORY_ID" '.stories[] | select(.id == $id) | .passes' "$PRD")

if [[ "$PASSES" == "true" ]]; then
  ok "✓ $STORY_ID marked as passing"
else
  err "Claude did not mark $STORY_ID as passing in prd.json — check progress.txt and retry"
  exit 1
fi

# ── Check for completion ─────────────────────────────────────────────────────
REMAINING=$(jq '[.stories[] | select(.passes == false)] | length' "$PRD")
if [[ "$REMAINING" -eq 0 ]]; then
  ok ""
  ok "🎉 ALL STORIES COMPLETE — deployment finished!"
  ok ""
fi

log "Done. Remaining: $REMAINING stories."
