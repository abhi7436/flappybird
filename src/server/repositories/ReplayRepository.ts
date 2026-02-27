import { db } from '../database/connection';
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
    return db.one(
      `INSERT INTO replays
         (room_id, user_id, final_score, final_rank, duration_ms, seed, events,
          canvas_width, canvas_height, engine_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.roomId,
        input.userId,
        replay.finalScore,
        input.finalRank,
        replay.durationMs,
        replay.seed,
        JSON.stringify(replay.events),
        replay.canvasWidth,
        replay.canvasHeight,
        replay.engineVersion,
      ]
    );
  }

  static async getById(id: string): Promise<ReplayRecord | null> {
    return db.oneOrNone('SELECT * FROM replays WHERE id = $1', [id]);
  }

  static async listByUser(userId: string, limit = 20, offset = 0): Promise<ReplayRecord[]> {
    return db.any(
      `SELECT * FROM replays
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
  }

  static async listByRoom(roomId: string): Promise<ReplayRecord[]> {
    return db.any(
      `SELECT r.*, u.username
         FROM replays r
         JOIN users u ON u.id = r.user_id
        WHERE r.room_id = $1
        ORDER BY r.final_score DESC`,
      [roomId]
    );
  }

  static async getTopReplays(limit = 10): Promise<ReplayRecord[]> {
    return db.any(
      `SELECT r.*, u.username, u.avatar
         FROM replays r
         JOIN users u ON u.id = r.user_id
        ORDER BY r.final_score DESC
        LIMIT $1`,
      [limit]
    );
  }

  static async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await db.result(
      'DELETE FROM replays WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return result.rowCount > 0;
  }
}
