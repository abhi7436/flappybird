import { Types } from 'mongoose';
import { GameHistoryModel } from '../database/models';
import { GameHistoryRecord } from '../types';

function toRecord(doc: ReturnType<typeof GameHistoryModel.prototype.toJSON>): GameHistoryRecord {
  const r = doc as Record<string, unknown>;
  return {
    id:                   String(r['id']),
    user_id:              String(r['user_id']),
    room_id:              r['room_id'] as string,
    score:                r['score'] as number,
    rank:                 (r['rank'] as number) ?? null,
    duration_ms:          (r['duration_ms'] as number) ?? null,
    elo_before:           (r['elo_before'] as number) ?? null,
    elo_after:            (r['elo_after'] as number) ?? null,
    elo_change:           (r['elo_change'] as number) ?? null,
    powerups_collected:   (r['powerups_collected'] as Record<string, number>) ?? {},
    total_players:        (r['total_players'] as number) ?? null,
    tournament_match_id:  r['tournament_match_id'] ? String(r['tournament_match_id']) : null,
    created_at:           r['created_at'] as Date,
  };
}

export class GameHistoryRepository {
  static async save(
    userId: string,
    roomId: string,
    score: number,
    rank: number | null
  ): Promise<GameHistoryRecord> {
    const doc = await GameHistoryModel.create({
      user_id: new Types.ObjectId(userId),
      room_id: roomId,
      score,
      rank,
    });
    return toRecord(doc.toJSON());
  }

  static async listByUser(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<GameHistoryRecord[]> {
    const docs = await GameHistoryModel.find({ user_id: new Types.ObjectId(userId) })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit);
    return docs.map((d) => toRecord(d.toJSON()));
  }

  static async topScores(limit = 10): Promise<GameHistoryRecord[]> {
    const docs = await GameHistoryModel.find()
      .sort({ score: -1 })
      .limit(limit);
    return docs.map((d) => toRecord(d.toJSON()));
  }

  static async bestByUser(userId: string): Promise<GameHistoryRecord | null> {
    const doc = await GameHistoryModel.findOne({ user_id: new Types.ObjectId(userId) })
      .sort({ score: -1 });
    return doc ? toRecord(doc.toJSON()) : null;
  }
}

