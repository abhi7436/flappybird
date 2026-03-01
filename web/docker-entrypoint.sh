#!/bin/sh
set -e

# Generate runtime environment config for the single-page app
# This file will be served at /env-config.js and should be loaded by the client.
cat > /usr/share/nginx/html/env-config.js <<'EOF'
window.__ENV__ = {
  API_URL: "${API_URL}",
  VITE_API_URL: "${VITE_API_URL}",
  WS_URL: "${WS_URL}",
  SENTRY_DSN: "${SENTRY_DSN}",
  DB_URL: "${DB_URL}",
  REDIS_URL: "${REDIS_URL}"
};
EOF

exec nginx -g 'daemon off;'
