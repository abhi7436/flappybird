import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/authMiddleware';
import { FriendRepository } from '../repositories/FriendRepository';
import { UserRepository } from '../repositories/UserRepository';

const router = Router();

const UserIdSchema = z.object({ userId: z.string().uuid() });

// ── POST /friends/request ─────────────────────────────────────
// Send a friend request to another user
router.post('/request', requireAuth, async (req: Request, res: Response) => {
  const parsed = UserIdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const requesterId = req.user!.userId;
  const receiverId = parsed.data.userId;

  if (requesterId === receiverId) {
    res.status(400).json({ error: 'Cannot send friend request to yourself' });
    return;
  }

  try {
    const receiver = await UserRepository.findById(receiverId);
    if (!receiver) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const record = await FriendRepository.sendRequest(requesterId, receiverId);
    res.status(201).json(record);
  } catch (err: any) {
    if (err.message?.includes('already exists')) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('[Friends] POST /request error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /friends/accept ──────────────────────────────────────
// Accept a pending request (current user is the receiver)
router.post('/accept', requireAuth, async (req: Request, res: Response) => {
  const parsed = UserIdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const receiverId = req.user!.userId;
  const requesterId = parsed.data.userId;

  try {
    const record = await FriendRepository.acceptRequest(requesterId, receiverId);
    res.json(record);
  } catch (err: any) {
    if (err.message?.includes('No pending request')) {
      res.status(404).json({ error: err.message });
      return;
    }
    console.error('[Friends] POST /accept error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /friends/:userId ───────────────────────────────────
// Remove friend (bidirectional) or reject/cancel request
router.delete('/:userId', requireAuth, async (req: Request, res: Response) => {
  const parsed = UserIdSchema.safeParse({ userId: req.params.userId });
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid userId' });
    return;
  }

  try {
    await FriendRepository.remove(req.user!.userId, parsed.data.userId);
    res.json({ message: 'Friend removed' });
  } catch (err) {
    console.error('[Friends] DELETE /:userId error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /friends/block ───────────────────────────────────────
router.post('/block', requireAuth, async (req: Request, res: Response) => {
  const parsed = UserIdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const record = await FriendRepository.block(
      req.user!.userId,
      parsed.data.userId
    );
    res.json(record);
  } catch (err) {
    console.error('[Friends] POST /block error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /friends ──────────────────────────────────────────────
// List accepted friends with online status
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const friends = await FriendRepository.listFriends(req.user!.userId);
    res.json(friends);
  } catch (err) {
    console.error('[Friends] GET / error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /friends/pending ──────────────────────────────────────
// Incoming pending friend requests
router.get('/pending', requireAuth, async (req: Request, res: Response) => {
  try {
    const pending = await FriendRepository.listPending(req.user!.userId);
    res.json(pending);
  } catch (err) {
    console.error('[Friends] GET /pending error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
