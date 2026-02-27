import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/authMiddleware';
import { UserRepository } from '../repositories/UserRepository';
import { GameHistoryRepository } from '../repositories/GameHistoryRepository';

const router = Router();

// ── GET /profile/me ───────────────────────────────────────────
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await UserRepository.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { password_hash, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error('[Profile] GET /me error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── PATCH /profile/avatar ─────────────────────────────────────
const AvatarSchema = z.object({ avatarUrl: z.string().url() });

router.patch('/avatar', requireAuth, async (req: Request, res: Response) => {
  const parsed = AvatarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    await UserRepository.updateAvatar(req.user!.userId, parsed.data.avatarUrl);
    res.json({ message: 'Avatar updated' });
  } catch (err) {
    console.error('[Profile] PATCH /avatar error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /profile/:username  (public profile) ──────────────────
router.get('/:username', async (req: Request, res: Response) => {
  try {
    const user = await UserRepository.findByUsername(req.params.username);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const profile = await UserRepository.publicProfile(user.id);
    const history = await GameHistoryRepository.listByUser(user.id, 5);

    res.json({ profile, recentGames: history });
  } catch (err) {
    console.error('[Profile] GET /:username error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /profile/me/solo-score ──────────────────────────────
// Called by the client after a solo game to persist the new high score.
// Uses GREATEST() server-side so only improvements are recorded.
const SoloScoreSchema = z.object({ score: z.number().int().min(0) });

router.post('/me/solo-score', requireAuth, async (req: Request, res: Response) => {
  const parsed = SoloScoreSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    await UserRepository.updateHighScore(req.user!.userId, parsed.data.score);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Profile] POST /me/solo-score error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /profile/me/history ───────────────────────────────────
router.get('/me/history', requireAuth, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  try {
    const history = await GameHistoryRepository.listByUser(
      req.user!.userId,
      limit,
      offset
    );
    res.json(history);
  } catch (err) {
    console.error('[Profile] GET /me/history error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
