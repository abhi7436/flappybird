import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { UserRepository } from '../repositories/UserRepository';
import {
  signToken,
  verifyToken,
  requireAuth,
  setAuthCookie,
  clearAuthCookie,
  AUTH_COOKIE_NAME,
} from '../middleware/authMiddleware';

const router = Router();

// ── Validation schemas ────────────────────────────────────────
const RegisterSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── POST /auth/register ───────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { username, email, password } = parsed.data;

  try {
    const existingEmail = await UserRepository.findByEmail(email);
    if (existingEmail) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const existingUsername = await UserRepository.findByUsername(username);
    if (existingUsername) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const user = await UserRepository.create(username, email, password);
    const token = signToken({ userId: user.id, username: user.username });

    setAuthCookie(res, token);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        high_score: user.high_score,
      },
    });
  } catch (err) {
    console.error('[Auth] Register error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/login ──────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await UserRepository.verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    await UserRepository.setOnlineStatus(user.id, true);
    const token = signToken({ userId: user.id, username: user.username });

    setAuthCookie(res, token);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        high_score: user.high_score,
      },
    });
  } catch (err) {
    console.error('[Auth] Login error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  // JWT is stateless — client discards token.
  // We still flip the online flag if userId is provided via body.
  const { userId } = req.body as { userId?: string };
  if (userId) {
    await UserRepository.setOnlineStatus(userId, false).catch(() => {});
  }
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
});

// ── GET /auth/me ───────────────────────────────────────────────
// Verify cookie or Bearer token, return current user profile.
// Used by the client to restore session on page load.
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await UserRepository.findById(req.user!.userId);
    if (!user) {
      clearAuthCookie(res);
      res.status(404).json({ error: 'User not found' });
      return;
    }
    // Rotate cookie TTL on every /me call (sliding window)
    const token = (req.cookies as Record<string, string>)?.[AUTH_COOKIE_NAME]
      ?? req.headers.authorization?.slice(7)
      ?? '';
    if (token) setAuthCookie(res, token);
    res.json({
      token: token || undefined,
      user:  {
        id:         user.id,
        username:   user.username,
        avatar:     user.avatar,
        high_score: user.high_score,
      },
    });
  } catch (err) {
    console.error('[Auth] /me error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
