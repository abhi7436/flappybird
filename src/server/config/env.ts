/**
 * Typed environment configuration.
 *
 * All access to process.env should go through this module.
 * Zod validates and coerces every variable at startup so
 * bad configs fail fast rather than at the first use site.
 */
import { z } from 'zod';

// ── Schema ────────────────────────────────────────────────────
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3001),

  // ── Database ─────────────────────────────────────────────
  DATABASE_URL: z.string().url().optional(),
  // MongoDB connection string — used when running with MongoDB backend
  MONGODB_URI: z.string().url().default('mongodb://localhost:27017'),
  MONGODB_DB_NAME: z.string().default('flappybird'),

  // ── Redis ─────────────────────────────────────────────────
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // ── Authentication ────────────────────────────────────────
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .refine(
      (val) =>
        process.env.NODE_ENV !== 'production' ||
        val !== 'change-me-in-production',
      { message: 'JWT_SECRET must be changed from its default in production' }
    ),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // ── CORS ──────────────────────────────────────────────────
  // Comma-separated list of allowed origins, e.g.:
  //   http://localhost:3000,https://play.example.com
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // ── Frontend / share links ────────────────────────────────
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // ── Rate limiting ─────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX:       z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_MAX:  z.coerce.number().int().positive().default(10),

  // ── Game settings ─────────────────────────────────────────
  MAX_PLAYERS_PER_ROOM: z.coerce.number().int().positive().default(50),
  BCRYPT_ROUNDS:        z.coerce.number().int().min(10).max(14).default(12),

  // ── Optional: SSL / TLS (used by NGINX, not app directly) ─
  SSL_CERT_PATH: z.string().optional(),
  SSL_KEY_PATH:  z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// ── Parse ─────────────────────────────────────────────────────
function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.errors
      .map((e) => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    console.error(
      `[Config] Environment validation failed:\n${formatted}`
    );
    process.exit(1);
  }

  return result.data;
}

export const config: Env = parseEnv();

// ── Helpers ───────────────────────────────────────────────────
/** Allowed CORS origins parsed from the comma-separated CORS_ORIGIN var. */
export const allowedOrigins: string[] = config.CORS_ORIGIN
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const isProd = config.NODE_ENV === 'production';
