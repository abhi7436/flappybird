import { Router, Request, Response } from 'express';
import { requireAuth as authenticate } from '../middleware/authMiddleware';
import { ReplayRepository } from '../repositories/ReplayRepository';

const router = Router();

/** GET /api/replays/top — global top replays */
router.get('/top', async (_req: Request, res: Response) => {
  const replays = await ReplayRepository.getTopReplays(10);
  res.json({ replays });
});

/** GET /api/replays/me — authenticated user's replays */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  const limit  = Math.min(parseInt((req.query.limit  as string) ?? '20'), 50);
  const offset = parseInt((req.query.offset as string) ?? '0');
  const replays = await ReplayRepository.listByUser(req.user!.userId, limit, offset);
  res.json({ replays });
});

/** GET /api/replays/:id — fetch a single replay to play back */
router.get('/:id', async (req: Request, res: Response) => {
  const replay = await ReplayRepository.getById(req.params.id);
  if (!replay) return res.status(404).json({ error: 'Replay not found' });
  res.json({ replay });
});

/** GET /api/replays/room/:roomId — all replays for a room */
router.get('/room/:roomId', async (req: Request, res: Response) => {
  const replays = await ReplayRepository.listByRoom(req.params.roomId);
  res.json({ replays });
});

/** DELETE /api/replays/:id — owner can delete their replay */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const deleted = await ReplayRepository.deleteById(req.params.id, req.user!.userId);
  if (!deleted) return res.status(404).json({ error: 'Not found or forbidden' });
  res.json({ success: true });
});

export default router;
