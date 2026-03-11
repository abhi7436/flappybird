import { redisClient } from '../database/redisClient';
import { LeaderboardEntry, LeaderboardUpdate, RankMovement } from '../types';

const LEADERBOARD_TTL_SECONDS = 3600; // 1 hour

/** Redis key helpers */
const keys = {
  roomLeaderboard: (roomId: string) => `room:${roomId}:leaderboard`,
  playerMeta:      (roomId: string, userId: string) => `room:${roomId}:player:${userId}`,
};

export class LeaderboardService {
  /** Upsert a player's score in the Redis sorted set */
  static async updateScore(
    roomId:   string,
    userId:   string,
    username: string,
    score:    number,
    alive:    boolean
  ): Promise<void> {
    const lbKey   = keys.roomLeaderboard(roomId);
    const metaKey = keys.playerMeta(roomId, userId);

    await redisClient.zAdd(lbKey, { score, value: userId });
    await redisClient.expire(lbKey, LEADERBOARD_TTL_SECONDS);

    await redisClient.hSet(metaKey, {
      username,
      alive: alive ? '1' : '0',
      score: String(score),
    });
    await redisClient.expire(metaKey, LEADERBOARD_TTL_SECONDS);
  }

  /** Fetch sorted leaderboard (highest score first) with 1-based rank included */
  static async getLeaderboard(roomId: string): Promise<LeaderboardEntry[]> {
    const lbKey   = keys.roomLeaderboard(roomId);
    const members = await redisClient.zRangeWithScores(lbKey, 0, -1, { REV: true });

    const entries = await Promise.all(
      members.map(async ({ value: userId, score }, index) => {
        const metaKey = keys.playerMeta(roomId, userId);
        const meta    = await redisClient.hGetAll(metaKey);
        return {
          userId,
          username: meta.username ?? userId,
          score,
          alive:    meta.alive === '1',
          rank:     index + 1,         // ← 1-based
        } satisfies LeaderboardEntry;
      })
    );

    return entries;
  }

  /**
   * Compute what changed between two successive leaderboard snapshots.
   * Returns only entries whose rank or score changed.
   */
  static computeMovements(
    prev: LeaderboardEntry[],
    curr: LeaderboardEntry[]
  ): RankMovement[] {
    const prevMap = new Map(prev.map((e) => [e.userId, e]));
    const movements: RankMovement[] = [];

    for (const entry of curr) {
      const old = prevMap.get(entry.userId);
      if (!old) {
        // new player — treat as entering at rank Infinity
        movements.push({ userId: entry.userId, oldRank: 999, newRank: entry.rank, scoreDelta: entry.score });
        continue;
      }
      if (old.rank !== entry.rank || old.score !== entry.score) {
        movements.push({
          userId:     entry.userId,
          oldRank:    old.rank,
          newRank:    entry.rank,
          scoreDelta: entry.score - old.score,
        });
      }
    }

    return movements;
  }

  /** Remove a player from Redis leaderboard */
  static async removePlayer(roomId: string, userId: string): Promise<void> {
    const lbKey   = keys.roomLeaderboard(roomId);
    const metaKey = keys.playerMeta(roomId, userId);

    await redisClient.zRem(lbKey, userId);
    await redisClient.del(metaKey);
  }

  /** Wipe leaderboard data from Redis (preserves room meta). */
  static async clearRoom(roomId: string): Promise<void> {
    const keys_list = await redisClient.keys(`room:${roomId}:*`);
    if (keys_list.length === 0) return;
    // Keep the room meta key so the room survives between rounds
    const metaKey = `room:${roomId}:meta`;
    const toDelete = keys_list.filter((k) => k !== metaKey);
    if (toDelete.length > 0) {
      await redisClient.del(toDelete);
    }
  }

  /**
   * Publish a LeaderboardUpdate to all server instances via Redis Pub/Sub.
   * Enables horizontal scaling — other instances re-broadcast to their sockets.
   */
  static async publishLeaderboardUpdate(update: LeaderboardUpdate): Promise<void> {
    await redisClient.publish(
      `leaderboard:${update.roomId}`,
      JSON.stringify(update)
    );
  }
}
