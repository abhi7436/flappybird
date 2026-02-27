import { PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import { pool } from '../database/connection';
import { UserRecord, PublicUser } from '../types';

const SALT_ROUNDS = 12;

export class UserRepository {
  // ── Write ────────────────────────────────────────────
  static async create(
    username: string,
    email: string,
    plainPassword: string
  ): Promise<UserRecord> {
    const password_hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    const { rows } = await pool.query<UserRecord>(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [username, email, password_hash]
    );
    return rows[0];
  }

  static async updateHighScore(userId: string, score: number): Promise<void> {
    await pool.query(
      `UPDATE users
          SET high_score = GREATEST(high_score, $1)
        WHERE id = $2`,
      [score, userId]
    );
  }

  static async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    await pool.query(
      `UPDATE users SET avatar = $1 WHERE id = $2`,
      [avatarUrl, userId]
    );
  }

  static async setOnlineStatus(userId: string, online: boolean): Promise<void> {
    await pool.query(
      `UPDATE users SET is_online = $1 WHERE id = $2`,
      [online, userId]
    );
  }

  // ── Read ─────────────────────────────────────────────
  static async findById(id: string): Promise<UserRecord | null> {
    const { rows } = await pool.query<UserRecord>(
      `SELECT * FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await pool.query<UserRecord>(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] ?? null;
  }

  static async findByUsername(username: string): Promise<UserRecord | null> {
    const { rows } = await pool.query<UserRecord>(
      `SELECT * FROM users WHERE username = $1`,
      [username]
    );
    return rows[0] ?? null;
  }

  static async publicProfile(id: string): Promise<PublicUser | null> {
    const { rows } = await pool.query<PublicUser>(
      `SELECT id, username, avatar, high_score, is_online, created_at, updated_at
         FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  // ── Auth helpers ───────────────────────────────────
  static async verifyPassword(
    plainPassword: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hash);
  }

  // ── Client-scoped (for transactions) ──────────────
  static async findByIdTx(
    client: PoolClient,
    id: string
  ): Promise<UserRecord | null> {
    const { rows } = await client.query<UserRecord>(
      `SELECT * FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }
}
