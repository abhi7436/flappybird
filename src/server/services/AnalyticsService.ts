import { Types } from 'mongoose';
import { UserModel, GameHistoryModel } from '../database/models';
import { PlayerAnalytics } from '../types';

export class AnalyticsService {
  /** Full player analytics aggregate. */
  static async getPlayerAnalytics(userId: string): Promise<PlayerAnalytics | null> {
    let uid: Types.ObjectId;
    try { uid = new Types.ObjectId(userId); } catch { return null; }

    const userDoc = await UserModel.findById(uid).select('id username elo_rating games_played');
    if (!userDoc) return null;
    const uj = userDoc.toJSON() as Record<string, unknown>;

    // ── Aggregate stats ──────────────────────────────────────
    const [statsAgg, historyDocs, scoreHistDocs] = await Promise.all([
      GameHistoryModel.aggregate([
        { $match: { user_id: uid } },
        {
          $group: {
            _id:           null,
            total_games:   { $sum: 1 },
            avg_score:     { $avg: '$score' },
            best_score:    { $max: '$score' },
            avg_rank:      { $avg: '$rank' },
            win_count:     { $sum: { $cond: [{ $eq: ['$rank', 1] }, 1, 0] } },
            avg_duration:  { $avg: '$duration_ms' },
          },
        },
      ]),
      // ELO history (last 30 entries with elo_after)
      GameHistoryModel.find({ user_id: uid, elo_after: { $ne: null } })
        .sort({ created_at: 1 })
        .limit(30)
        .select('created_at elo_after'),
      // Score history (last 30)
      GameHistoryModel.find({ user_id: uid })
        .sort({ created_at: -1 })
        .limit(30)
        .select('created_at score'),
    ]);

    const stats = statsAgg[0] ?? {
      total_games: 0, avg_score: 0, best_score: 0,
      avg_rank: 0, win_count: 0, avg_duration: 0,
    };
    const totalGames = stats.total_games as number;

    // ── Power-up frequency ────────────────────────────────────
    const powerupAgg = await GameHistoryModel.aggregate([
      { $match: { user_id: uid } },
      { $project: { powerups_collected: 1 } },
      {
        $group: {
          _id: null,
          allPowerups: { $push: '$powerups_collected' },
        },
      },
    ]);
    const powerupFrequency: Record<string, number> = {};
    if (powerupAgg[0]) {
      for (const map of (powerupAgg[0].allPowerups as Record<string, number>[])) {
        if (!map) continue;
        for (const [k, v] of Object.entries(map)) {
          powerupFrequency[k] = (powerupFrequency[k] ?? 0) + (v ?? 0);
        }
      }
    }

    const eloHistory = historyDocs.map((d) => {
      const j = d.toJSON() as Record<string, unknown>;
      return {
        date: (j['created_at'] as Date).toISOString().slice(0, 10),
        elo:  j['elo_after'] as number,
      };
    });

    const scoreHistory = scoreHistDocs.map((d) => {
      const j = d.toJSON() as Record<string, unknown>;
      return {
        date:  (j['created_at'] as Date).toISOString().slice(0, 10),
        score: j['score'] as number,
      };
    });

    return {
      userId,
      username:        uj['username'] as string,
      totalGames,
      avgScore:        Math.round(((stats.avg_score as number) ?? 0) * 10) / 10,
      bestScore:       (stats.best_score as number) ?? 0,
      avgRank:         Math.round(((stats.avg_rank as number) ?? 0) * 10) / 10,
      winRate:         totalGames > 0
        ? Math.round(((stats.win_count as number) / totalGames) * 1000) / 10
        : 0,
      avgDurationMs:   Math.round((stats.avg_duration as number) ?? 0),
      currentElo:      uj['elo_rating'] as number,
      eloHistory:      eloHistory.reverse(),
      scoreHistory,
      powerupFrequency,
    };
  }

  /** Global leaderboard with rank and ELO. */
  static async getGlobalLeaderboard(
    sortBy: 'high_score' | 'elo' = 'high_score',
    limit = 100
  ) {
    const sortField = sortBy === 'elo' ? 'elo_rating' : 'high_score';
    const users = await UserModel.find()
      .sort({ [sortField]: -1 })
      .limit(limit)
      .select('id username avatar high_score elo_rating games_played');

    return users.map((u, idx) => {
      const j = u.toJSON() as Record<string, unknown>;
      return {
        userId:      String(j['id']),
        username:    j['username'] as string,
        avatar:      (j['avatar'] as string) ?? null,
        highScore:   j['high_score'] as number,
        elo:         j['elo_rating'] as number,
        gamesPlayed: j['games_played'] as number,
        rank:        idx + 1,
      };
    });
  }

  /** Match history for a user with ELO deltas. */
  static async getMatchHistory(userId: string, limit = 20, offset = 0) {
    let uid: Types.ObjectId;
    try { uid = new Types.ObjectId(userId); } catch { return []; }

    const docs = await GameHistoryModel.find({ user_id: uid })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit);

    return docs.map((d) => {
      const j = d.toJSON() as Record<string, unknown>;
      return {
        id:                String(j['id']),
        roomId:            j['room_id'],
        score:             j['score'],
        rank:              j['rank'],
        totalPlayers:      j['total_players'],
        durationMs:        j['duration_ms'],
        eloBefore:         j['elo_before'],
        eloAfter:          j['elo_after'],
        eloChange:         j['elo_change'],
        powerupsCollected: j['powerups_collected'],
        createdAt:         j['created_at'],
      };
    });
  }
}

