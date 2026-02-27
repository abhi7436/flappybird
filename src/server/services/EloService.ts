// ============================================================
// EloService — Elo rating calculation and persistence.
//
// Uses the standard formula with K-factor scaling:
//   K = 40 for first 10 games, 20 thereafter, 10 for elo > 2400.
// In multiplayer, each player is compared against the room average
// so every game produces a single meaningful delta.
// ============================================================

import { db } from '../database/connection';
import { EloChangeResult } from '../types';

interface PlayerResult {
  userId:   string;
  score:    number;
  rank:     number;
  total:    number;    // total players in game
}

const K_PROVISIONAL  = 40;  // first 10 games
const K_STANDARD     = 20;
const K_MASTER       = 10;  // elo > 2400
const BASE_ELO       = 1000;

/** Return the K-factor based on games played and current rating. */
function kFactor(gamesPlayed: number, elo: number): number {
  if (gamesPlayed < 10)  return K_PROVISIONAL;
  if (elo > 2400)        return K_MASTER;
  return K_STANDARD;
}

/**
 * Expected score formula: Ea = 1 / (1 + 10^((Rb - Ra) / 400))
 * For multiplayer we compare each player against the field average.
 */
function expectedScore(playerElo: number, fieldAverageElo: number): number {
  return 1 / (1 + Math.pow(10, (fieldAverageElo - playerElo) / 400));
}

/**
 * Convert rank (1-based) to a normalised actual score in [0, 1].
 * Rank 1 = 1.0, last rank = 0.0, linear interpolation between.
 */
function actualScore(rank: number, total: number): number {
  if (total <= 1) return 1;
  return (total - rank) / (total - 1);
}

export class EloService {
  /**
   * Calculate and persist ELO changes for all players in a finished room.
   * Returns a list of deltas (useful for WebSocket game_over broadcast).
   */
  static async processGameResults(results: PlayerResult[]): Promise<EloChangeResult[]> {
    if (results.length === 0) return [];

    // Fetch current ratings in one query
    const userIds = results.map((r) => r.userId);
    const rows = await db.any<{ id: string; elo_rating: number; games_played: number }>(
      'SELECT id, elo_rating, games_played FROM users WHERE id = ANY($1)',
      [userIds]
    );

    const ratingMap = new Map<string, { elo: number; games: number }>();
    for (const row of rows) {
      ratingMap.set(row.id, { elo: row.elo_rating, games: row.games_played });
    }

    const fieldAvgElo =
      [...ratingMap.values()].reduce((s, r) => s + r.elo, 0) / ratingMap.size;

    const changes: EloChangeResult[] = [];

    for (const result of results) {
      const current = ratingMap.get(result.userId);
      if (!current) continue;

      const k    = kFactor(current.games, current.elo);
      const Ea   = expectedScore(current.elo, fieldAvgElo);
      const Sa   = actualScore(result.rank, result.total);
      const delta = Math.round(k * (Sa - Ea));
      const newElo = Math.max(BASE_ELO - 200, current.elo + delta); // hard floor at 800

      changes.push({ userId: result.userId, oldElo: current.elo, newElo, delta });
    }

    // Bulk-update in a transaction
    await db.tx(async (t) => {
      for (const c of changes) {
        await t.none(
          `UPDATE users
             SET elo_rating   = $1,
                 games_played = games_played + 1,
                 updated_at   = NOW()
           WHERE id = $2`,
          [c.newElo, c.userId]
        );
      }
    });

    return changes;
  }

  /** Fetch the current ELO leaderboard (top N). */
  static async getEloLeaderboard(limit = 100): Promise<
    Array<{ userId: string; username: string; avatar: string | null; elo: number; rank: number }>
  > {
    return db.any(
      `SELECT id AS "userId", username, avatar,
              elo_rating AS elo,
              RANK() OVER (ORDER BY elo_rating DESC) AS rank
         FROM users
        ORDER BY elo_rating DESC
        LIMIT $1`,
      [limit]
    );
  }
}
