import { Router, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { requireAuth } from '../middleware/authMiddleware';
import { InviteRepository } from '../repositories/InviteRepository';

const router = Router();

// ── POST /invites/:roomId ─────────────────────────────────────
// Generate a shareable invite link for a room
router.post('/:roomId', requireAuth, async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const inviteCode = nanoid(10);

  try {
    const invite = await InviteRepository.create(
      roomId,
      req.user!.userId,
      inviteCode
    );

    const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    res.status(201).json({
      inviteCode: invite.invite_code,
      inviteUrl: `${baseUrl}/join?code=${invite.invite_code}`,
      expiresAt: invite.expires_at,
    });
  } catch (err) {
    console.error('[Invites] POST /:roomId error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /invites/:code/resolve ────────────────────────────────
// Resolve an invite code → room ID
router.get('/:code/resolve', async (req: Request, res: Response) => {
  try {
    const invite = await InviteRepository.findByCode(req.params.code);
    if (!invite) {
      res.status(404).json({ error: 'Invite not found or expired' });
      return;
    }
    res.json({ roomId: invite.room_id });
  } catch (err) {
    console.error('[Invites] GET /:code/resolve error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
