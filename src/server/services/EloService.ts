import { Types } from 'mongoose';
import { UserModel } from '../database/models';
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

function expectedScore(playerElo: number, fieldAverageElo: number): number {
  return 1 / (1 + Math.pow(10, (fieldAverageElo - playerElo) / 400));
}

function actualScore(rank: number, total: number): number {
  if (total <= 1) return 1;
  return (total - rank) / (total - 1);
}

export class EloService {
  static async processGameResults(results: PlayerResult[]): Promise<EloChangeResult[]> {
    if (results.length === 0) return [];

    const userObjectIds = results.map((r) => new Types.ObjectId(r.userId));
    const users = await UserModel.find({ _id: { $in: userObjectIds } })
      .select('id elo_rating games_played');

    const ratingMap = new Map<string, { elo: number; games: number }>();
    for (const u of users) {
      const j = u.toJSON() as Record<string, unknown>;
      ratingMap.set(String(j['id']), {
        elo:   j['elo_rating'] as number,
        games: j['games_played'] as number,
      });
    }

    const fieldAvgElo =
      [...ratingMap.values()].reduce((s, r) => s + r.elo, 0) / ratingMap.size;

    const changes: EloChangeResult[] = [];

    for (const result of results) {
      const current = ratingMap.get(result.userId);
      if (!current) continue;

      const k     = kFactor(current.games, current.elo);
      const Ea    = expectedScore(current.elo, fieldAvgElo);
      const Sa    = actualScore(result.rank, result.total);
      const delta = Math.round(k * (Sa - Ea));
      const newElo = Math.max(BASE_ELO - 200, current.elo + delta); // hard floor at 800

      changes.push({ userId: result.userId, oldElo: current.elo, newElo, delta });
    }

    // Bulk-update
    await Promise.all(
      changes.map((c) =>
        UserModel.updateOne(
          { _id: new Types.ObjectId(c.userId) },
          {
            $set: { elo_rating: c.newElo, updated_at: new Date() },
            $inc: { games_played: 1 },
          }
        )
      )
    );

    return changes;
  }

  static async getEloLeaderboard(limit = 100): Promise<
    Array<{ userId: string; username: string; avatar: string | null; elo: number; rank: number }>
  > {
    const users = await UserModel.find()
      .sort({ elo_rating: -1 })
      .limit(limit)
      .select('id username avatar elo_rating');

    return users.map((u, idx) => {
      const j = u.toJSON() as Record<string, unknown>;
      return {
        userId:   String(j['id']),
        username: j['username'] as string,
        avatar:   (j['avatar'] as string) ?? null,
        elo:      j['elo_rating'] as number,
        rank:     idx + 1,
      };
    });
  }
}

