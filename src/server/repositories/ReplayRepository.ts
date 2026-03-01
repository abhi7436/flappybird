import { getDb } from '../database/connection';
import { ReplayRecord } from '../types';
import { ReplayData } from '../../game-engine/ReplayRecorder';

export interface SaveReplayInput {
  roomId: string;
  userId: string;
  finalRank: number | null;
  replay: ReplayData;
}

export class ReplayRepository {
  static async save(input: SaveReplayInput): Promise<ReplayRecord> {
    const { replay } = input;
    const db = getDb();
    const now = new Date();
    const doc = {
      room_id: input.roomId,
      user_id: input.userId,
      final_score: replay.finalScore,
      final_rank: input.finalRank,
      duration_ms: replay.durationMs,
      seed: replay.seed,
      events: replay.events,
      canvas_width: replay.canvasWidth,
      canvas_height: replay.canvasHeight,
      engine_version: replay.engineVersion,
      created_at: now,
    } as any;
    const res = await db.collection('replays').insertOne(doc);
    doc.id = res.insertedId.toHexString();
    return doc as ReplayRecord;
  }

  static async getById(id: string): Promise<ReplayRecord | null> {
    const db = getDb();
    const doc = await db.collection('replays').findOne({ id });
    return (doc as unknown as ReplayRecord) ?? null;
  }

  static async listByUser(userId: string, limit = 20, offset = 0): Promise<ReplayRecord[]> {
    const db = getDb();
    return db.collection('replays')
      .find({ user_id: userId })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray() as Promise<ReplayRecord[]>;
  }

  static async listByRoom(roomId: string): Promise<ReplayRecord[]> {
    const db = getDb();
    return db.collection('replays').aggregate([
      { $match: { room_id: roomId } },
      { $lookup: { from: 'users', localField: 'user_id', foreignField: 'id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $addFields: { username: '$user.username' } },
      { $sort: { final_score: -1 } },
    ]).toArray() as Promise<ReplayRecord[]>;
  }

  static async getTopReplays(limit = 10): Promise<ReplayRecord[]> {
    const db = getDb();
    return db.collection('replays').aggregate([
      { $lookup: { from: 'users', localField: 'user_id', foreignField: 'id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $addFields: { username: '$user.username', avatar: '$user.avatar' } },
      { $sort: { final_score: -1 } },
      { $limit: limit },
    ]).toArray() as Promise<ReplayRecord[]>;
  }

  static async deleteById(id: string, userId: string): Promise<boolean> {
    const db = getDb();
    const res = await db.collection('replays').deleteOne({ id, user_id: userId });
    return res.deletedCount !== undefined && res.deletedCount > 0;
  }
}
