import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { requireAuth as authenticate } from '../middleware/authMiddleware';
import { DeviceTokenModel } from '../database/models';

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
    await DeviceTokenModel.updateOne(
      { user_id: new Types.ObjectId(req.user!.userId), token },
      { $set: { platform, updated_at: new Date() }, $setOnInsert: { user_id: new Types.ObjectId(req.user!.userId), token } },
      { upsert: true }
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

  await DeviceTokenModel.deleteOne({
    user_id: new Types.ObjectId(req.user!.userId),
    token,
  });
  res.json({ success: true });
});

export default router;
