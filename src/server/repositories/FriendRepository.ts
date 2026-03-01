import { getDb } from '../database/connection';
import { FriendRecord, FriendWithUser } from '../types';

export class FriendRepository {
  static async sendRequest(
    requesterId: string,
    receiverId: string
  ): Promise<FriendRecord> {
    const db = getDb();
    // Prevent duplicates
    const exists = await db.collection('friends').findOne({ requester_id: requesterId, receiver_id: receiverId });
    if (exists) throw new Error('Friend request already exists');
    const now = new Date();
    const doc = {
      id: undefined,
      requester_id: requesterId,
      receiver_id: receiverId,
      status: 'pending',
      created_at: now,
      updated_at: now,
    } as any;
    const res = await db.collection('friends').insertOne(doc);
    doc.id = res.insertedId.toHexString();
    return doc as FriendRecord;
  }

  static async acceptRequest(
    requesterId: string,
    receiverId: string
  ): Promise<FriendRecord> {
    const db = getDb();
    const result = await db.collection('friends').findOneAndUpdate(
      { requester_id: requesterId, receiver_id: receiverId, status: 'pending' },
      { $set: { status: 'accepted', updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result.value) throw new Error('No pending request found');
    return result.value as FriendRecord;
  }

  static async remove(userA: string, userB: string): Promise<void> {
    const db = getDb();
    await db.collection('friends').deleteMany({
      $or: [
        { requester_id: userA, receiver_id: userB },
        { requester_id: userB, receiver_id: userA },
      ],
    });
  }

  static async block(
    requesterId: string,
    receiverId: string
  ): Promise<FriendRecord> {
    const db = getDb();
    const now = new Date();
    const result = await db.collection('friends').findOneAndUpdate(
      { requester_id: requesterId, receiver_id: receiverId },
      { $set: { status: 'blocked', updated_at: now }, $setOnInsert: { created_at: now } },
      { upsert: true, returnDocument: 'after' }
    );
    return result.value as FriendRecord;
  }

  /** Returns accepted friends with their public profile attached */
  static async listFriends(userId: string): Promise<FriendWithUser[]> {
    const db = getDb();
    const docs = await db.collection('friends').find({
      status: 'accepted',
      $or: [{ requester_id: userId }, { receiver_id: userId }],
    }).toArray();

    const usersCol = db.collection('users');
    const result: FriendWithUser[] = [];
    for (const f of docs) {
      const friendId = f.requester_id === userId ? f.receiver_id : f.requester_id;
      const u = await usersCol.findOne({ id: friendId }, { projection: { password_hash: 0, email: 0 } });
      result.push({ ...f, friend: u as any });
    }
    return result;
  }

  static async listPending(userId: string): Promise<FriendRecord[]> {
    const db = getDb();
    return db.collection('friends').find({ receiver_id: userId, status: 'pending' }).toArray() as Promise<FriendRecord[]>;
  }

  static async areFriends(userA: string, userB: string): Promise<boolean> {
    const db = getDb();
    const doc = await db.collection('friends').findOne({
      status: 'accepted',
      $or: [
        { requester_id: userA, receiver_id: userB },
        { requester_id: userB, receiver_id: userA },
      ],
    });
    return !!doc;
  }
}
