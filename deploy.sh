#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Build, push, and optionally redeploy all Flappy Bird services
#
# Usage:
#   ./deploy.sh [options]
#
# Required env vars:
#   DOCKERHUB_USERNAME   Your DockerHub username
#
# Optional env vars:
#   TAG                  Image tag (default: git short SHA, falls back to "latest")
#   VITE_API_URL         Baked-in API URL for the frontend bundle
#                        (default: https://flappybird-api.onrender.com)
#   PLATFORM             Target platform (default: linux/amd64)
#   PUSH_LATEST          Also tag/push :latest alongside the SHA tag (default: true)
#   NO_CACHE             Set to "true" to disable Docker layer cache
#
#   RENDER_API_KEY       Render API key — enables auto-redeploy after push
#   RENDER_API_SERVICE_ID  Render service ID for flappybird-api
#   RENDER_WEB_SERVICE_ID  Render service ID for flappybird-web
#
# Examples:
#   DOCKERHUB_USERNAME=myuser ./deploy.sh
#   DOCKERHUB_USERNAME=myuser TAG=v1.2.0 ./deploy.sh
#   DOCKERHUB_USERNAME=myuser \
#     RENDER_API_KEY=rnd_xxxx \
#     RENDER_API_SERVICE_ID=srv-aaaa \
#     RENDER_WEB_SERVICE_ID=srv-bbbb \
#     ./deploy.sh
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()      { echo -e "${CYAN}[deploy]${RESET} $*"; }
success()  { echo -e "${GREEN}[deploy]${RESET} ✔  $*"; }
warn()     { echo -e "${YELLOW}[deploy]${RESET} ⚠  $*"; }
die()      { echo -e "${RED}[deploy]${RESET} ✘  $*" >&2; exit 1; }
header()   { echo -e "\n${BOLD}══════════════════════════════════════════${RESET}"; \
             echo -e "${BOLD}  $*${RESET}"; \
             echo -e "${BOLD}══════════════════════════════════════════${RESET}"; }

# ── Help ─────────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  sed -n '3,30p' "$0"   # print the header comment block
  exit 0
fi

# ── Configuration ────────────────────────────────────────────────────────────
DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:?Error: DOCKERHUB_USERNAME is not set. Export it before running this script.}"

# Default tag: git short SHA so every build is traceable; fall back to "latest"
DEFAULT_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')"
TAG="${TAG:-$DEFAULT_TAG}"

VITE_API_URL="${VITE_API_URL:-https://flappybird-api.onrender.com}"
PLATFORM="${PLATFORM:-linux/amd64}"
PUSH_LATEST="${PUSH_LATEST:-true}"
NO_CACHE="${NO_CACHE:-false}"

API_IMAGE="$DOCKERHUB_USERNAME/flappybird-api"
WEB_IMAGE="$DOCKERHUB_USERNAME/flappybird-web"

RENDER_API_KEY="${RENDER_API_KEY:-}"
RENDER_API_SERVICE_ID="${RENDER_API_SERVICE_ID:-}"
RENDER_WEB_SERVICE_ID="${RENDER_WEB_SERVICE_ID:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CACHE_FLAG=""
[[ "$NO_CACHE" == "true" ]] && CACHE_FLAG="--no-cache"

# ── Summary ──────────────────────────────────────────────────────────────────
header "Flappy Bird — Deploy to DockerHub + Render"
log "DockerHub user : ${BOLD}$DOCKERHUB_USERNAME${RESET}"
log "Image tag      : ${BOLD}$TAG${RESET}"
log "Platform       : ${BOLD}$PLATFORM${RESET}"
log "Push :latest   : ${BOLD}$PUSH_LATEST${RESET}"
log "VITE_API_URL   : ${BOLD}$VITE_API_URL${RESET}"
log "Render redeploy: ${BOLD}$( [[ -n "$RENDER_API_KEY" ]] && echo "enabled" || echo "skipped (RENDER_API_KEY not set)" )${RESET}"
echo ""

# ── Pre-flight checks ────────────────────────────────────────────────────────
header "Pre-flight checks"

# Must run from repo root
[[ -f "$SCRIPT_DIR/Dockerfile" ]]      || die "Root Dockerfile not found — run from the repo root."
[[ -f "$SCRIPT_DIR/web/Dockerfile" ]]  || die "web/Dockerfile not found."

# Docker daemon running?
docker info > /dev/null 2>&1 || die "Docker daemon is not running."

# buildx available?
docker buildx version > /dev/null 2>&1 || die "docker buildx is not available. Install Docker Desktop 24+ or the Buildx plugin."

