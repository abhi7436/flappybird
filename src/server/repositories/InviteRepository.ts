import { pool } from '../database/connection';
import { RoomInviteRecord } from '../types';

export class InviteRepository {
  static async create(
    roomId: string,
    createdBy: string,
    inviteCode: string
  ): Promise<RoomInviteRecord> {
    const { rows } = await pool.query<RoomInviteRecord>(
      `INSERT INTO room_invites (room_id, created_by, invite_code)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [roomId, createdBy, inviteCode]
    );
    return rows[0];
  }

  static async findByCode(code: string): Promise<RoomInviteRecord | null> {
    const { rows } = await pool.query<RoomInviteRecord>(
      `SELECT * FROM room_invites
        WHERE invite_code = $1
          AND expires_at > NOW()`,
      [code]
    );
    return rows[0] ?? null;
  }

  static async deleteExpired(): Promise<void> {
    await pool.query(
      `DELETE FROM room_invites WHERE expires_at <= NOW()`
    );
  }
}
