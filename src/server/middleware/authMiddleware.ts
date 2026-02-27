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
  secure:   isProd,          // HTTPS-only in production
  sameSite: isProd ? 'strict' : 'lax',
  path:     '/',
  // Max-age matches the JWT expiry (default 7 days)
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
  // 1. HTTP-only cookie (preferred — not accessible by JS)
  const cookieToken = (req.cookies as Record<string, string>)?.[AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;
  // 2. Authorization: Bearer <token> (used by WS and API clients without cookies)
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

/**
 * Express middleware — accepts cookie OR Bearer header.
 * Attaches req.user or returns 401.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
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

/** Optional auth — attaches req.user from cookie or Bearer, never blocks */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);
  if (token) {
    try { req.user = verifyToken(token); } catch { /* ignore */ }
  }
  next();
}
