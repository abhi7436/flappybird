import { Request, Response, NextFunction } from 'express';
import { RoomService } from '../services/RoomService';
import { verifyToken } from './authMiddleware';
import { config } from '../config/env';
import { RoomJoinPayload } from '../types';

/**
 * validateRoomOpen
 * ────────────────
 * Checks that a room exists in Redis and is not closed.
 * Attaches `req.roomId` for downstream handlers.
 * Expects `:roomId` route param.
 */
export async function validateRoomOpen(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const roomId =
    req.params.roomId ?? (req.body as { roomId?: string }).roomId;

  if (!roomId) {
    res.status(400).json({ error: 'roomId is required' });
    return;
  }

  try {
    const open = await RoomService.isOpen(roomId);
    if (!open) {
      res.status(410).json({ error: 'Room is closed or does not exist' });
      return;
    }
    (req as any).roomId = roomId;
    next();
  } catch (err) {
    console.error('[RoomMiddleware] validateRoomOpen error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * validateJoinToken
 * ─────────────────
 * Optional second layer: verifies the `?t=` query param join token.
 * If the token is present it MUST be valid and match the roomId.
 * If absent the request is still allowed (public room join by link).
 *
 * Use this on endpoints where you want token-gated joins in future.
 */
export function validateJoinToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token  = (req.query.t ?? req.body?.joinToken) as string | undefined;
  const roomId = req.params.roomId ?? (req.body as { roomId?: string }).roomId;

  // Token is optional — skip if not provided
  if (!token) {
    next();
    return;
  }

  try {
    const payload = RoomService.verifyJoinToken(token) as RoomJoinPayload;

    if (payload.type !== 'room_join') {
      res.status(401).json({ error: 'Invalid join token type' });
      return;
    }

    if (payload.roomId !== roomId) {
      res.status(401).json({ error: 'Join token does not match room' });
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired join token' });
  }
}

/**
 * requireRoomAuth
 * ───────────────
 * Combined: user must be authenticated AND room must be open.
 *
 * When ENABLE_AUTH=false the JWT check is skipped; only the room-open
 * check runs.  Set ENABLE_AUTH=true to restore full auth enforcement.
 */
export async function requireRoomAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // ── V1: auth disabled — skip token check, just verify room is open ───
  if (!config.ENABLE_AUTH) {
    await validateRoomOpen(req, res, next);
    return;
  }
  // ── Full auth ─────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    req.user = verifyToken(authHeader.slice(7));
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  await validateRoomOpen(req, res, next);
}
