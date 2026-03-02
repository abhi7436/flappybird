import { PlayerState, LeaderboardEntry } from './types';
import { LeaderboardService } from './services/LeaderboardService';
import { RoomService } from './services/RoomService';

const MAX_PLAYERS_PER_ROOM = 50;

export class RoomManager {
  /** In-memory map of roomId → players (fast lookups, per-instance) */
  private rooms: Map<string, Map<string, PlayerState>>;

  constructor() {
    this.rooms = new Map();
  }

  // ── Room lifecycle ────────────────────────────────────────

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
    RoomService.incrementPlayerCount(roomId, 1).catch(() => {});
    // NOTE: do NOT call setStatus here — status transitions are managed
    // exclusively by the start_game handler (waiting → active) and room
    // close logic. Setting active on every join broke multi-player joining.
    return true;
  }

  removePlayer(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(playerId);
      RoomService.incrementPlayerCount(roomId, -1).catch(() => {});
      if (room.size === 0) this.rooms.delete(roomId);
    }
  }

  // ── Player state mutations ───────────────────────────────

  updateScore(roomId: string, playerId: string, score: number): PlayerState | null {
    const player = this.rooms.get(roomId)?.get(playerId);
    if (!player || !player.alive) return null;
    player.score = score;
    player.lastScoreAt = Date.now();
    RoomService.touchActivity(roomId).catch(() => {});
    return player;
  }

  markDead(roomId: string, playerId: string): PlayerState | null {
    const player = this.rooms.get(roomId)?.get(playerId);
    if (!player) return null;
    player.alive = false;
    RoomService.touchActivity(roomId).catch(() => {});
    return player;
  }

  getPlayer(roomId: string, playerId: string): PlayerState | undefined {
    return this.rooms.get(roomId)?.get(playerId);
  }

  getRoom(roomId: string): Map<string, PlayerState> | undefined {
    return this.rooms.get(roomId);
  }

  /** Return the socket ID currently registered for a given userId, or undefined. */
  findSocketIdForUser(roomId: string, userId: string): string | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    for (const [socketId, player] of room) {
      if (player.userId === userId) return socketId;
    }
    return undefined;
  }

  /** Return the first PlayerState in the room, or undefined if empty. */
  getFirstPlayer(roomId: string): PlayerState | undefined {
    const room = this.rooms.get(roomId);
    if (!room || room.size === 0) return undefined;
    return room.values().next().value;
  }

  /** Count total and dead players in a room (for all-dead detection). */
  getDeadStats(roomId: string): { total: number; dead: number } {
    const room = this.rooms.get(roomId);
    if (!room) return { total: 0, dead: 0 };
    let dead = 0;
    for (const p of room.values()) {
      if (!p.alive) dead++;
    }
    return { total: room.size, dead };
  }

  // ── Leaderboard (delegates to Redis) ────────────────────

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