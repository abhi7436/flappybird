# Deployment Guide — Flappy Birds Multiplayer

## Prerequisites

| Tool | Version |
|---|---|
| Docker | 24+ |
| Docker Compose | v2.20+ |
| Node.js (local dev only) | 20 LTS |
| A Linux VPS or cloud VM | 2 vCPU / 2 GB RAM minimum |

---

## Local Development

```bash
# 1. Install dependencies
npm install
cd web && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL, JWT_SECRET

# 3. Start infrastructure (Postgres + Redis only)
docker compose up db redis -d

# 4. Run DB migrations
npm run db:migrate

# 5. Start the API server (hot-reload)
npm run dev

# 6. Start the web frontend (Vite hot-reload)
cd web && npm run dev
```

API: http://localhost:3001  
Frontend: http://localhost:5173

---

## Production Deployment (Docker Compose)

### 1. Clone and configure

```bash
git clone https://github.com/your-org/flappy-birds-multiplayer.git
cd flappy-birds-multiplayer

cp .env.example .env
```

Edit `.env` and fill in every required value:

```bash
# Generate a strong JWT secret
openssl rand -hex 32

# Required variables
JWT_SECRET=<output from above>
POSTGRES_PASSWORD=<strong password>
CORS_ORIGIN=https://play.yourdomain.com
FRONTEND_URL=https://play.yourdomain.com
VITE_API_URL=https://play.yourdomain.com
DOMAIN=play.yourdomain.com
```

### 2. Obtain SSL certificates (first-time only)

```bash
# Temporarily start NGINX in HTTP-only mode and run certbot
docker compose -f docker-compose.prod.yml up nginx certbot -d

docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d play.yourdomain.com \
  --email you@example.com \
  --agree-tos --no-eff-email
```

### 3. Build and start all services

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Apply database migrations

```bash
docker compose -f docker-compose.prod.yml exec app1 \
  node -e "require('child_process').execSync('psql \$DATABASE_URL -f /app/dist/server/database/schema.sql', {stdio:'inherit'})"
```

Or connect directly:

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U postgres flappybirds -f /docker-entrypoint-initdb.d/schema.sql
```

### 5. Verify health

```bash
# All containers running?
docker compose -f docker-compose.prod.yml ps

# API health
curl -s https://play.yourdomain.com/health | jq .

# Logs
docker compose -f docker-compose.prod.yml logs -f app1 app2
```

---

## Horizontal Scaling

The app supports multiple API replicas out of the box:

- **Rate limiting** is backed by Redis (`rate-limit-redis`) — counts are shared across replicas.
- **Socket.IO** uses the `@socket.io/redis-adapter` — room broadcasts fan out to all replicas.
- **Leaderboard** uses Redis pub/sub — subscribers on every replica receive updates.

To add a third replica, define `app3` in `docker-compose.prod.yml` mirroring `app1`/`app2`, then add it to the NGINX upstream block in `nginx/nginx.conf`.

---

## Certificate Renewal

The `certbot` service runs a renewal loop every 12 hours. Verify it's working:

```bash
docker compose -f docker-compose.prod.yml logs certbot
```

Force a renewal dry-run:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot renew --dry-run
```

After renewal, reload NGINX (zero-downtime):

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## Health Endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | API server + uptime + environment |

---

## Common Issues

### Port 80/443 already in use

```bash
sudo lsof -i :80      # find the conflicting process
sudo systemctl stop apache2  # or nginx, caddy, etc.
```

### Redis connection refused

Ensure `REDIS_URL` matches the Docker service name (`redis`) when running in Docker, or `localhost` for local dev.

### JWT_SECRET validation error on startup

The secret must be at least 32 characters. Generate one with `openssl rand -hex 32`.

### CORS errors in the browser

Add your domain to `CORS_ORIGIN` (comma-separated, no trailing slash):

```
CORS_ORIGIN=https://play.yourdomain.com,https://yourdomain.com
```

### Render returns HTML / 405 for `/api/*` and UI shows `Unexpected token '<'`

If Web and API are separate Render services, relative URLs like `/api/auth/login`
will hit the Web service (Nginx/static) instead of the API service.

Set these environment variables on the **Web** service and redeploy:

```bash
VITE_API_URL=https://<your-api-service>.onrender.com
VITE_WS_URL=wss://<your-api-service>.onrender.com
```

Also set this on the **API** service:

```bash
CORS_ORIGIN=https://<your-web-service>.onrender.com
FRONTEND_URL=https://<your-web-service>.onrender.com
```

Use HTTPS URLs in production. Browsers show request payloads in DevTools by design,
but traffic is encrypted in transit when the request URL is `https://`.

---

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Compose will rebuild only changed images and perform a rolling restart.

---

## Backup

```bash
# Postgres
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U postgres flappybirds > backup_$(date +%Y%m%d).sql

# Redis (AOF is already persisted in the redis_data volume)
docker compose -f docker-compose.prod.yml exec redis \
  redis-cli BGSAVE
```
