/**
 * InMemoryRoomManager — IRoomManager backed by a plain JS Map.
 *
 * This is the default implementation used for single-instance deployments
 * and local development.  It is the ONLY place that holds mutable room
 * state; no global variables or module-level caches are used outside
 * this class.
 *
 * ── Swap guide ───────────────────────────────────────────────────
 * To scale to multiple Node.js replicas, replace this with
 * `RedisRoomManager` in `server/index.ts`.  No socket handler code
 * needs to change — it depends only on `IRoomManager`.
 *
 *   // Single-instance (default)
 *   const roomManager: IRoomManager = new InMemoryRoomManager();
 *
 *   // Multi-instance (Redis-backed)
 *   const roomManager: IRoomManager = new RedisRoomManager(redisClient);
 */

import { IRoomManager } from './IRoomManager';
import { PlayerState, LeaderboardEntry } from '../types';
import { LeaderboardService } from '../services/LeaderboardService';
import { RoomService } from '../services/RoomService';

/** Maximum simultaneous players per room. */
const MAX_PLAYERS_PER_ROOM = 50;

export class InMemoryRoomManager implements IRoomManager {
  /**
   * Primary store: roomId → (socketId → PlayerState).
   *
   * A nested Map gives O(1) lookup for both room and player without
   * any external dependency.  All mutations are serialised by Node's
   * single-threaded event loop — no locking required.
   *
   * IMPORTANT: This Map is the ONLY place room state should ever live
   * within this class.  Do NOT introduce module-level variables.
   */
  private readonly rooms: Map<string, Map<string, PlayerState>>;

  constructor() {
    this.rooms = new Map();
  }

  // ── Room lifecycle ──────────────────────────────────────────

  getOrCreateRoom(roomId: string): Map<string, PlayerState> {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }
    return this.rooms.get(roomId)!;
  }

  canJoin(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    return !room || room.size < MAX_PLAYERS_PER_ROOM;
  }

  addPlayer(roomId: string, player: PlayerState): boolean {
    if (!this.canJoin(roomId)) return false;
    const room = this.getOrCreateRoom(roomId);
    room.set(player.id, player);
    // Fire-and-forget Redis side-effects — failures are logged but must
    // never crash the in-memory state update.
    RoomService.incrementPlayerCount(roomId, 1).catch((err: unknown) => {
      console.error('[RoomManager] incrementPlayerCount failed', err);
    });
    RoomService.setStatus(roomId, 'active').catch((err: unknown) => {
      console.error('[RoomManager] setStatus failed', err);
    });
    return true;
  }

  removePlayer(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.delete(playerId);
    RoomService.incrementPlayerCount(roomId, -1).catch((err: unknown) => {
      console.error('[RoomManager] decrementPlayerCount failed', err);
    });
    // Auto-cleanup: remove the room entry when it becomes empty so
    // we don't accumulate stale keys over time.
    if (room.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  // ── Player state mutations ──────────────────────────────────

  updateScore(roomId: string, playerId: string, score: number): PlayerState | null {
    const player = this.rooms.get(roomId)?.get(playerId);
    if (!player || !player.alive) return null;
    player.score = score;
    player.lastScoreAt = Date.now();
    RoomService.touchActivity(roomId).catch((err: unknown) => {
      console.error('[RoomManager] touchActivity failed', err);
    });
    return player;
  }

  markDead(roomId: string, playerId: string): PlayerState | null {
    const player = this.rooms.get(roomId)?.get(playerId);
    if (!player) return null;
    player.alive = false;
    RoomService.touchActivity(roomId).catch((err: unknown) => {
      console.error('[RoomManager] touchActivity failed', err);
    });
    return player;
  }

  getPlayer(roomId: string, playerId: string): PlayerState | undefined {
    return this.rooms.get(roomId)?.get(playerId);
  }

  getRoom(roomId: string): Map<string, PlayerState> | undefined {
    return this.rooms.get(roomId);
  }

  findSocketIdForUser(roomId: string, userId: string): string | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    for (const [socketId, player] of room) {
      if (player.userId === userId) return socketId;
    }
    return undefined;
  }

  getFirstPlayer(roomId: string): PlayerState | undefined {
    const room = this.rooms.get(roomId);
    if (!room || room.size === 0) return undefined;
    return room.values().next().value;
  }

  getDeadStats(roomId: string): { total: number; dead: number } {
    const room = this.rooms.get(roomId);
    if (!room) return { total: 0, dead: 0 };
    let dead = 0;
    for (const p of room.values()) {
      if (!p.alive) dead++;
    }
    return { total: room.size, dead };
  }

  // ── Leaderboard / persistence ───────────────────────────────

  async syncToRedis(roomId: string, player: PlayerState): Promise<void> {
    await LeaderboardService.updateScore(
      roomId,
      player.userId,
      player.username,
      player.score,
      player.alive
    );
  }

  async getLeaderboard(roomId: string): Promise<LeaderboardEntry[]> {
    return LeaderboardService.getLeaderboard(roomId);
  }

  async clearRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    await LeaderboardService.clearRoom(roomId);
  }
}
