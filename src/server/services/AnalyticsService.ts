import { getDb } from '../database/connection';
import { PlayerAnalytics } from '../types';

export class AnalyticsService {
  /** Full player analytics aggregate. */
  static async getPlayerAnalytics(userId: string): Promise<PlayerAnalytics | null> {
    const db = getDb();
    const user = await db.collection('users').findOne({ id: userId }, { projection: { id: 1, username: 1, elo_rating: 1, games_played: 1 } });
    if (!user) return null;

    // Aggregate stats
    const statsAgg = await db.collection('game_history').aggregate([
      { $match: { user_id: userId } },
      { $group: {
          _id: null,
          total_games: { $sum: 1 },
          avg_score: { $avg: '$score' },
          best_score: { $max: '$score' },
          avg_rank: { $avg: '$rank' },
          wins: { $sum: { $cond: [{ $eq: ['$rank', 1] }, 1, 0] } },
          avg_duration_ms: { $avg: '$duration_ms' },
        }
      }
    ]).toArray();
    const stats = statsAgg[0] ?? { total_games: 0, avg_score: 0, best_score: 0, avg_rank: 0, wins: 0, avg_duration_ms: 0 };

    const eloHistory = await db.collection('game_history').find({ user_id: userId, elo_after: { $ne: null } }).project({ created_at: 1, elo_after: 1 }).sort({ created_at: 1 }).limit(30).toArray();
    const scoreHistory = await db.collection('game_history').find({ user_id: userId }).project({ created_at: 1, score: 1 }).sort({ created_at: -1 }).limit(30).toArray();

    // Aggregate powerups by summing keys across docs
    const ph = await db.collection('game_history').find({ user_id: userId }).project({ powerups_collected: 1 }).toArray();
    const powerupsMap: Record<string, number> = {};
    for (const r of ph) {
      const p = r.powerups_collected ?? {};
      for (const k of Object.keys(p)) powerupsMap[k] = (powerupsMap[k] || 0) + Number(p[k] ?? 0);
    }

    return {
      userId,
      username: user.username,
      totalGames: Number(stats.total_games),
      avgScore: Math.round((Number(stats.avg_score) || 0) * 10) / 10,
      bestScore: Number(stats.best_score) || 0,
      avgRank: Math.round((Number(stats.avg_rank) || 0) * 10) / 10,
      winRate: Math.round(((Number(stats.wins) || 0) / (Number(stats.total_games) || 1)) * 1000) / 10,
      avgDurationMs: Math.round(Number(stats.avg_duration_ms) || 0),
      currentElo: user.elo_rating,
      eloHistory: (eloHistory as any).map((e: any) => ({ date: e.created_at.toISOString().slice(0,10), elo: e.elo_after })),
      scoreHistory: (scoreHistory as any).map((s: any) => ({ date: s.created_at.toISOString().slice(0,10), score: s.score })),
      powerupFrequency: powerupsMap,
    };
  }

  /** Global leaderboard with rank and ELO. */
  static async getGlobalLeaderboard(
    sortBy: 'high_score' | 'elo' = 'high_score',
    limit = 100
  ) {
    const col = sortBy === 'elo' ? 'elo_rating' : 'high_score';
    const db = getDb();
    const users = await db.collection('users').find().project({ id: 1, username: 1, avatar: 1, high_score: 1, elo_rating: 1, games_played: 1 }).sort({ [col]: -1 }).limit(limit).toArray();
    // Attach rank based on index
    return users.map((u: any, idx: number) => ({ userId: u.id, username: u.username, avatar: u.avatar, highScore: u.high_score, elo: u.elo_rating, gamesPlayed: u.games_played, rank: idx + 1 }));
  }

  /** Match history for a user with ELO deltas. */
  static async getMatchHistory(userId: string, limit = 20, offset = 0) {
    const db = getDb();
    return db.collection('game_history').find({ user_id: userId }).project({ id: 1, room_id: 1, score: 1, rank: 1, total_players: 1, duration_ms: 1, elo_before: 1, elo_after: 1, elo_change: 1, powerups_collected: 1, created_at: 1 }).sort({ created_at: -1 }).skip(offset).limit(limit).toArray();
  }
}
