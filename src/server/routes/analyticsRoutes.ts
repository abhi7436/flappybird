import { Router, Request, Response } from 'express';
import { requireAuth as authenticate } from '../middleware/authMiddleware';
import { AnalyticsService } from '../services/AnalyticsService';

const router = Router();

/** GET /api/analytics/me */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  const data = await AnalyticsService.getPlayerAnalytics(req.user!.userId);
  if (!data) return res.status(404).json({ error: 'User not found' });
  res.json({ analytics: data });
});

/** GET /api/analytics/users/:userId */
router.get('/users/:userId', async (req: Request, res: Response) => {
  const data = await AnalyticsService.getPlayerAnalytics(req.params.userId);
  if (!data) return res.status(404).json({ error: 'User not found' });
  res.json({ analytics: data });
});

/** GET /api/analytics/leaderboard?sort=high_score|elo&limit=100 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  const sort  = req.query.sort === 'elo' ? 'elo' : 'high_score';
  const limit = Math.min(parseInt((req.query.limit as string) ?? '100'), 500);
  const data  = await AnalyticsService.getGlobalLeaderboard(sort, limit);
  res.json({ entries: data });
});

/** GET /api/analytics/me/history?limit=20&offset=0 */
router.get('/me/history', authenticate, async (req: Request, res: Response) => {
  const limit  = Math.min(parseInt((req.query.limit  as string) ?? '20'), 100);
  const offset = parseInt((req.query.offset as string) ?? '0');
  const history = await AnalyticsService.getMatchHistory(req.user!.userId, limit, offset);
  res.json({ history });
});

export default router;
