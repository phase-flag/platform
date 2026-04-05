#!/usr/bin/env bash
# publish-sdks.sh — Publish Phase Flag SDKs to npm, PyPI, and Go modules.
#
# Usage:
#   ./scripts/publish-sdks.sh [--dry-run] [--version VERSION] [--sdks js,react,python,go]
#
# Prerequisites:
#   npm login  (or set NPM_TOKEN env var)
#   export PYPI_TOKEN=<token>
#   git tag vX.Y.Z && git push origin vX.Y.Z  (required for Go module)
#
# Environment variables:
#   NPM_TOKEN   — npm authentication token (used for CI non-interactive publish)
#   PYPI_TOKEN  — PyPI API token (twine password)
#   DRY_RUN     — set to "1" to skip actual publish steps
#   VERSION     — override version tag (default: detected from package.json)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN="${DRY_RUN:-0}"
VERSION="${VERSION:-}"
SDKS_TO_PUBLISH="${SDKS:-js,react,python,go}"

# Parse flags
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=1 ;;
    --version=*) VERSION="${arg#*=}" ;;
    --sdks=*) SDKS_TO_PUBLISH="${arg#*=}" ;;
    --help|-h)
      grep '^#' "$0" | sed 's/^# //' | head -20
      exit 0
      ;;
  esac
done

log() { echo "[publish-sdks] $*"; }
dry() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "[DRY RUN] $*"
  else
    eval "$@"
  fi
}

# ---------------------------------------------------------------------------
# JavaScript SDK (@phaseflag/js-sdk)
# ---------------------------------------------------------------------------
publish_js() {
  log "Building @phaseflag/js-sdk..."
  cd "$REPO_ROOT/sdks/javascript"
  npm ci
  npm run build

  log "Packing @phaseflag/js-sdk (dry run check)..."
  npm pack --dry-run

  log "Publishing @phaseflag/js-sdk to npm..."
  if [[ -n "${NPM_TOKEN:-}" ]]; then
    dry "npm publish --access public"
  else
    dry "npm publish --access public"
  fi
}

# ---------------------------------------------------------------------------
# React SDK (@phaseflag/react)
# ---------------------------------------------------------------------------
publish_react() {
  log "Building @phaseflag/react..."
  # Ensure JS SDK dist is available as peer dep
  cd "$REPO_ROOT/sdks/javascript"
  npm ci
  npm run build

  cd "$REPO_ROOT/sdks/react"
  npm install --legacy-peer-deps
  npm run build

  log "Packing @phaseflag/react (dry run check)..."
  npm pack --dry-run

  log "Publishing @phaseflag/react to npm..."
  dry "npm publish --access public"
}

# ---------------------------------------------------------------------------
# Python SDK (phaseflag-sdk)
# ---------------------------------------------------------------------------
publish_python() {
  log "Building phaseflag-sdk Python wheel and sdist..."
  cd "$REPO_ROOT/sdks/python"

  # Clean previous dist
  rm -rf dist/

  pip install --quiet build twine
  python -m build

  log "Checking distribution with twine..."
  twine check dist/*

  log "Publishing phaseflag-sdk to PyPI..."
  if [[ -n "${PYPI_TOKEN:-}" ]]; then
    dry "TWINE_USERNAME=__token__ TWINE_PASSWORD='$PYPI_TOKEN' twine upload dist/*"
  else
    dry "twine upload dist/*"
  fi
}

# ---------------------------------------------------------------------------
# Go SDK (github.com/phaseflag/go-sdk)
# ---------------------------------------------------------------------------
publish_go() {
  log "Verifying Go SDK builds..."
  cd "$REPO_ROOT/sdks/go"
  go vet ./...
  go build ./...

  # Detect version from git tag or VERSION env
  local version="${VERSION:-$(git describe --tags --abbrev=0 2>/dev/null || echo 'v0.1.0')}"

  log "Go SDK module: github.com/phaseflag/go-sdk"
  log "Go modules are published automatically when a git tag is pushed."
  log ""
  log "To publish Go SDK at version ${version}:"
  log "  git tag ${version}"
  log "  git push origin ${version}"
  log ""
  log "After pushing the tag, the module will be available at:"
  log "  go get github.com/phaseflag/go-sdk@${version}"
  log "  https://pkg.go.dev/github.com/phaseflag/go-sdk@${version}"

  # Force pkg.go.dev to index the new version
  dry "GOPROXY=proxy.golang.org go list -m github.com/phaseflag/go-sdk@${version} 2>/dev/null || true"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
log "Phase Flag SDK Publisher"
log "  Dry run:  $DRY_RUN"
log "  SDKs:     $SDKS_TO_PUBLISH"
log "  Repo:     $REPO_ROOT"
log ""

IFS=',' read -ra SDK_LIST <<< "$SDKS_TO_PUBLISH"
for sdk in "${SDK_LIST[@]}"; do
  case "$sdk" in
    js|javascript) publish_js ;;
    react)         publish_react ;;
    python|py)     publish_python ;;
    go)            publish_go ;;
    *)             log "Unknown SDK: $sdk (valid: js, react, python, go)" ;;
  esac
  log ""
done

log "Done."
