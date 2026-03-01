import { getDb } from '../database/connection';
import { RoomInviteRecord } from '../types';

export class InviteRepository {
  static async create(
    roomId: string,
    createdBy: string,
    inviteCode: string
  ): Promise<RoomInviteRecord> {
    const db = getDb();
    const now = new Date();
    const doc = {
      room_id: roomId,
      created_by: createdBy,
      invite_code: inviteCode,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: now,
    } as any;
    const res = await db.collection('room_invites').insertOne(doc);
    doc.id = res.insertedId.toHexString();
    return doc as RoomInviteRecord;
  }

  static async findByCode(code: string): Promise<RoomInviteRecord | null> {
    const db = getDb();
    const doc = await db.collection('room_invites').findOne({ invite_code: code, expires_at: { $gt: new Date() } });
    return (doc as unknown as RoomInviteRecord) ?? null;
  }

  static async deleteExpired(): Promise<void> {
    const db = getDb();
    await db.collection('room_invites').deleteMany({ expires_at: { $lte: new Date() } });
  }
}
