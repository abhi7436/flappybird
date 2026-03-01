import { Types } from 'mongoose';
import { ReplayModel, UserModel } from '../database/models';
import { ReplayRecord } from '../types';
import { ReplayData } from '../../game-engine/ReplayRecorder';

export interface SaveReplayInput {
  roomId: string;
  userId: string;
  finalRank: number | null;
  replay: ReplayData;
}

function toRecord(doc: ReturnType<typeof ReplayModel.prototype.toJSON>): ReplayRecord {
  const r = doc as Record<string, unknown>;
  return {
    id:             String(r['id']),
    room_id:        r['room_id'] as string,
    user_id:        String(r['user_id']),
    final_score:    r['final_score'] as number,
    final_rank:     (r['final_rank'] as number) ?? null,
    duration_ms:    r['duration_ms'] as number,
    seed:           r['seed'] as number,
    events:         r['events'] as Array<{ t: number; type: string }>,
    canvas_width:   r['canvas_width'] as number,
    canvas_height:  r['canvas_height'] as number,
    engine_version: r['engine_version'] as string,
    created_at:     r['created_at'] as Date,
  };
}

export class ReplayRepository {
  static async save(input: SaveReplayInput): Promise<ReplayRecord> {
    const { replay } = input;
    const doc = await ReplayModel.create({
      room_id:        input.roomId,
      user_id:        new Types.ObjectId(input.userId),
      final_score:    replay.finalScore,
      final_rank:     input.finalRank,
      duration_ms:    replay.durationMs,
      seed:           replay.seed,
      events:         replay.events,
      canvas_width:   replay.canvasWidth,
      canvas_height:  replay.canvasHeight,
      engine_version: replay.engineVersion,
    });
    return toRecord(doc.toJSON());
  }

  static async getById(id: string): Promise<ReplayRecord | null> {
    try {
      const doc = await ReplayModel.findById(new Types.ObjectId(id));
      return doc ? toRecord(doc.toJSON()) : null;
    } catch {
      return null;
    }
  }

  static async listByUser(userId: string, limit = 20, offset = 0): Promise<ReplayRecord[]> {
    const docs = await ReplayModel.find({ user_id: new Types.ObjectId(userId) })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit);
    return docs.map((d) => toRecord(d.toJSON()));
  }

  static async listByRoom(roomId: string): Promise<(ReplayRecord & { username?: string })[]> {
    const docs = await ReplayModel.find({ room_id: roomId }).sort({ final_score: -1 });
    const results: (ReplayRecord & { username?: string })[] = [];
    for (const doc of docs) {
      const rec = toRecord(doc.toJSON()) as ReplayRecord & { username?: string };
      const user = await UserModel.findById(doc.user_id).select('username');
      if (user) rec.username = (user.toJSON() as Record<string, unknown>)['username'] as string;
      results.push(rec);
    }
    return results;
  }

  static async getTopReplays(limit = 10): Promise<(ReplayRecord & { username?: string; avatar?: string | null })[]> {
    const docs = await ReplayModel.find().sort({ final_score: -1 }).limit(limit);
    const results: (ReplayRecord & { username?: string; avatar?: string | null })[] = [];
    for (const doc of docs) {
      const rec = toRecord(doc.toJSON()) as ReplayRecord & { username?: string; avatar?: string | null };
      const user = await UserModel.findById(doc.user_id).select('username avatar');
      if (user) {
        const u = user.toJSON() as Record<string, unknown>;
        rec.username = u['username'] as string;
        rec.avatar   = (u['avatar'] as string) ?? null;
      }
      results.push(rec);
    }
    return results;
  }

  static async deleteById(id: string, userId: string): Promise<boolean> {
    try {
      const result = await ReplayModel.deleteOne({
        _id:     new Types.ObjectId(id),
        user_id: new Types.ObjectId(userId),
      });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  }
}

