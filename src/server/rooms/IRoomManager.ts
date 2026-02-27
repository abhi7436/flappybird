/**
 * IRoomManager — contract for all room-state backends.
 *
 * The socket layer depends ONLY on this interface.  The concrete
 * implementation is injected at startup, making the backend trivially
 * swappable without touching any handler code:
 *
 *   // today
 *   const rm: IRoomManager = new InMemoryRoomManager();
 *
 *   // tomorrow (horizontal scaling)
 *   const rm: IRoomManager = new RedisRoomManager(redisClient);
 *
 * ── Scaling roadmap (do NOT implement yet) ───────────────────────
 * 1. Replace `InMemoryRoomManager` with `RedisRoomManager`:
 *    - Store rooms in Redis hashes; use TTL for auto-expiry.
 *    - Use Redis Lua scripts for atomic score + leaderboard updates.
 * 2. Attach Socket.IO Redis adapter (`@socket.io/redis-adapter`):
 *    - Allows `io.to(roomId).emit()` to fan out across all Node.js
 *      replicas — already wired in WebSocketServer.ts.
 * 3. Deploy multiple backend instances behind a load balancer:
 *    - Sticky sessions (e.g. Nginx `ip_hash`) keep a player's WebSocket
 *      on the same replica while Redis keeps room state consistent.
 * 4. Add a managed Postgres DB (already in place) for persistence.
 * 5. Use a Pub/Sub channel per room for cross-instance leaderboard
 *    fanout — already partially implemented via LeaderboardService.
 */

import { PlayerState, LeaderboardEntry } from '../types';

// ── Runtime room snapshot ─────────────────────────────────────
/**
 * Lightweight view of a room's in-memory state.
 * Full room metadata (status, createdBy, etc.) lives in Redis
 * via `RoomService` and is NOT duplicated here.
 */
export interface RoomSnapshot {
  /** Unique room identifier (UUID). */
  id: string;
  /**
   * Live players indexed by socket ID.
   * Using a Map preserves O(1) lookup while keeping iteration cheap.
   */
  players: Map<string, PlayerState>;
  /** Unix timestamp (ms) when this snapshot was first created. */
  createdAt: number;
}

// ── Primary interface ──────────────────────────────────────────
export interface IRoomManager {
  // ── Room lifecycle ─────────────────────────────────────

  /**
   * Return the player map for `roomId`, creating an empty room if none exists.
   * Used internally; prefer the specialised helpers below for all external callers.
   */
  getOrCreateRoom(roomId: string): Map<string, PlayerState>;

  /** True when the room exists and has not yet reached capacity. */
  canJoin(roomId: string): boolean;

  /**
   * Add `player` to `roomId`.
   * Returns `false` (without mutating state) when the room is full.
   * Side-effects: increments the Redis player-count, marks room active.
   */
  addPlayer(roomId: string, player: PlayerState): boolean;

  /**
   * Remove `playerId` (socket ID) from `roomId`.
   * Auto-deletes the room entry when the last player leaves.
   * Side-effects: decrements the Redis player-count.
   */
  removePlayer(roomId: string, playerId: string): void;

  // ── Player state mutations ─────────────────────────────

  /**
   * Increment the player's score to `score`.
   * Returns the mutated `PlayerState`, or `null` when the player does not
   * exist or is already dead (dead players cannot score).
   */
  updateScore(roomId: string, playerId: string, score: number): PlayerState | null;

  /**
   * Mark the player as dead (`alive = false`).
   * Returns the mutated `PlayerState`, or `null` when the player is unknown.
   */
  markDead(roomId: string, playerId: string): PlayerState | null;

  /** Look up a single player by socket ID.  Returns `undefined` if not found. */
  getPlayer(roomId: string, playerId: string): PlayerState | undefined;

  /**
   * Return the raw player map for a room, or `undefined` if the room does
   * not exist.  Consumers MUST treat the map as read-only.
   */
  getRoom(roomId: string): Map<string, PlayerState> | undefined;

  /**
   * Find the socket ID currently registered for `userId` in `roomId`.
   * Used for reconnect / duplicate-join detection.
   */
  findSocketIdForUser(roomId: string, userId: string): string | undefined;

  /** Return the first `PlayerState` in the room, or `undefined` when empty. */
  getFirstPlayer(roomId: string): PlayerState | undefined;

  /**
   * Return `{ total, dead }` counts for the room.
   * Used to detect the "all players dead" condition that triggers end-of-round.
   */
  getDeadStats(roomId: string): { total: number; dead: number };

  // ── Leaderboard / persistence ──────────────────────────

  /**
   * Push the player's current state to the Redis sorted-set leaderboard.
   * Called after every score update and after a player dies.
   */
  syncToRedis(roomId: string, player: PlayerState): Promise<void>;

  /**
   * Fetch the full ordered leaderboard for `roomId` from Redis.
   * Returns an empty array when the room has no Redis state yet.
   */
  getLeaderboard(roomId: string): Promise<LeaderboardEntry[]>;

  /**
   * Remove ALL in-memory and Redis state for `roomId`.
   * Called when a room session ends (all dead, host closes, inactivity).
   */
  clearRoom(roomId: string): Promise<void>;
}
