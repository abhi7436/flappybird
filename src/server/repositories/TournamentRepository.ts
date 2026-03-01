import { getDb } from '../database/connection';
import {
  TournamentRecord,
  TournamentDetail,
  TournamentMatch,
  TournamentParticipant,
  TournamentStatus,
  BracketType,
  MatchStatus,
} from '../types';

export interface CreateTournamentInput {
  name: string;
  description?: string;
  bracketType: BracketType;
  maxParticipants: number;
  startsAt: Date;
  prizeInfo?: string;
  createdBy: string;
}

export class TournamentRepository {
  static async create(input: CreateTournamentInput): Promise<TournamentRecord> {
    const roundsTotal = Math.ceil(Math.log2(input.maxParticipants));
    const db = getDb();
    const now = new Date();
    const doc = {
      name: input.name,
      description: input.description ?? null,
      bracket_type: input.bracketType,
      max_participants: input.maxParticipants,
      rounds_total: roundsTotal,
      current_round: 0,
      prize_info: input.prizeInfo ?? null,
      created_by: input.createdBy,
      starts_at: input.startsAt,
      ended_at: null,
      status: 'registration',
      created_at: now,
      updated_at: now,
    } as any;
    const res = await db.collection('tournaments').insertOne(doc);
    doc.id = res.insertedId.toHexString();
    return doc as TournamentRecord;
  }

  static async getById(id: string): Promise<TournamentDetail | null> {
    const db = getDb();
    const tournament = await db.collection('tournaments').findOne({ id });
    if (!tournament) return null;

    const participants = await db.collection('tournament_participants').aggregate([
      { $match: { tournament_id: id } },
      { $lookup: { from: 'users', localField: 'user_id', foreignField: 'id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      { $addFields: { username: '$user.username', avatar: '$user.avatar' } },
      { $project: { user: 0 } },
      { $sort: { seed: 1, created_at: 1 } },
    ]).toArray() as TournamentParticipant[];

    const matches = await db.collection('tournament_matches').aggregate([
      { $match: { tournament_id: id } },
      { $lookup: { from: 'users', localField: 'player1_id', foreignField: 'id', as: 'p1' } },
      { $lookup: { from: 'users', localField: 'player2_id', foreignField: 'id', as: 'p2' } },
      { $lookup: { from: 'users', localField: 'winner_id', foreignField: 'id', as: 'w' } },
      { $unwind: { path: '$p1', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$p2', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$w', preserveNullAndEmptyArrays: true } },
      { $addFields: {
          'player1.username': '$p1.username',
          'player1.avatar': '$p1.avatar',
          'player2.username': '$p2.username',
          'player2.avatar': '$p2.avatar',
          'winner.username': '$w.username',
        }
      },
      { $project: { p1: 0, p2: 0, w: 0 } },
      { $sort: { round_number: 1, match_number: 1 } },
    ]).toArray() as TournamentMatch[];

    return {
      ...tournament,
      participants,
      matches,
      participant_count: participants.length,
    };
  }

  static async list(status?: TournamentStatus, limit = 20, offset = 0): Promise<TournamentRecord[]> {
    const db = getDb();
    const cursor = status
      ? db.collection('tournaments').find({ status })
      : db.collection('tournaments').find();
    const items = await cursor.sort({ starts_at: -1 }).skip(offset).limit(limit).toArray();
    // Attach participant_count for each
    for (const t of items) {
      const count = await db.collection('tournament_participants').countDocuments({ tournament_id: t.id });
      (t as any).participant_count = count;
    }
    return items as TournamentRecord[];
  }

  static async register(tournamentId: string, userId: string, elo: number): Promise<void> {
    // Enforce capacity
    const db = getDb();
    const count = await db.collection('tournament_participants').countDocuments({ tournament_id: tournamentId });
    const tournament = await db.collection('tournaments').findOne({ id: tournamentId });
    if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
    if (count >= (tournament.max_participants ?? 0)) throw new Error('TOURNAMENT_FULL');
    await db.collection('tournament_participants').updateOne(
      { tournament_id: tournamentId, user_id: userId },
      { $setOnInsert: { tournament_id: tournamentId, user_id: userId, username: null, avatar: null, elo_at_entry: elo, seed: null, eliminated_round: null, final_placement: null, created_at: new Date() } },
      { upsert: true }
    );
  }

  static async updateStatus(id: string, status: TournamentStatus): Promise<void> {
    const db = getDb();
    await db.collection('tournaments').updateOne({ id }, { $set: { status, updated_at: new Date() } });
  }

  static async advanceRound(tournamentId: string): Promise<void> {
    const db = getDb();
    await db.collection('tournaments').updateOne({ id: tournamentId }, { $inc: { current_round: 1 }, $set: { updated_at: new Date() } });
  }

  static async saveMatchResult(
    matchId: string,
    winnerId: string,
    p1Score: number,
    p2Score: number
  ): Promise<void> {
    const db = getDb();
    await db.collection('tournament_matches').updateOne({ id: matchId }, { $set: { winner_id: winnerId, player1_score: p1Score, player2_score: p2Score, status: 'completed', completed_at: new Date() } });
  }

  static async createMatch(
    tournamentId: string,
    roundNumber: number,
    matchNumber: number,
    player1Id: string | null,
    player2Id: string | null
  ): Promise<TournamentMatch> {
    const db = getDb();
    const doc = {
      tournament_id: tournamentId,
      round_number: roundNumber,
      match_number: matchNumber,
      player1_id: player1Id,
      player2_id: player2Id,
      status: player2Id === null ? 'bye' : 'pending',
      scheduled_at: null,
      completed_at: null,
    } as any;
    const res = await db.collection('tournament_matches').insertOne(doc);
    doc.id = res.insertedId.toHexString();
    return doc as TournamentMatch;
  }
}
