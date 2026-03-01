import { Types } from 'mongoose';
import { SkinModel, UserSkinModel } from '../database/models';
import { SkinRecord, UserSkinRecord, SkinWithOwnership } from '../types';

function toSkinRecord(doc: Record<string, unknown>): SkinRecord {
  return {
    id:               String(doc['id'] ?? doc['_id']),
    name:             doc['name'] as string,
    description:      (doc['description'] as string) ?? null,
    season:           (doc['season'] as SkinRecord['season']) ?? null,
    rarity:           doc['rarity'] as SkinRecord['rarity'],
    unlock_condition: (doc['unlock_condition'] as string) ?? null,
    color_body:       doc['color_body'] as string,
    color_wing:       doc['color_wing'] as string,
    color_eye:        doc['color_eye'] as string,
    color_beak:       doc['color_beak'] as string,
    is_active:        doc['is_active'] as boolean,
    min_elo:          doc['min_elo'] as number,
    created_at:       doc['created_at'] as Date,
  };
}

function toUserSkinRecord(doc: Record<string, unknown>): UserSkinRecord {
  return {
    id:          String(doc['id']),
    user_id:     String(doc['user_id']),
    skin_id:     doc['skin_id'] as string,
    unlocked_at: doc['unlocked_at'] as Date,
    is_equipped: doc['is_equipped'] as boolean,
  };
}

export class SkinRepository {
  /** Fetch all active skins with ownership status for a given user. */
  static async getAllWithOwnership(userId: string): Promise<SkinWithOwnership[]> {
    const uid = new Types.ObjectId(userId);
    const [skins, owned] = await Promise.all([
      SkinModel.find({ is_active: true }).sort({ min_elo: -1, name: 1 }),
      UserSkinModel.find({ user_id: uid }),
    ]);

    const ownedMap = new Map(owned.map((us) => [us.skin_id, us]));

    return skins.map((s) => {
      const ownership = ownedMap.get(s._id as string);
      return {
        ...toSkinRecord(s.toJSON()),
        owned:    !!ownership,
        equipped: ownership?.is_equipped ?? false,
      };
    });
  }

  /** Return all skins owned by a user. */
  static async getOwned(userId: string): Promise<UserSkinRecord[]> {
    const docs = await UserSkinModel.find({ user_id: new Types.ObjectId(userId) })
      .sort({ unlocked_at: 1 });
    return docs.map((d) => toUserSkinRecord(d.toJSON() as Record<string, unknown>));
  }

  /** Grant a skin to a user (idempotent). */
  static async grant(userId: string, skinId: string): Promise<void> {
    await UserSkinModel.updateOne(
      { user_id: new Types.ObjectId(userId), skin_id: skinId },
      { $setOnInsert: { user_id: new Types.ObjectId(userId), skin_id: skinId, is_equipped: false } },
      { upsert: true }
    );
  }

  /**
   * Equip a skin for a user.
   * Un-equips any currently equipped skin first.
   * Throws if the user does not own the skin.
   */
  static async equip(userId: string, skinId: string): Promise<void> {
    const uid = new Types.ObjectId(userId);
    const owns = await UserSkinModel.exists({ user_id: uid, skin_id: skinId });
    if (!owns) throw new Error('SKIN_NOT_OWNED');

    // Un-equip all, then equip the chosen one
    await UserSkinModel.updateMany({ user_id: uid }, { $set: { is_equipped: false } });
    await UserSkinModel.updateOne(
      { user_id: uid, skin_id: skinId },
      { $set: { is_equipped: true } }
    );
  }

  /** Returns the currently equipped skin id (or 'classic' as fallback). */
  static async getEquipped(userId: string): Promise<string> {
    const doc = await UserSkinModel.findOne({
      user_id:     new Types.ObjectId(userId),
      is_equipped: true,
    });
    return doc?.skin_id ?? 'classic';
  }

  /** Check ELO-gated skins and auto-grant them to a user. */
  static async checkEloUnlocks(userId: string, elo: number): Promise<string[]> {
    const uid = new Types.ObjectId(userId);
    const ownedIds = (await UserSkinModel.find({ user_id: uid }).select('skin_id'))
      .map((us) => us.skin_id);

    const eligible = await SkinModel.find({
      is_active: true,
      min_elo:   { $gt: 0, $lte: elo },
      _id:       { $nin: ownedIds },
    }).select('_id');

    for (const s of eligible) {
      await SkinRepository.grant(userId, s._id as string);
    }
    return eligible.map((s) => s._id as string);
  }

  /** Return the skin definition by id. */
  static async getById(skinId: string): Promise<SkinRecord | null> {
    const doc = await SkinModel.findById(skinId);
    return doc ? toSkinRecord(doc.toJSON()) : null;
  }
}