# Ensure the render-builder buildx instance exists (create it if not)
if ! docker buildx inspect render-builder > /dev/null 2>&1; then
  log "Creating buildx builder 'render-builder'..."
  docker buildx create --name render-builder --driver docker-container --use
  docker buildx inspect render-builder --bootstrap
else
  docker buildx use render-builder
  log "Using existing buildx builder 'render-builder'."
fi

# DockerHub login check — attempt if not already authenticated
if ! docker info 2>&1 | grep -q "Username:"; then
  log "Not logged in to DockerHub — running docker login..."
  docker login || die "Docker login failed."
fi

success "Pre-flight checks passed."

# ── Build helpers ────────────────────────────────────────────────────────────
build_and_push() {
  local name="$1"       # human-readable name
  local image="$2"      # base image name e.g. user/flappybird-api
  local context="$3"    # docker build context path
  local extra_args="${4:-}"  # additional --build-arg etc.

  local sha_tag="$image:$TAG"
  local latest_tag="$image:latest"

  header "Building & pushing — $name"
  log "Image : $sha_tag"

  # Build tags (always include SHA; optionally also :latest)
  local tag_flags="--tag $sha_tag"
  [[ "$PUSH_LATEST" == "true" ]] && tag_flags="$tag_flags --tag $latest_tag"

  # shellcheck disable=SC2086
  docker buildx build \
    --platform "$PLATFORM" \
    $tag_flags \
    $CACHE_FLAG \
    $extra_args \
    --push \
    "$context"

  success "Pushed $sha_tag"
  [[ "$PUSH_LATEST" == "true" ]] && success "Pushed $latest_tag"
}

# ── Build & push API image ───────────────────────────────────────────────────
build_and_push \
  "flappybird-api (Node.js + Socket.IO)" \
  "$API_IMAGE" \
  "$SCRIPT_DIR"

# ── Build & push Web image ───────────────────────────────────────────────────
build_and_push \
  "flappybird-web (React/Vite + NGINX)" \
  "$WEB_IMAGE" \
  "$SCRIPT_DIR/web" \
  "--build-arg VITE_API_URL=$VITE_API_URL"

# ── Trigger Render redeploys (optional) ─────────────────────────────────────
trigger_render_deploy() {
  local service_id="$1"
  local service_name="$2"
  local image_url="$3"

  header "Triggering Render redeploy — $service_name"

  local payload="{\"imageUrl\":\"${image_url}:${TAG}\"}"

  local http_status
  http_status=$(curl -s -o /tmp/render_response.json -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "https://api.render.com/v1/services/$service_id/deploys")

  if [[ "$http_status" == "201" || "$http_status" == "200" ]]; then
    local deploy_id
    deploy_id=$(grep -o '"id":"[^"]*"' /tmp/render_response.json | head -1 | cut -d'"' -f4)
    success "Redeploy triggered for $service_name (deploy ID: $deploy_id)"
    log "Track at: https://dashboard.render.com/web/$service_id/deploys"
  else
    warn "Render API returned HTTP $http_status for $service_name — check /tmp/render_response.json"
    cat /tmp/render_response.json
  fi
}

if [[ -n "$RENDER_API_KEY" ]]; then
  if [[ -z "$RENDER_API_SERVICE_ID" || -z "$RENDER_WEB_SERVICE_ID" ]]; then
    warn "RENDER_API_KEY is set but RENDER_API_SERVICE_ID or RENDER_WEB_SERVICE_ID is missing — skipping Render redeploy."
  else
    # Check curl is available
    command -v curl > /dev/null 2>&1 || die "curl is required to trigger Render deploys."

    trigger_render_deploy \
      "$RENDER_API_SERVICE_ID" \
      "flappybird-api" \
      "docker.io/$API_IMAGE"

    trigger_render_deploy \
      "$RENDER_WEB_SERVICE_ID" \
      "flappybird-web" \
      "docker.io/$WEB_IMAGE"
  fi
else
  warn "RENDER_API_KEY not set — skipping automatic Render redeploy."
  warn "To redeploy manually: go to the Render dashboard and click 'Manual Deploy'."
fi

# ── Done ─────────────────────────────────────────────────────────────────────
header "Deploy complete"
success "API image  : docker.io/$API_IMAGE:$TAG"
success "Web image  : docker.io/$WEB_IMAGE:$TAG"
echo ""
log "Next steps if this is your first deploy:"
log "  1. Create 4 Render services using the images above."
log "     See DOCKERHUB_RENDER.md for full instructions."
log "  2. Apply the database schema via the Render shell:"
log "     psql \$DATABASE_URL -f dist/server/database/schema.sql"
log "  3. Update CORS_ORIGIN / FRONTEND_URL on flappybird-api."
echo ""
