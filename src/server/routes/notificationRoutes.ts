import { Router, Request, Response } from 'express';
import { requireAuth as authenticate } from '../middleware/authMiddleware';
import { db } from '../database/connection';

const router = Router();

/**
 * POST /api/notifications/register-token
 * Body: { token: string; platform?: 'expo' | 'apns' | 'fcm' }
 * Registers a device push token for the authenticated user.
 */
router.post('/register-token', authenticate, async (req: Request, res: Response) => {
  const { token, platform = 'expo' } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }
  const validPlatforms = ['expo', 'apns', 'fcm'];
  if (!validPlatforms.includes(platform)) {
    return res.status(400).json({ error: 'Invalid platform' });
  }

  try {
    await db.none(
      `INSERT INTO device_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, token)
       DO UPDATE SET platform = $3, updated_at = NOW()`,
      [req.user!.userId, token, platform]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register token' });
  }
});

/**
 * DELETE /api/notifications/token
 * Body: { token: string }
 * Removes a push token on logout.
 */
router.delete('/token', authenticate, async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });

  await db.none(
    'DELETE FROM device_tokens WHERE user_id = $1 AND token = $2',
    [req.user!.userId, token]
  );
  res.json({ success: true });
});

export default router;
