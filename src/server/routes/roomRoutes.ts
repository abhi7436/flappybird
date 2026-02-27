import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import { validateRoomOpen, validateJoinToken } from '../middleware/roomMiddleware';
import { RoomService } from '../services/RoomService';

const router = Router();

// ── POST /rooms  ──────────────────────────────────────────────
// Create a new room. Returns a shareable join URL + signed join token.
//
// Response:
//  { roomId, joinToken, joinUrl, expiresAt }
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const baseUrl  = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const result   = await RoomService.createRoom(req.user!.userId, baseUrl);

    res.status(201).json(result);
  } catch (err) {
    console.error('[Rooms] POST / error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /rooms/:roomId  ───────────────────────────────────────
// Public: fetch room metadata (status, player count, etc.)
router.get('/:roomId', async (req: Request, res: Response) => {
  try {
    const meta = await RoomService.getMeta(req.params.roomId);
    if (!meta) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.json(meta);
  } catch (err) {
    console.error('[Rooms] GET /:roomId error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /rooms/:roomId/validate-join  ─────────────────────────
// Pre-flight check before opening a WebSocket connection.
// Validates:
//   1. Room is open (status = waiting | active)
//   2. Optional join token (?t=<token>) is valid for this room
//
// Clients should call this before emitting `join_room` over WS.
router.get(
  '/:roomId/validate-join',
  validateRoomOpen,
  validateJoinToken,
  async (_req: Request, res: Response) => {
    res.json({ ok: true });
  }
);

// ── DELETE /rooms/:roomId  ────────────────────────────────────
// Host can manually close their room.
router.delete(
  '/:roomId',
  requireAuth,
  validateRoomOpen,
  async (req: Request, res: Response) => {
    try {
      const meta = await RoomService.getMeta(req.params.roomId);

      // Only room creator can close manually
      if (meta?.createdBy !== req.user!.userId) {
        res.status(403).json({ error: 'Only the room host can close the room' });
        return;
      }

      await RoomService.closeRoom(req.params.roomId, 'manual');
      res.json({ message: 'Room closed' });
    } catch (err) {
      console.error('[Rooms] DELETE /:roomId error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── GET /rooms/:roomId/fresh-token  ──────────────────────────
// Authenticated: regenerate a fresh join token for an open room.
// Useful when sharing a room whose original token is near-expiry.
router.get(
  '/:roomId/fresh-token',
  requireAuth,
  validateRoomOpen,
  async (req: Request, res: Response) => {
    try {
      const roomId   = req.params.roomId;
      const meta     = await RoomService.getMeta(roomId);

      if (meta?.createdBy !== req.user!.userId) {
        res.status(403).json({ error: 'Only the room host can refresh the token' });
        return;
      }

      const joinToken = RoomService.generateJoinToken(roomId);
      const baseUrl   = process.env.FRONTEND_URL ?? 'http://localhost:3000';

      res.json({
        roomId,
        joinToken,
        joinUrl: `${baseUrl}/join/${roomId}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    } catch (err) {
      console.error('[Rooms] GET /:roomId/fresh-token error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
