import { db } from '../database/connection';
import { SkinRecord, UserSkinRecord, SkinWithOwnership } from '../types';

export class SkinRepository {
  /** Fetch all active skins with ownership status for a given user. */
  static async getAllWithOwnership(userId: string): Promise<SkinWithOwnership[]> {
    return db.any<SkinWithOwnership>(
      `SELECT s.*,
              (us.skin_id IS NOT NULL)              AS owned,
              (us.is_equipped IS TRUE)              AS equipped
         FROM skins s
         LEFT JOIN user_skins us ON us.skin_id = s.id AND us.user_id = $1
        WHERE s.is_active = TRUE
        ORDER BY s.rarity DESC, s.name`,
      [userId]
    );
  }

  /** Return all skins owned by a user. */
  static async getOwned(userId: string): Promise<UserSkinRecord[]> {
    return db.any(
      `SELECT * FROM user_skins WHERE user_id = $1 ORDER BY unlocked_at`,
      [userId]
    );
  }

  /** Grant a skin to a user (idempotent — safe to call multiple times). */
  static async grant(userId: string, skinId: string): Promise<void> {
    await db.none(
      `INSERT INTO user_skins (user_id, skin_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, skin_id) DO NOTHING`,
      [userId, skinId]
    );
  }

  /**
   * Equip a skin for a user.
   * Un-equips any currently equipped skin first.
   * Throws if the user does not own the skin.
   */
  static async equip(userId: string, skinId: string): Promise<void> {
    const owns = await db.oneOrNone(
      'SELECT 1 FROM user_skins WHERE user_id = $1 AND skin_id = $2',
      [userId, skinId]
    );
    if (!owns) throw new Error('SKIN_NOT_OWNED');

    await db.tx(async (t) => {
      await t.none('UPDATE user_skins SET is_equipped = FALSE WHERE user_id = $1', [userId]);
      await t.none(
        'UPDATE user_skins SET is_equipped = TRUE WHERE user_id = $1 AND skin_id = $2',
        [userId, skinId]
      );
    });
  }

  /** Returns the currently equipped skin id (or 'classic' as fallback). */
  static async getEquipped(userId: string): Promise<string> {
    const row = await db.oneOrNone<{ skin_id: string }>(
      'SELECT skin_id FROM user_skins WHERE user_id = $1 AND is_equipped = TRUE',
      [userId]
    );
    return row?.skin_id ?? 'classic';
  }

  /** Check ELO-gated skins and auto-grant them to a user. */
  static async checkEloUnlocks(userId: string, elo: number): Promise<string[]> {
    const eligible = await db.any<{ id: string }>(
      `SELECT s.id
         FROM skins s
        WHERE s.is_active = TRUE
          AND s.min_elo > 0
          AND s.min_elo <= $1
          AND NOT EXISTS (
            SELECT 1 FROM user_skins us
             WHERE us.user_id = $2 AND us.skin_id = s.id
          )`,
      [elo, userId]
    );

    for (const s of eligible) {
      await SkinRepository.grant(userId, s.id);
    }
    return eligible.map((s) => s.id);
  }

  /** Return the skin definition by id. */
  static async getById(skinId: string): Promise<SkinRecord | null> {
    return db.oneOrNone('SELECT * FROM skins WHERE id = $1', [skinId]);
  }
}
