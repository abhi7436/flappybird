import { Types } from 'mongoose';
import { RoomInviteModel } from '../database/models';
import { RoomInviteRecord } from '../types';

function toRecord(doc: ReturnType<typeof RoomInviteModel.prototype.toJSON>): RoomInviteRecord {
  const r = doc as Record<string, unknown>;
  return {
    id:          String(r['id']),
    room_id:     r['room_id'] as string,
    invite_code: r['invite_code'] as string,
    created_by:  String(r['created_by']),
    expires_at:  r['expires_at'] as Date,
    created_at:  r['created_at'] as Date,
  };
}

export class InviteRepository {
  static async create(
    roomId: string,
    createdBy: string,
    inviteCode: string
  ): Promise<RoomInviteRecord> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const doc = await RoomInviteModel.create({
      room_id:     roomId,
      created_by:  new Types.ObjectId(createdBy),
      invite_code: inviteCode,
      expires_at:  expiresAt,
    });
    return toRecord(doc.toJSON());
  }

  static async findByCode(code: string): Promise<RoomInviteRecord | null> {
    const doc = await RoomInviteModel.findOne({
      invite_code: code,
      expires_at:  { $gt: new Date() },
    });
    return doc ? toRecord(doc.toJSON()) : null;
  }

  /** No-op: MongoDB TTL index auto-expires docs. Kept for API compatibility. */
  static async deleteExpired(): Promise<void> {
    // TTL index on expires_at handles deletion automatically.
  }
}

