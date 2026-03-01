import { getDb } from '../database/connection';
import { GameHistoryRecord } from '../types';

export class GameHistoryRepository {
  static async save(
    userId: string,
    roomId: string,
    score: number,
    rank: number | null
  ): Promise<GameHistoryRecord> {
    const db = getDb();
    const now = new Date();
    const doc = {
      user_id: userId,
      room_id: roomId,
      score,
      rank,
      duration_ms: null,
      elo_before: null,
      elo_after: null,
      elo_change: null,
      powerups_collected: {},
      total_players: null,
      tournament_match_id: null,
      created_at: now,
    } as any;
    const res = await db.collection('game_history').insertOne(doc);
    doc.id = res.insertedId.toHexString();
    return doc as GameHistoryRecord;
  }

  static async listByUser(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<GameHistoryRecord[]> {
    const db = getDb();
    return db.collection('game_history')
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray() as Promise<GameHistoryRecord[]>;
  }

  static async topScores(limit = 10): Promise<GameHistoryRecord[]> {
    const db = getDb();
    return db.collection('game_history')
      .find()
      .sort({ score: -1 })
      .limit(limit)
      .toArray() as Promise<GameHistoryRecord[]>;
  }

  static async bestByUser(userId: string): Promise<GameHistoryRecord | null> {
    const db = getDb();
    const doc = await db.collection('game_history')
      .find({ user_id: userId })
      .sort({ score: -1 })
      .limit(1)
      .next();
    return (doc as unknown as GameHistoryRecord) ?? null;
  }
}
