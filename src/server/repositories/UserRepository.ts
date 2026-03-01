import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { UserModel, UserSkinModel } from '../database/models';
import { UserRecord, PublicUser } from '../types';

const SALT_ROUNDS = 12;

// Converts a Mongoose User document to the domain UserRecord type.
function toRecord(doc: ReturnType<typeof UserModel.prototype.toJSON>): UserRecord {
  return doc as unknown as UserRecord;
}

export class UserRepository {
  // ── Write ────────────────────────────────────────────
  static async create(
    username: string,
    email: string,
    plainPassword: string
  ): Promise<UserRecord> {
    const password_hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    const user = await UserModel.create({ username, email, password_hash });
    // Grant the classic skin automatically
    await UserSkinModel.create({ user_id: user._id, skin_id: 'classic', is_equipped: true });
    return toRecord(user.toJSON());
  }

  static async updateHighScore(userId: string, score: number): Promise<void> {
    // $max only updates if the new value is greater
    await UserModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $max: { high_score: score }, $set: { updated_at: new Date() } }
    );
  }

  static async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    await UserModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $set: { avatar: avatarUrl, updated_at: new Date() } }
    );
  }

  static async setOnlineStatus(userId: string, online: boolean): Promise<void> {
    await UserModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      { $set: { is_online: online, updated_at: new Date() } }
    );
  }

  // ── Read ─────────────────────────────────────────────
  static async findById(id: string): Promise<UserRecord | null> {
    try {
      const doc = await UserModel.findById(new Types.ObjectId(id));
      return doc ? toRecord(doc.toJSON()) : null;
    } catch {
      return null; // invalid ObjectId
    }
  }

  static async findByEmail(email: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() });
    return doc ? toRecord(doc.toJSON()) : null;
  }

  static async findByUsername(username: string): Promise<UserRecord | null> {
    const doc = await UserModel.findOne({ username });
    return doc ? toRecord(doc.toJSON()) : null;
  }

  static async publicProfile(id: string): Promise<PublicUser | null> {
    try {
      const doc = await UserModel.findById(new Types.ObjectId(id)).select(
        'id username avatar high_score elo_rating games_played is_online created_at updated_at'
      );
      if (!doc) return null;
      const { password_hash: _ph, email: _em, ...pub } = toRecord(doc.toJSON());
      return pub as PublicUser;
    } catch {
      return null;
    }
  }

  // ── Auth helpers ───────────────────────────────────
  static async verifyPassword(
    plainPassword: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hash);
  }

  // ── Kept for compatibility (no client needed in MongoDB) ──
  static async findByIdTx(
    _client: unknown,
    id: string
  ): Promise<UserRecord | null> {
    return UserRepository.findById(id);
  }
}

