import { db } from '../database/connection';
import { PlayerAnalytics } from '../types';

export class AnalyticsService {
  /** Full player analytics aggregate. */
  static async getPlayerAnalytics(userId: string): Promise<PlayerAnalytics | null> {
    const user = await db.oneOrNone<{
      id: string; username: string; elo_rating: number; games_played: number;
    }>(
      'SELECT id, username, elo_rating, games_played FROM users WHERE id = $1',
      [userId]
    );
    if (!user) return null;

    const [stats, eloHistory, scoreHistory, powerups] = await Promise.all([
      // Aggregate stats
      db.one<{
        total_games: string; avg_score: string; best_score: string;
        avg_rank: string; win_rate: string; avg_duration_ms: string;
      }>(
        `SELECT
            COUNT(*)                                  AS total_games,
            COALESCE(AVG(score), 0)                   AS avg_score,
            COALESCE(MAX(score), 0)                   AS best_score,
            COALESCE(AVG(rank), 0)                    AS avg_rank,
            COALESCE(
              SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END)::FLOAT
              / NULLIF(COUNT(*), 0), 0
            )                                         AS win_rate,
            COALESCE(AVG(duration_ms), 0)             AS avg_duration_ms
           FROM game_history
          WHERE user_id = $1`,
        [userId]
      ),

      // ELO over time (last 30 entries)
      db.any<{ date: string; elo: number }>(
        `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
                elo_after AS elo
           FROM game_history
          WHERE user_id = $1 AND elo_after IS NOT NULL
          ORDER BY created_at
          LIMIT 30`,
        [userId]
      ),

      // Score per game (last 30)
      db.any<{ date: string; score: number }>(
        `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS date, score
           FROM game_history
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 30`,
        [userId]
      ),

      // Power-up frequency aggregation
      db.one<{ powerups_collected: Record<string, number> | null }>(
        `SELECT
            jsonb_object_agg(key, total) AS powerups_collected
           FROM (
             SELECT key, SUM(value::int) AS total
               FROM game_history,
                    jsonb_each_text(COALESCE(powerups_collected, '{}'))
              WHERE user_id = $1
              GROUP BY key
           ) sub`,
        [userId]
      ).catch(() => ({ powerups_collected: null })),
    ]);

    return {
      userId,
      username:         user.username,
      totalGames:       parseInt(stats.total_games),
      avgScore:         Math.round(parseFloat(stats.avg_score) * 10) / 10,
      bestScore:        parseInt(stats.best_score),
      avgRank:          Math.round(parseFloat(stats.avg_rank) * 10) / 10,
      winRate:          Math.round(parseFloat(stats.win_rate) * 1000) / 10,
      avgDurationMs:    Math.round(parseFloat(stats.avg_duration_ms)),
      currentElo:       user.elo_rating,
      eloHistory:       eloHistory.reverse(),
      scoreHistory,
      powerupFrequency: powerups.powerups_collected ?? {},
    };
  }

  /** Global leaderboard with rank and ELO. */
  static async getGlobalLeaderboard(
    sortBy: 'high_score' | 'elo' = 'high_score',
    limit = 100
  ) {
    const col = sortBy === 'elo' ? 'elo_rating' : 'high_score';
    return db.any(
      `SELECT id AS "userId", username, avatar, high_score AS "highScore",
              elo_rating AS elo, games_played AS "gamesPlayed",
              RANK() OVER (ORDER BY ${col} DESC) AS rank
         FROM users
        ORDER BY ${col} DESC
        LIMIT $1`,
      [limit]
    );
  }

  /** Match history for a user with ELO deltas. */
  static async getMatchHistory(userId: string, limit = 20, offset = 0) {
    return db.any(
      `SELECT gh.id, gh.room_id AS "roomId", gh.score, gh.rank,
              gh.total_players AS "totalPlayers",
              gh.duration_ms AS "durationMs",
              gh.elo_before AS "eloBefore", gh.elo_after AS "eloAfter",
              gh.elo_change AS "eloChange",
              gh.powerups_collected AS "powerupsCollected",
              gh.created_at AS "createdAt"
         FROM game_history gh
        WHERE gh.user_id = $1
        ORDER BY gh.created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
  }
}
