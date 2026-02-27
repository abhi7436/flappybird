import { pool } from '../database/connection';
import { GameHistoryRecord } from '../types';

export class GameHistoryRepository {
  static async save(
    userId: string,
    roomId: string,
    score: number,
    rank: number | null
  ): Promise<GameHistoryRecord> {
    const { rows } = await pool.query<GameHistoryRecord>(
      `INSERT INTO game_history (user_id, room_id, score, rank)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, roomId, score, rank]
    );
    return rows[0];
  }

  static async listByUser(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<GameHistoryRecord[]> {
    const { rows } = await pool.query<GameHistoryRecord>(
      `SELECT * FROM game_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  }

  static async topScores(limit = 10): Promise<GameHistoryRecord[]> {
    const { rows } = await pool.query<GameHistoryRecord>(
      `SELECT gh.*
         FROM game_history gh
        ORDER BY score DESC
        LIMIT $1`,
      [limit]
    );
    return rows;
  }

  static async bestByUser(userId: string): Promise<GameHistoryRecord | null> {
    const { rows } = await pool.query<GameHistoryRecord>(
      `SELECT * FROM game_history
        WHERE user_id = $1
        ORDER BY score DESC
        LIMIT 1`,
      [userId]
    );
    return rows[0] ?? null;
  }
}
