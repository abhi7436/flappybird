#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  start.sh — Flappy Birds Multiplayer — local dev launcher
#
#  Usage:
#    ./start.sh          # server + web (default) → opens browser
#    ./start.sh mobile   # server + Expo → opens browser + QR code
#    ./start.sh all      # server + web + Expo
#    ./start.sh stop     # stop all background processes
#
#  Assumes PostgreSQL (:5432) and Redis (:6379) are already
#  running locally (e.g. via Homebrew: brew services start postgresql redis)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT/.logs"
PID_FILE="$ROOT/.dev-pids"
MODE="${1:-dev}"

# ── Colours ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▶  $*${RESET}"; }
success() { echo -e "${GREEN}✔  $*${RESET}"; }
warn()    { echo -e "${YELLOW}!  $*${RESET}"; }
die()     { echo -e "${RED}✖  $*${RESET}" >&2; exit 1; }

# ── Cross-platform browser opener ────────────────────────────
open_browser() {
  local url="$1"
  if command -v open     >/dev/null 2>&1; then open     "$url"         # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$url"      # Linux
  elif command -v start  >/dev/null 2>&1; then start    "$url"         # Git Bash / WSL
  else warn "Could not detect a browser opener — visit $url manually."
  fi
}

# ── LAN IP (for Expo QR code) ────────────────────────────────
LAN_IP=""
if command -v ipconfig >/dev/null 2>&1; then    # macOS
  LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
elif command -v hostname >/dev/null 2>&1; then  # Linux
  LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
[[ -z "$LAN_IP" ]] && LAN_IP="localhost"

# ── Stop command ──────────────────────────────────────────────
if [[ "$MODE" == "stop" ]]; then
  info "Stopping all dev processes…"

  if [[ -f "$PID_FILE" ]]; then
    while IFS= read -r pid; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" && echo "  killed $pid"
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi

  success "All stopped."
  exit 0
fi

# ── Preflight ─────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
: > "$PID_FILE"    # reset pid list

command -v node >/dev/null 2>&1 || die "Node.js is not installed."
command -v npm  >/dev/null 2>&1 || die "npm is not installed."

# Check for .env file
if [[ ! -f "$ROOT/.env" ]]; then
  warn ".env not found — copying from .env.example"
  cp "$ROOT/.env.example" "$ROOT/.env"
  warn "Edit $ROOT/.env before deploying to production!"
fi

# ── Check local Postgres + Redis ─────────────────────────────
info "Checking local PostgreSQL on :5432…"
nc -z localhost 5432 2>/dev/null \
  && success "PostgreSQL is reachable." \
  || die "PostgreSQL is not running on :5432.\n   Start it with: brew services start postgresql@16  (or your local equivalent)"

info "Checking local Redis on :6379…"
nc -z localhost 6379 2>/dev/null \
  && success "Redis is reachable." \
  || die "Redis is not running on :6379.\n   Start it with: brew services start redis  (or your local equivalent)"

# ── Server dependencies ───────────────────────────────────────
# Always run npm install so missing/partial node_modules are healed.
# npm ci is a no-op when package-lock.json hasn't changed.
info "Installing server dependencies…"
cd "$ROOT" && npm install --prefer-offline --silent

# ── Auto-provision DB (idempotent) ────────────────────────────
info "Ensuring database + schema are up to date…"
node "$ROOT/scripts/setup-local-db.js" || die "Database setup failed. See above."

# ── Backend dev server ────────────────────────────────────────
info "Starting backend server (ts-node-dev)…"
LOG_SERVER="$LOG_DIR/server.log"
cd "$ROOT"
# Extend CORS_ORIGIN so LAN devices (phones on the same Wi-Fi) are allowed.
# dotenv won't override env vars already set in the shell environment.
export CORS_ORIGIN="http://localhost:3000,http://${LAN_IP}:3000"
nohup npm run dev < /dev/null > "$LOG_SERVER" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" >> "$PID_FILE"
success "Server started  (PID $SERVER_PID) — logs: $LOG_SERVER"

# Wait until the server is accepting connections (port 3001)
info "Waiting for server on :3001…"
for i in $(seq 1 30); do
  if nc -z localhost 3001 2>/dev/null; then
    success "Server is listening on http://localhost:3001"
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    die "Server process died. See $LOG_SERVER"
  fi
  sleep 1
done

