import { Request, Response, NextFunction, CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';
import { config, isProd } from '../config/env';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const JWT_SECRET = config.JWT_SECRET;

// ── Cookie config ─────────────────────────────────────────────
export const AUTH_COOKIE_NAME = 'flappy_auth';

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure:   isProd,
  sameSite: isProd ? 'strict' : 'lax',
  path:     '/',
  maxAge:   7 * 24 * 60 * 60 * 1000,
};

/** Set the JWT as an HTTP-only cookie on the response */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
}

/** Clear the auth cookie */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
}

/** Extract the JWT from request — cookie preferred, Bearer fallback */
export function extractToken(req: Request): string | null {
  const cookieToken = (req.cookies as Record<string, string>)?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const expiresIn = config.JWT_EXPIRES_IN as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`;
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// ── Guest identity helper (used when ENABLE_AUTH=false) ────────────────
/**
 * Build a guest JwtPayload from request headers.
 * The client is responsible for sending consistent values:
 *   x-user-id:   any stable identifier (e.g. localStorage UUID)
 *   x-username:  display name
 *
 * Nothing is cryptographically verified — this is intentional for V1.
 * When you set ENABLE_AUTH=true these headers are ignored entirely
 * and the JWT becomes the source of truth again.
 */
function guestPayload(req: Request): JwtPayload {
  const userId   = (req.headers['x-user-id']   as string | undefined)?.trim() || 'guest';
  const username = (req.headers['x-username']  as string | undefined)?.trim() || 'Guest';
  return { userId, username, iat: 0, exp: 0 };
}

/**
 * Express middleware — accepts cookie OR Bearer header.
 *
 * When ENABLE_AUTH=false (V1): always passes through, attaches a guest
 * identity derived from x-user-id / x-username request headers.
 *
 * When ENABLE_AUTH=true: validates JWT, returns 401 on failure.
 * Re-enable by setting ENABLE_AUTH=true in your .env — no code changes needed.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // ── V1: auth disabled — passthrough ────────────────────────────
  if (!config.ENABLE_AUTH) {
    req.user = guestPayload(req);
    next();
    return;
  }
  // ── Full auth ──────────────────────────────────────────────────
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth — attaches req.user if a valid token is present, never blocks.
 *
 * When ENABLE_AUTH=false: always attaches the guest identity.
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!config.ENABLE_AUTH) {
    req.user = guestPayload(req);
    next();
    return;
  }
  const token = extractToken(req);
  if (token) {
    try { req.user = verifyToken(token); } catch { /* ignore */ }
  }
  next();
}
