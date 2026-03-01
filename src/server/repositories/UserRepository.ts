import bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';
import { getDb } from '../database/connection';
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
    const db = getDb();
    const _id = new ObjectId();
    const now = new Date();
    const doc = {
      _id,
      id: _id.toHexString(),
      username,
      email,
      password_hash,
      avatar: null,
      high_score: 0,
      elo_rating: 1000,
      games_played: 0,
      is_online: false,
      created_at: now,
      updated_at: now,
    } as any;
    await db.collection('users').insertOne(doc);
    const result: UserRecord = { ...doc };
    return result;
  }

  static async updateHighScore(userId: string, score: number): Promise<void> {
    const db = getDb();
    await db.collection('users').updateOne({ id: userId }, { $max: { high_score: score } });
  }

  static async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    const db = getDb();
    await db.collection('users').updateOne({ id: userId }, { $set: { avatar: avatarUrl } });
  }

  static async setOnlineStatus(userId: string, online: boolean): Promise<void> {
    const db = getDb();
    await db.collection('users').updateOne({ id: userId }, { $set: { is_online: online } });
  }

  // ── Read ─────────────────────────────────────────────
  static async findById(id: string): Promise<UserRecord | null> {
    const db = getDb();
    const doc = await db.collection('users').findOne({ id });
    return (doc as unknown as UserRecord) ?? null;
  }

  static async findByEmail(email: string): Promise<UserRecord | null> {
    const db = getDb();
    const doc = await db.collection('users').findOne({ email });
    return (doc as unknown as UserRecord) ?? null;
  }

  static async findByUsername(username: string): Promise<UserRecord | null> {
    const db = getDb();
    const doc = await db.collection('users').findOne({ username });
    return (doc as unknown as UserRecord) ?? null;
  }

  static async publicProfile(id: string): Promise<PublicUser | null> {
    const db = getDb();
    const doc = await db.collection('users').findOne(
      { id },
      { projection: { password_hash: 0, email: 0 } }
    );
    return (doc as unknown as PublicUser) ?? null;
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
    session: any | undefined,
    id: string
  ): Promise<UserRecord | null> {
    const db = getDb();
    const doc = await db.collection('users').findOne({ id }, { session });
    return (doc as unknown as UserRecord) ?? null;
  }
}
