import { Types } from 'mongoose';
import { FriendModel, UserModel } from '../database/models';
import { FriendRecord, FriendWithUser, PublicUser } from '../types';

function toId(id: string) {
  return new Types.ObjectId(id);
}

function toFriendRecord(doc: ReturnType<typeof FriendModel.prototype.toJSON>): FriendRecord {
  const r = doc as Record<string, unknown>;
  return {
    id:           String(r['id']),
    requester_id: String(r['requester_id']),
    receiver_id:  String(r['receiver_id']),
    status:       r['status'] as FriendRecord['status'],
    created_at:   r['created_at'] as Date,
    updated_at:   r['updated_at'] as Date,
  };
}

export class FriendRepository {
  static async sendRequest(
    requesterId: string,
    receiverId: string
  ): Promise<FriendRecord> {
    try {
      const doc = await FriendModel.create({
        requester_id: toId(requesterId),
        receiver_id:  toId(receiverId),
      });
      return toFriendRecord(doc.toJSON());
    } catch (err: any) {
      if (err.code === 11000) throw new Error('Friend request already exists');
      throw err;
    }
  }

  static async acceptRequest(
    requesterId: string,
    receiverId: string
  ): Promise<FriendRecord> {
    const doc = await FriendModel.findOneAndUpdate(
      { requester_id: toId(requesterId), receiver_id: toId(receiverId), status: 'pending' },
      { $set: { status: 'accepted', updated_at: new Date() } },
      { new: true }
    );
    if (!doc) throw new Error('No pending request found');
    return toFriendRecord(doc.toJSON());
  }

  static async remove(userA: string, userB: string): Promise<void> {
    await FriendModel.deleteMany({
      $or: [
        { requester_id: toId(userA), receiver_id: toId(userB) },
        { requester_id: toId(userB), receiver_id: toId(userA) },
      ],
    });
  }

  static async block(
    requesterId: string,
    receiverId: string
  ): Promise<FriendRecord> {
    const doc = await FriendModel.findOneAndUpdate(
      { requester_id: toId(requesterId), receiver_id: toId(receiverId) },
      { $set: { status: 'blocked', updated_at: new Date() } },
      { upsert: true, new: true }
    );
    return toFriendRecord(doc!.toJSON());
  }

  /** Returns accepted friends with their public profile attached. */
  static async listFriends(userId: string): Promise<FriendWithUser[]> {
    const uid = toId(userId);
    const docs = await FriendModel.find({
      status: 'accepted',
      $or: [{ requester_id: uid }, { receiver_id: uid }],
    });

    const results: FriendWithUser[] = [];
    for (const doc of docs) {
      const friendId = doc.requester_id.toString() === userId
        ? doc.receiver_id
        : doc.requester_id;

      const friendUser = await UserModel.findById(friendId).select(
        'id username avatar high_score elo_rating games_played is_online created_at updated_at'
      );
      if (!friendUser) continue;

      const uJson = friendUser.toJSON() as Record<string, unknown>;
      const friend: PublicUser = {
        id:           String(uJson['id']),
        username:     String(uJson['username']),
        avatar:       (uJson['avatar'] as string) ?? null,
        high_score:   uJson['high_score'] as number,
        elo_rating:   uJson['elo_rating'] as number,
        games_played: uJson['games_played'] as number,
        is_online:    uJson['is_online'] as boolean,
        created_at:   uJson['created_at'] as Date,
        updated_at:   uJson['updated_at'] as Date,
      };
      results.push({ ...toFriendRecord(doc.toJSON()), friend });
    }
    return results;
  }

  static async listPending(userId: string): Promise<FriendRecord[]> {
    const docs = await FriendModel.find({
      receiver_id: toId(userId),
      status: 'pending',
    });
    return docs.map((d) => toFriendRecord(d.toJSON()));
  }

  static async areFriends(userA: string, userB: string): Promise<boolean> {
    const exists = await FriendModel.exists({
      status: 'accepted',
      $or: [
        { requester_id: toId(userA), receiver_id: toId(userB) },
        { requester_id: toId(userB), receiver_id: toId(userA) },
      ],
    });
    return !!exists;
  }
}

