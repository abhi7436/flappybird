# ── Stage 1: Build ───────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first to leverage layer caching
COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser  --system --uid 1001 --ingroup appgroup appuser

ENV NODE_ENV=production
# PORT default; Render (and any 12-factor host) overrides this at runtime
ENV PORT=3001

# Copy only built artifacts and production node_modules
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist        ./dist
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

USER appuser

# Render overrides PORT via env var — EXPOSE is documentation only
EXPOSE ${PORT}

# Health check honours the runtime PORT env var
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD /bin/sh -c "wget -qO- http://localhost:${PORT}/health || exit 1"

CMD ["node", "dist/server/index.js"]
