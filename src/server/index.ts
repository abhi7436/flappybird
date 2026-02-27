import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { config, allowedOrigins, isProd } from './config/env';
import { connectRedis } from './database/redisClient';
import { pool } from './database/connection';
import { initializeWebSocketServer } from './WebSocketServer';
import {
  globalLimiter,
  authLimiter,
  connectRateLimitRedis,
  errorHandler,
} from './middleware/rateLimiter';

// Routes
import authRoutes         from './routes/authRoutes';
import profileRoutes      from './routes/profileRoutes';
import friendRoutes       from './routes/friendRoutes';
import inviteRoutes       from './routes/inviteRoutes';
import roomRoutes         from './routes/roomRoutes';
import skinRoutes         from './routes/skinRoutes';
import tournamentRoutes   from './routes/tournamentRoutes';
import replayRoutes       from './routes/replayRoutes';
import analyticsRoutes    from './routes/analyticsRoutes';
import notificationRoutes from './routes/notificationRoutes';

// ── CORS origin validator ──────────────────────────────────────
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

async function bootstrap(): Promise<void> {
  // ── Connect datastores ──────────────────────────────────
  await connectRedis();
  await connectRateLimitRedis();
  await pool.query('SELECT 1'); // Verify DB connection
  console.log('[Server] Datastores connected');

  // ── Express app ─────────────────────────────────────────
  const app = express();

  // Trust the first proxy hop (NGINX) so express-rate-limit
  // uses the real client IP from X-Forwarded-For.
  if (isProd) app.set('trust proxy', 1);

  // ── Security headers ────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc:  ["'self'"],
          styleSrc:   ["'self'", "'unsafe-inline'"],
          imgSrc:     ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", ...allowedOrigins],
          fontSrc:    ["'self'"],
          objectSrc:  ["'none'"],
          frameSrc:   ["'none'"],
          upgradeInsecureRequests: isProd ? [] : null,
        },
      },
      hsts: isProd
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      permittedCrossDomainPolicies: false,
    })
  );

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser()); // Parse HTTP-only cookies for JWT auth
  app.use(globalLimiter);

  // ── REST routes ─────────────────────────────────────────
  app.use('/api/auth',           authLimiter, authRoutes);
  app.use('/api/profile',        profileRoutes);
  app.use('/api/friends',        friendRoutes);
  app.use('/api/invites',        inviteRoutes);
  app.use('/api/rooms',          roomRoutes);
  app.use('/api/skins',          skinRoutes);
  app.use('/api/tournaments',    tournamentRoutes);
  app.use('/api/replays',        replayRoutes);
  app.use('/api/analytics',      analyticsRoutes);
  app.use('/api/notifications',  notificationRoutes);

  // ── Health check ────────────────────────────────────────
  app.get('/health', (_req, res) =>
    res.json({
      status: 'ok',
      env: config.NODE_ENV,
      uptime: process.uptime(),
    })
  );

  // ── 404 handler ─────────────────────────────────────────
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // ── Error handler ────────────────────────────────────────
  app.use(errorHandler);

  // ── HTTP + WebSocket server ─────────────────────────────
  const httpServer = http.createServer(app);
  await initializeWebSocketServer(httpServer);

  httpServer.listen(config.PORT, () => {
    console.log(`[Server] Listening on http://localhost:${config.PORT}`);
  });

  // ── Graceful shutdown ────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[Server] ${signal} received — shutting down gracefully`);
    httpServer.close(async () => {
      await pool.end();
      console.log('[Server] Closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[Server] Fatal startup error', err);
  process.exit(1);
});
