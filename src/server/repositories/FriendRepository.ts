import { pool } from '../database/connection';
import { FriendRecord, FriendWithUser } from '../types';

export class FriendRepository {
  static async sendRequest(
    requesterId: string,
    receiverId: string
  ): Promise<FriendRecord> {
    const { rows } = await pool.query<FriendRecord>(
      `INSERT INTO friends (requester_id, receiver_id)
       VALUES ($1, $2)
       ON CONFLICT (requester_id, receiver_id) DO NOTHING
       RETURNING *`,
      [requesterId, receiverId]
    );
    if (!rows[0]) throw new Error('Friend request already exists');
    return rows[0];
  }

  static async acceptRequest(
    requesterId: string,
    receiverId: string
  ): Promise<FriendRecord> {
    const { rows } = await pool.query<FriendRecord>(
      `UPDATE friends
          SET status = 'accepted'
        WHERE requester_id = $1 AND receiver_id = $2 AND status = 'pending'
        RETURNING *`,
      [requesterId, receiverId]
    );
    if (!rows[0]) throw new Error('No pending request found');
    return rows[0];
  }

  static async remove(userA: string, userB: string): Promise<void> {
    await pool.query(
      `DELETE FROM friends
        WHERE (requester_id = $1 AND receiver_id = $2)
           OR (requester_id = $2 AND receiver_id = $1)`,
      [userA, userB]
    );
  }

  static async block(
    requesterId: string,
    receiverId: string
  ): Promise<FriendRecord> {
    const { rows } = await pool.query<FriendRecord>(
      `INSERT INTO friends (requester_id, receiver_id, status)
       VALUES ($1, $2, 'blocked')
       ON CONFLICT (requester_id, receiver_id)
       DO UPDATE SET status = 'blocked'
       RETURNING *`,
      [requesterId, receiverId]
    );
    return rows[0];
  }

  /** Returns accepted friends with their public profile attached */
  static async listFriends(userId: string): Promise<FriendWithUser[]> {
    const { rows } = await pool.query<FriendWithUser>(
      `SELECT f.*,
              json_build_object(
                'id',         u.id,
                'username',   u.username,
                'avatar',     u.avatar,
                'high_score', u.high_score,
                'is_online',  u.is_online,
                'created_at', u.created_at,
                'updated_at', u.updated_at
              ) AS friend
         FROM friends f
         JOIN users u
           ON (f.requester_id = $1 AND u.id = f.receiver_id)
           OR (f.receiver_id  = $1 AND u.id = f.requester_id)
        WHERE f.status = 'accepted'
          AND ($1 = f.requester_id OR $1 = f.receiver_id)`,
      [userId]
    );
    return rows;
  }

  static async listPending(userId: string): Promise<FriendRecord[]> {
    const { rows } = await pool.query<FriendRecord>(
      `SELECT * FROM friends
        WHERE receiver_id = $1 AND status = 'pending'`,
      [userId]
    );
    return rows;
  }

  static async areFriends(userA: string, userB: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT 1 FROM friends
        WHERE status = 'accepted'
          AND ((requester_id = $1 AND receiver_id = $2)
           OR  (requester_id = $2 AND receiver_id = $1))`,
      [userA, userB]
    );
    return rows.length > 0;
  }
}
