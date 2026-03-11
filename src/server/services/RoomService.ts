import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { redisClient } from '../database/redisClient';
import { RoomMeta, RoomStatus, CreateRoomResult, RoomJoinPayload } from '../types';
import { LeaderboardService } from './LeaderboardService';

// ── Constants ─────────────────────────────────────────────────
const INACTIVITY_TIMEOUT_MS  = 5 * 60 * 1000;   // 5 minutes
const INACTIVITY_CHECK_MS    = 30 * 1000;         // check every 30 s
const JOIN_TOKEN_EXPIRES_IN  = '24h';
const ROOM_META_TTL_SECONDS  = 6 * 60 * 60;       // 6 h (hard cap)
const CLOSE_GRACE_MS         = 30 * 1000;          // 30 s grace after all-dead

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

// ── Redis key helper ──────────────────────────────────────────
const metaKey = (roomId: string) => `room:${roomId}:meta`;

export class RoomService {
  // ── Room creation ────────────────────────────────────────

  /**
   * Generate a cryptographically secure, URL-safe room ID.
   * 8 random bytes → 11-char base64url string (no padding).
   */
  static generateRoomId(): string {
    return crypto.randomBytes(8).toString('base64url');
  }

  /**
   * Generate a signed JWT that acts as the room join credential.
   * Anyone holding this token can join the room until it expires.
   */
  static generateJoinToken(roomId: string): string {
    const payload: Omit<RoomJoinPayload, 'iat' | 'exp'> = {
      roomId,
      type: 'room_join',
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JOIN_TOKEN_EXPIRES_IN });
  }

  /**
   * Verify a room join token. Returns the payload or throws.
   */
  static verifyJoinToken(token: string): RoomJoinPayload {
    return jwt.verify(token, JWT_SECRET) as RoomJoinPayload;
  }

  /**
   * Create a room in Redis and return the join URL + token.
   */
  static async createRoom(
    createdBy: string,
    baseUrl: string
  ): Promise<CreateRoomResult> {
    const roomId    = RoomService.generateRoomId();
    const joinToken = RoomService.generateJoinToken(roomId);
    const now       = Date.now();

    const meta: Record<string, string> = {
      status:         'waiting',
      createdBy,
      createdAt:      String(now),
      lastActivityAt: String(now),
      playerCount:    '0',
      sessionActive:  'true',   // persistent until host calls close_session
    };

    await redisClient.hSet(metaKey(roomId), meta);
    await redisClient.expire(metaKey(roomId), ROOM_META_TTL_SECONDS);

    // Token expiry is 24 h — derive Date for response
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000);

    return {
      roomId,
      joinToken,
      joinUrl: `${baseUrl}/join/${roomId}`,
      expiresAt,
    };
  }

  // ── Room state queries ───────────────────────────────────

  static async getMeta(roomId: string): Promise<RoomMeta | null> {
    const raw = await redisClient.hGetAll(metaKey(roomId));
    if (!raw.status) return null;

    return {
      roomId,
      status:           raw.status as RoomStatus,
      createdBy:        raw.createdBy,
      createdAt:        Number(raw.createdAt),
      lastActivityAt:   Number(raw.lastActivityAt),
      playerCount:      Number(raw.playerCount),
      spectatorCount:   Number(raw.spectatorCount ?? 0),
      tournamentMatchId: raw.tournamentMatchId ?? undefined,
      // Default to true for rooms created before this field existed
      sessionActive:    raw.sessionActive !== 'false',
      // Timer config (optional)
      timerConfig: raw.timerEnabled === 'true'
        ? {
            enabled:         true,
            durationSeconds: Number(raw.timerDuration ?? 60),
            startTime:       raw.timerStartTime ? Number(raw.timerStartTime) : null,
          }
        : undefined,
    };
  }

  static async isOpen(roomId: string): Promise<boolean> {
    const status = await redisClient.hGet(metaKey(roomId), 'status');
    return status === 'waiting' || status === 'active';
  }

  static async getStatus(roomId: string): Promise<RoomStatus | null> {
    const status = await redisClient.hGet(metaKey(roomId), 'status');
    return (status as RoomStatus) ?? null;
  }

  // ── Room state mutations ─────────────────────────────────

  static async setStatus(roomId: string, status: RoomStatus): Promise<void> {
    await redisClient.hSet(metaKey(roomId), 'status', status);
    await redisClient.expire(metaKey(roomId), ROOM_META_TTL_SECONDS);
  }

  /** Reassign the room's host (stored as createdBy in Redis meta). */
  static async setHost(roomId: string, newHostUserId: string): Promise<void> {
    const key = metaKey(roomId);
    const exists = await redisClient.exists(key);
    if (!exists) return;
    await redisClient.hSet(key, 'createdBy', newHostUserId);
  }

  /**
   * Flip the sessionActive flag.
   * Set false before calling closeRoom so the inactivity watcher also stops
   * keeping the room alive.
   */
  static async setSessionActive(roomId: string, active: boolean): Promise<void> {
    const key = metaKey(roomId);
    const exists = await redisClient.exists(key);
    if (!exists) return;
    await redisClient.hSet(key, 'sessionActive', active ? 'true' : 'false');
  }

  /** Refresh the inactivity clock. Call on any player action. */
  static async touchActivity(roomId: string): Promise<void> {
    const key = metaKey(roomId);
    const exists = await redisClient.exists(key);
    if (!exists) return;
    await redisClient.hSet(key, 'lastActivityAt', String(Date.now()));
  }

  /** Store the timer start time in Redis meta (for timer mode). */
  static async setTimerStartTime(roomId: string, startTime: number): Promise<void> {
    const key = metaKey(roomId);
    const exists = await redisClient.exists(key);
    if (!exists) return;
    await redisClient.hSet(key, 'timerStartTime', String(startTime));
  }

  /** Store timer config on room meta when host starts a timed game. */
  static async setTimerConfig(
    roomId: string,
    enabled: boolean,
    durationSeconds: number
  ): Promise<void> {
    const key = metaKey(roomId);
    const exists = await redisClient.exists(key);
    if (!exists) return;
    await redisClient.hSet(key, {
      timerEnabled:  enabled ? 'true' : 'false',
      timerDuration: String(durationSeconds),
    });
  }

  static async incrementPlayerCount(roomId: string, delta: 1 | -1): Promise<void> {
    await redisClient.hIncrBy(metaKey(roomId), 'playerCount', delta);
  }

  /**
   * Close a room: set status → 'closed', emit event, clean up Redis.
   * Grace-period is applied when all players are dead (shows leaderboard).
   */
  static async closeRoom(
    roomId: string,
    reason: 'inactivity' | 'all_dead' | 'manual',
    io?: Server,
    delayMs = 0
  ): Promise<void> {
    const close = async () => {
      await RoomService.setStatus(roomId, 'closed');
      await LeaderboardService.clearRoom(roomId);

      if (io) {
        io.to(roomId).emit('room_closed', { roomId, reason });
        // Disconnect all sockets in the room
        const sockets = await io.in(roomId).fetchSockets();
        for (const s of sockets) s.disconnect(true);
      }

      console.log(`[RoomService] Room ${roomId} closed — reason: ${reason}`);
    };

    if (delayMs > 0) {
      setTimeout(close, delayMs);
    } else {
      await close();
    }
  }

  // ── Inactivity watcher (runs on server startup) ──────────

  /**
   * Starts a background interval that closes rooms idle for 5+ minutes.
   * Safe to run on multiple instances — Redis is the source of truth.
   */
  static startInactivityWatcher(io: Server): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        const keys = await redisClient.keys('room:*:meta');

        for (const key of keys) {
          const raw = await redisClient.hGetAll(key);
          if (!raw.status || raw.status === 'closed') continue;

          // Persistent sessions are managed by the host, not the timer.
          if (raw.sessionActive !== 'false') continue;

          const idleMs = Date.now() - Number(raw.lastActivityAt);
          if (idleMs >= INACTIVITY_TIMEOUT_MS) {
            const roomId = key.replace('room:', '').replace(':meta', '');
            console.log(`[RoomService] Closing idle room ${roomId} (idle ${Math.round(idleMs / 1000)}s)`);
            await RoomService.closeRoom(roomId, 'inactivity', io);
          }
        }
      } catch (err) {
        console.error('[RoomService] Inactivity watcher error', err);
      }
    }, INACTIVITY_CHECK_MS);
  }

  /**
   * Check if all players in a room are dead.
   *
   * • Persistent session (sessionActive = true): emit 'round_ended', then
   *   reset status to 'waiting' after the grace period so players can
   *   start a new round without rejoining.
   *
   * • Non-persistent session: close the room with a grace period (legacy
   *   behaviour — shows final leaderboard before disconnecting everyone).
   */
  static async maybeCloseAllDead(
    roomId: string,
    io: Server,
    playerCount: number,
    deadCount: number,
    /** Optional hook: called just before status resets to 'waiting' on a
     *  persistent-session round end (use it to reset in-memory player state). */
    onRoundReset?: () => void
  ): Promise<void> {
    if (playerCount <= 0 || deadCount < playerCount) return;

    const meta = await RoomService.getMeta(roomId);
    if (!meta) return;

    if (meta.sessionActive) {
      // Persistent session: reset for next round instead of closing.
      console.log(`[RoomService] All players dead in ${roomId} — session active, resetting immediately`);
      io.to(roomId).emit('round_ended', { roomId, reason: 'all_dead' });
      // Immediately reset room to 'waiting' so host can start a new round
      // as soon as they dismiss the FinalRanking overlay.
      onRoundReset?.();
      await RoomService.setStatus(roomId, 'waiting');
      // Emit round_reset after a short delay — gives FinalRanking time to display
      // before auto-navigating remaining clients back to lobby.
      setTimeout(() => {
        io.to(roomId).emit('round_reset', { roomId });
        console.log(`[RoomService] Room ${roomId} reset to waiting for next round`);
      }, 8_000);
      return;
    }

    // Non-persistent: close with grace period (legacy behaviour).
    console.log(`[RoomService] All players dead in ${roomId} — closing in ${CLOSE_GRACE_MS / 1000}s`);
    await RoomService.setStatus(roomId, 'closed'); // block new joins immediately
    await RoomService.closeRoom(roomId, 'all_dead', io, CLOSE_GRACE_MS);
  }
}
