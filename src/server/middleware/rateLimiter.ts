import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../config/env';

// ── Shared Redis client for rate-limit counters ───────────────
// This client is intentionally separate from the app's main
// Redis client so rate-limiting never blocks game traffic.
let redisRatelimitClient: ReturnType<typeof createClient> | undefined;

export async function connectRateLimitRedis(): Promise<void> {
  redisRatelimitClient = createClient({ url: config.REDIS_URL });
  redisRatelimitClient.on('error', (err) =>
    console.error('[RateLimit] Redis error', err)
  );
  await redisRatelimitClient.connect();
}

function makeRedisStore(prefix: string): RedisStore | undefined {
  if (!redisRatelimitClient) return undefined; // fallback to memory
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      (redisRatelimitClient!.sendCommand(args) as unknown) as Promise<number>,
    prefix,
  });
}

// ── Global rate limiter ───────────────────────────────────────
export const globalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRedisStore('rl:global:'),
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => req.path === '/health', // Never rate-limit health checks
});

// ── Auth endpoint limiter (stricter) ─────────────────────────
export const authLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRedisStore('rl:auth:'),
  message: { error: 'Too many auth attempts, please try again later' },
});

// ── WebSocket / API write limiter (per-IP, tighter window) ────
export const wsApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 1 req/sec average
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRedisStore('rl:wsapi:'),
  message: { error: 'Rate limit exceeded' },
});

// ── Generic error handler ─────────────────────────────────────
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error' });
}
