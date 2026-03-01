import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { requireAuth as authenticate } from '../middleware/authMiddleware';
import { TournamentRepository } from '../repositories/TournamentRepository';
import { TournamentService } from '../services/TournamentService';
import { UserModel } from '../database/models';

const router = Router();

const CreateSchema = z.object({
  name:            z.string().min(3).max(128),
  description:     z.string().max(512).optional(),
  bracketType:     z.enum(['single_elimination', 'round_robin']).default('single_elimination'),
  maxParticipants: z.number().int().min(2).max(64).default(16),
  startsAt:        z.string().datetime(),
  prizeInfo:       z.string().max(256).optional(),
});

/** GET /api/tournaments */
router.get('/', async (req: Request, res: Response) => {
  const status = (req.query.status as string) || undefined;
  const limit  = Math.min(parseInt((req.query.limit as string) ?? '20'), 100);
  const offset = parseInt((req.query.offset as string) ?? '0');
  try {
    const tournaments = await TournamentRepository.list(status as any, limit, offset);
    res.json({ tournaments });
  } catch {
    res.status(500).json({ error: 'Failed to list tournaments' });
  }
});

/** GET /api/tournaments/:id */
router.get('/:id', async (req: Request, res: Response) => {
  const detail = await TournamentRepository.getById(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Tournament not found' });
  res.json({ tournament: detail });
});

/** POST /api/tournaments — create (authenticated) */
router.post('/', authenticate, async (req: Request, res: Response) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const tournament = await TournamentRepository.create({
      ...parsed.data,
      startsAt:  new Date(parsed.data.startsAt),
      createdBy: req.user!.userId,
    });
    res.status(201).json({ tournament });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

/** POST /api/tournaments/:id/register */
router.post('/:id/register', authenticate, async (req: Request, res: Response) => {
  try {
    const userDoc = await UserModel.findById(new Types.ObjectId(req.user!.userId)).select('elo_rating');
    const elo_rating = userDoc ? (userDoc.toJSON() as Record<string, unknown>)['elo_rating'] as number : 1000;
    await TournamentRepository.register(req.params.id, req.user!.userId, elo_rating);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'TOURNAMENT_FULL') {
      return res.status(409).json({ error: 'Tournament is full' });
    }
    res.status(500).json({ error: 'Failed to register' });
  }
});

/** POST /api/tournaments/:id/start — organiser only */
router.post('/:id/start', authenticate, async (req: Request, res: Response) => {
  const detail = await TournamentRepository.getById(req.params.id);
  if (!detail) return res.status(404).json({ error: 'Not found' });
  if (detail.created_by !== req.user!.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    await TournamentService.startTournament(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/** POST /api/tournaments/matches/:matchId/result */
router.post('/matches/:matchId/result', authenticate, async (req: Request, res: Response) => {
  const { winnerId, player1Score, player2Score } = req.body;
  if (!winnerId || player1Score == null || player2Score == null) {
    return res.status(400).json({ error: 'winnerId, player1Score, player2Score required' });
  }
  try {
    await TournamentService.recordMatchResult(
      req.params.matchId,
      winnerId,
      parseInt(player1Score),
      parseInt(player2Score)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
