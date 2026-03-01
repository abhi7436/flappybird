# ── Stage 1: Build React/Vite app ────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Inject the API base URL at build time (VITE_ vars are inlined by Vite)
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Serve with NGINX ─────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Remove default NGINX config
RUN rm /etc/nginx/conf.d/default.conf

# Copy the template — envsubst rewrites ${PORT} at container start
COPY nginx-spa.conf.template /etc/nginx/templates/default.conf.template

# Also keep the static fallback for local docker-compose (port 80)
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# PORT default; Render overrides at runtime
ENV PORT=80

EXPOSE ${PORT}

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD /bin/sh -c "wget -qO- http://localhost:${PORT}/index.html || exit 1"

# Use a startup script: run envsubst then hand off to nginx
CMD ["/bin/sh", "-c", \
  "envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]