# ── Web client (Vite) — default + all modes ───────────────────
if [[ "$MODE" == "dev" || "$MODE" == "all" ]]; then
  WEB_DIR="$ROOT/web"
  if [[ -d "$WEB_DIR" ]]; then
    info "Installing web dependencies…"
    cd "$WEB_DIR" && npm install --prefer-offline --silent
    info "Starting web client (Vite)…"
    LOG_WEB="$LOG_DIR/web.log"
    cd "$WEB_DIR"
    nohup npm run dev < /dev/null > "$LOG_WEB" 2>&1 &
    WEB_PID=$!
    echo "$WEB_PID" >> "$PID_FILE"
    success "Web client started  (PID $WEB_PID) — logs: $LOG_WEB"

    # Wait for Vite to be ready, then open the browser
    info "Waiting for web client on :3000…"
    for i in $(seq 1 20); do
      if nc -z localhost 3000 2>/dev/null; then
        WEB_LAN_URL="http://${LAN_IP}:3000"
        success "Web client is ready."
        echo ""
        echo -e "${BOLD}  ┌─────────────────────────────────────────┐${RESET}"
        echo -e "${BOLD}  │   Scan to open in browser / Expo Go     │${RESET}"
        echo -e "${BOLD}  └─────────────────────────────────────────┘${RESET}"
        echo ""
        npx --yes qrcode-terminal "$WEB_LAN_URL" 2>/dev/null || \
          warn "npx qrcode-terminal failed — open manually: $WEB_LAN_URL"
        echo ""
        echo -e "  ${BOLD}Desktop${RESET}  →  http://localhost:3000"
        echo -e "  ${BOLD}Mobile ${RESET}  →  ${WEB_LAN_URL}  (same Wi-Fi)"
        echo ""
        open_browser "http://localhost:3000"
        break
      fi
      sleep 1
    done
  fi
fi

# ── Mobile client (Expo) — mobile + all modes ─────────────────
if [[ "$MODE" == "mobile" || "$MODE" == "all" ]]; then
  MOBILE_DIR="$ROOT/mobile"
  if [[ -d "$MOBILE_DIR" ]]; then
    info "Installing mobile dependencies…"
    cd "$MOBILE_DIR" && npm install --prefer-offline --silent
    info "Starting Expo dev server (LAN mode — phone must be on the same Wi-Fi)…"
    LOG_MOBILE="$LOG_DIR/mobile.log"
    cd "$MOBILE_DIR"
    # --lan: uses your local network IP so Expo Go on a real device can connect
    # without needing an Expo account or internet tunnel.
    EXPO_PUBLIC_API_URL="http://${LAN_IP}:3001" \
      nohup npx expo start --lan < /dev/null > "$LOG_MOBILE" 2>&1 &
    MOBILE_PID=$!
    echo "$MOBILE_PID" >> "$PID_FILE"
    success "Expo started  (PID $MOBILE_PID) — logs: $LOG_MOBILE"

    # Wait for Metro bundler port 8081, then show QR + open DevTools
    info "Waiting for Metro bundler on :8081…"
    for i in $(seq 1 30); do
      if nc -z localhost 8081 2>/dev/null; then
        EXPO_URL="exp://${LAN_IP}:8081"
        success "Metro is ready."

        echo ""
        echo -e "${BOLD}  ┌─────────────────────────────────────────┐${RESET}"
        echo -e "${BOLD}  │        Scan with Expo Go on your phone  │${RESET}"
        echo -e "${BOLD}  └─────────────────────────────────────────┘${RESET}"
        echo ""

        # Print QR code inline using qrcode-terminal (no install needed via npx)
        npx --yes qrcode-terminal "$EXPO_URL" 2>/dev/null || \
          warn "npx qrcode-terminal failed — open Expo Go and enter: $EXPO_URL"

        echo ""
        echo -e "  ${BOLD}Expo Go URL :${RESET}  $EXPO_URL"
        echo -e "  ${BOLD}API URL     :${RESET}  http://${LAN_IP}:3001"
        echo ""

        # Open Expo DevTools in the browser
        open_browser "http://localhost:8081"
        break
      fi
      sleep 1
    done
  fi
fi

# ── Summary ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━  All services running  ━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${BOLD}API server${RESET}   →  http://localhost:3001  (LAN: http://${LAN_IP}:3001)"
[[ "$MODE" == "dev" || "$MODE" == "all" ]] && \
  echo -e "  ${BOLD}Web (desktop)${RESET} →  http://localhost:3000" && \
  echo -e "  ${BOLD}Web (mobile) ${RESET} →  http://${LAN_IP}:3000   ← open on your phone"
[[ "$MODE" == "mobile" || "$MODE" == "all" ]] && \
  echo -e "  ${BOLD}Expo / mobile${RESET}→  exp://${LAN_IP}:8081  (Expo Go on same Wi-Fi)"
echo ""
echo -e "  Logs → ${LOG_DIR}/"
echo -e "  Stop → ${BOLD}./start.sh stop${RESET}"
echo ""

# Keep script alive so Ctrl-C kills everything cleanly
trap '
  echo ""
  warn "Shutting down…"
  while IFS= read -r pid; do kill "$pid" 2>/dev/null || true; done < "$PID_FILE"
  rm -f "$PID_FILE"
  success "Done."
' INT TERM

wait
