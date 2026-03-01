# DockerHub → Render Deployment Guide

Deploy all four Flappy Bird services as Docker containers pulled from DockerHub.

---

## Service Overview

| # | Service | Image | Render Type |
|---|---|---|---|
| 1 | **flappybird-api** | `<you>/flappybird-api:latest` | Web Service |
| 2 | **flappybird-web** | `<you>/flappybird-web:latest` | Web Service |
| 3 | **flappybird-redis** | `redis:7-alpine` (official) | Private Service |
| 4 | **flappybird-db** | `postgres:16-alpine` (official) | Private Service + Persistent Disk |

> **Custom images** (API, Web) are built from this repo and pushed to your DockerHub account.  
> **Official images** (Redis, PostgreSQL) are pulled directly from DockerHub — no build step required.

---

## Prerequisites

| Tool | Purpose |
|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) 24+ | Building images |
| [Docker Buildx](https://docs.docker.com/buildx/install/) | Multi-platform builds (comes with Docker Desktop) |
| A [DockerHub](https://hub.docker.com) account | Hosting images |
| A [Render](https://render.com) account | Running containers |

---

## Part 1 — Build & Push Images to DockerHub

### 1.1 Log in to DockerHub

```bash
docker login
# Enter your DockerHub username and password/token when prompted
```

### 1.2 Enable buildx for multi-platform builds

Render runs on **linux/amd64**. If you are on Apple Silicon (M1/M2/M3), you must
cross-compile.

```bash
# Create and use a buildx builder (one-time setup)
docker buildx create --name render-builder --use
docker buildx inspect --bootstrap
```

### 1.3 Build & push — API service

```bash
export DOCKERHUB_USERNAME=<your-dockerhub-username>

docker buildx build \
  --platform linux/amd64 \
  --tag "$DOCKERHUB_USERNAME/flappybird-api:latest" \
  --push \
  .   # run from the repo root
```

### 1.4 Build & push — Web service

`VITE_API_URL` is baked into the JavaScript bundle at build time, so you must
provide the final Render URL of the API service here.

```bash
docker buildx build \
  --platform linux/amd64 \
  --build-arg VITE_API_URL="https://flappybird-api.onrender.com" \
  --tag "$DOCKERHUB_USERNAME/flappybird-web:latest" \
  --push \
  ./web
```

> If you later change the API URL, rebuild and re-push this image, then redeploy
> `flappybird-web` on Render.

### 1.5 Verify

```bash
# Both images should appear at:
# https://hub.docker.com/r/<your-dockerhub-username>/flappybird-api
# https://hub.docker.com/r/<your-dockerhub-username>/flappybird-web
docker pull "$DOCKERHUB_USERNAME/flappybird-api:latest"
docker pull "$DOCKERHUB_USERNAME/flappybird-web:latest"
```

---

## Part 2 — Create Render Services

Create all four services **in the order listed below** so that Redis and
PostgreSQL are ready before the API tries to connect.

---

### Service 1 — PostgreSQL Database (`flappybird-db`)

> Render also offers a managed PostgreSQL product (cheaper, easier). Use this
> Docker-based approach only if you specifically need a custom image/config.

**Render dashboard:** New → Private Service → Deploy an existing image

| Setting | Value |
|---|---|
| Image URL | `docker.io/postgres:16-alpine` |
| Service name | `flappybird-db` |
| Region | Oregon (US West) |
| Instance type | Starter ($7/mo) — free tier has no persistent disk |
| Internal port | `5432` |

**Persistent Disk** (required — add under *Advanced*):

| Setting | Value |
|---|---|
| Mount path | `/var/lib/postgresql/data` |
| Size | 1 GB minimum |

#### Environment variables for `flappybird-db`

| Variable | Example value | Description |
|---|---|---|
| `POSTGRES_DB` | `flappybirds` | Name of the database to create on first start |
| `POSTGRES_USER` | `flappybird` | Superuser username to create |
| `POSTGRES_PASSWORD` | *(generate strong password)* | Superuser password — keep this secret |
| `PGDATA` | `/var/lib/postgresql/data/pgdata` | Data directory inside the persistent disk mount |

After the service is running, note its **internal hostname** (shown in the Render
dashboard under *Connect*). It will be something like
`flappybird-db.internal:5432`.

**Apply schema (one-time):**

```bash
# From your local machine (port-forward via Render shell or psql directly)
psql "postgresql://flappybird:<password>@<render-host>:5432/flappybirds" \
  -f src/server/database/schema.sql
```

---

### Service 2 — Redis (`flappybird-redis`)

**Render dashboard:** New → Private Service → Deploy an existing image

| Setting | Value |
|---|---|
| Image URL | `docker.io/redis:7-alpine` |
| Service name | `flappybird-redis` |
| Region | Oregon (US West) |
| Instance type | Starter |
| Internal port | `6379` |

**Docker command** (add under *Advanced → Docker Command*):

```
redis-server --appendonly yes
```

#### Environment variables for `flappybird-redis`

Redis requires **no environment variables** in the default (no-auth) setup.
For password-protected Redis, add:

| Variable | Example value | Description |
|---|---|---|
| `REDIS_PASSWORD` | *(generate strong password)* | Optional. When set, redis starts with `--requirepass $REDIS_PASSWORD`. You must also update `REDIS_URL` on the API to include the password: `redis://:password@host:6379` |

After the service is running, note its **internal hostname** (e.g.
`flappybird-redis.internal:6379`).

---

### Service 3 — API Server (`flappybird-api`)

**Render dashboard:** New → Web Service → Deploy an existing image

| Setting | Value |
|---|---|
| Image URL | `docker.io/<your-dockerhub-username>/flappybird-api:latest` |
| Service name | `flappybird-api` |
| Region | Oregon (US West) |
| Instance type | Starter (or Free for testing) |
| Health check path | `/health` |

#### Environment variables for `flappybird-api`

| Variable | Required | Example / Default | Description |
|---|---|---|---|
| `NODE_ENV` | ✅ | `production` | Node.js environment mode. Must be `production` on Render. |
| `PORT` | ⚙️ auto | `3001` | HTTP port the server listens on. **Render injects this automatically** — do not set manually. |
| `DATABASE_URL` | ✅ | `postgresql://flappybird:pass@flappybird-db.internal:5432/flappybirds` | Full PostgreSQL connection string. Use the **internal** hostname from the `flappybird-db` service. |
| `REDIS_URL` | ✅ | `redis://flappybird-redis.internal:6379` | Full Redis connection URL. Use the **internal** hostname from the `flappybird-redis` service. |
| `JWT_SECRET` | ✅ | *(run `openssl rand -hex 32`)* | Secret used to sign and verify JWT tokens. Minimum 32 characters. Never commit this value. |
| `JWT_EXPIRES_IN` | ✅ | `7d` | JWT token lifetime. Accepts any value supported by the `jsonwebtoken` library (e.g. `1h`, `7d`, `30d`). |
| `CORS_ORIGIN` | ✅ | `https://flappybird-web.onrender.com` | Comma-separated list of allowed CORS origins. Must include the exact URL of `flappybird-web`. |
| `FRONTEND_URL` | ✅ | `https://flappybird-web.onrender.com` | Base URL of the frontend. Used for generating share/invite links in emails and API responses. |
| `RATE_LIMIT_WINDOW_MS` | ⬜ | `900000` | Rate-limit sliding window duration in milliseconds (default 15 min). |
| `RATE_LIMIT_MAX` | ⬜ | `100` | Max general requests per IP per window. |
| `AUTH_RATE_LIMIT_MAX` | ⬜ | `10` | Max login/register requests per IP per window — tighter limit to slow brute-force. |
| `MAX_PLAYERS_PER_ROOM` | ⬜ | `50` | Maximum concurrent players allowed in a single game room. |
| `BCRYPT_ROUNDS` | ⬜ | `12` | bcrypt cost factor for password hashing. Higher = slower hashing, more CPU. Range 10–14. |

---

### Service 4 — Web Frontend (`flappybird-web`)

**Render dashboard:** New → Web Service → Deploy an existing image

| Setting | Value |
|---|---|
| Image URL | `docker.io/<your-dockerhub-username>/flappybird-web:latest` |
| Service name | `flappybird-web` |
| Region | Oregon (US West) |
| Instance type | Starter (or Free) |
| Health check path | `/` |

#### Environment variables for `flappybird-web`

| Variable | Required | Example / Default | Description |
|---|---|---|---|
| `PORT` | ⚙️ auto | `80` | Port that NGINX listens on inside the container. **Render injects this automatically** — the `nginx-spa.conf.template` envsubst step picks it up. Do not set manually. |
| `VITE_API_URL` | ⚠️ build-time | `https://flappybird-api.onrender.com` | WebSocket / REST API base URL. This value is **inlined into the compiled JavaScript bundle at build time** by Vite. If you change it, you must rebuild and re-push the image, then redeploy this service. |

> The `VITE_API_URL` is baked in during `docker buildx build --build-arg`. Setting
> it as a Render runtime env var alone has **no effect** — rebuild the image with
> the correct value (see step 1.4).

---

## Part 3 — Post-Deploy Checklist

1. **Verify all 4 services are healthy** in the Render dashboard.

2. **Apply the database schema** (first deploy only):

   Use the Render shell (*flappybird-api → Shell*):
   ```bash
   psql $DATABASE_URL -f dist/server/database/schema.sql
   ```

3. **Update API URLs** if Render assigned different domains:
   - `flappybird-api`: update `CORS_ORIGIN` and `FRONTEND_URL`
   - Rebuild `flappybird-web` image with the correct `VITE_API_URL`, push, redeploy

4. **Smoke test**:
   ```bash
   # API health
   curl https://flappybird-api.onrender.com/health

   # Frontend loads
   curl -I https://flappybird-web.onrender.com
   ```

---

## Part 4 — Updating Services

| What changed | Action |
|---|---|
| Backend code | `./deploy.sh` (rebuilds + pushes API image, triggers Render redeploy) |
| Frontend code or `VITE_API_URL` | `./deploy.sh` (rebuilds + pushes Web image, triggers Render redeploy) |
| Render env var (server-side only) | Update in Render dashboard → Save → auto-redeploy |
| Redis / PostgreSQL version | Change the image tag in Render dashboard (`postgres:16-alpine` → `postgres:17-alpine`) |

---

## Automated Deploys with `deploy.sh`

See [deploy.sh](deploy.sh) in this repo root.

```bash
# Minimal — builds and pushes both images
DOCKERHUB_USERNAME=myuser ./deploy.sh

# With Render auto-redeploy triggered
DOCKERHUB_USERNAME=myuser \
RENDER_API_KEY=rnd_xxxx \
RENDER_API_SERVICE_ID=srv-xxxx \    # flappybird-api service ID
RENDER_WEB_SERVICE_ID=srv-yyyy \    # flappybird-web service ID
./deploy.sh
```

---

## Render Service IDs

You need service IDs to trigger deploys via the Render API (used by `deploy.sh`). Find them at:

```
https://dashboard.render.com/web/<service-id>
# or
Render dashboard → your service → Settings → Service ID (top of page)
```
