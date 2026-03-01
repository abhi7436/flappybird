import { getDb } from '../database/connection';
import { SkinRecord, UserSkinRecord, SkinWithOwnership } from '../types';

export class SkinRepository {
  /** Fetch all active skins with ownership status for a given user. */
  static async getAllWithOwnership(userId: string): Promise<SkinWithOwnership[]> {
    const db = getDb();
    const skins = await db.collection('skins').aggregate([
      { $match: { is_active: true } },
      { $lookup: {
          from: 'user_skins',
          let: { skinId: '$id' },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$skin_id', '$$skinId'] }, { $eq: ['$user_id', userId] } ] } } },
          ],
          as: 'ownership'
        }
      },
      { $addFields: { owned: { $gt: [ { $size: '$ownership' }, 0 ] }, equipped: { $gt: [ { $size: { $filter: { input: '$ownership', as: 'o', cond: { $eq: ['$$o.is_equipped', true] } } } }, 0 ] } } },
      { $project: { ownership: 0 } },
      { $sort: { rarity: -1, name: 1 } },
    ]).toArray() as Promise<SkinWithOwnership[]>;
    return skins;
  }

  /** Return all skins owned by a user. */
  static async getOwned(userId: string): Promise<UserSkinRecord[]> {
    const db = getDb();
    return db.collection('user_skins').find({ user_id: userId }).sort({ unlocked_at: 1 }).toArray() as Promise<UserSkinRecord[]>;
  }

  /** Grant a skin to a user (idempotent — safe to call multiple times). */
  static async grant(userId: string, skinId: string): Promise<void> {
    const db = getDb();
    // Idempotent grant
    await db.collection('user_skins').updateOne(
      { user_id: userId, skin_id: skinId },
      { $setOnInsert: { user_id: userId, skin_id: skinId, unlocked_at: new Date(), is_equipped: false } },
      { upsert: true }
    );
  }

  /**
   * Equip a skin for a user.
   * Un-equips any currently equipped skin first.
   * Throws if the user does not own the skin.
   */
  static async equip(userId: string, skinId: string): Promise<void> {
    const db = getDb();
    const own = await db.collection('user_skins').findOne({ user_id: userId, skin_id: skinId });
    if (!own) throw new Error('SKIN_NOT_OWNED');

    // Un-equip all then equip chosen skin
    await db.collection('user_skins').updateMany({ user_id: userId }, { $set: { is_equipped: false } });
    await db.collection('user_skins').updateOne({ user_id: userId, skin_id: skinId }, { $set: { is_equipped: true } });
  }

  /** Returns the currently equipped skin id (or 'classic' as fallback). */
  static async getEquipped(userId: string): Promise<string> {
    const db = getDb();
    const row = await db.collection('user_skins').findOne({ user_id: userId, is_equipped: true });
    return row?.skin_id ?? 'classic';
  }

  /** Check ELO-gated skins and auto-grant them to a user. */
  static async checkEloUnlocks(userId: string, elo: number): Promise<string[]> {
    const db = getDb();
    const owned = await db.collection('user_skins').find({ user_id: userId }).project({ skin_id: 1 }).toArray();
    const ownedIds = new Set(owned.map((o: any) => o.skin_id));
    const candidates = await db.collection('skins').find({ is_active: true, min_elo: { $gt: 0, $lte: elo } }).toArray();
    const eligible: string[] = [];
    for (const s of candidates) {
      if (!ownedIds.has(s.id)) {
        await SkinRepository.grant(userId, s.id);
        eligible.push(s.id);
      }
    }
    return eligible;
  }

  /** Return the skin definition by id. */
  static async getById(skinId: string): Promise<SkinRecord | null> {
    const db = getDb();
    const doc = await db.collection('skins').findOne({ id: skinId });
    return (doc as unknown as SkinRecord) ?? null;
  }
}
