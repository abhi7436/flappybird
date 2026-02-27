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

# Remove default NGINX config
RUN rm /etc/nginx/conf.d/default.conf

# Copy the custom SPA nginx config
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
