import { Types } from 'mongoose';
import {
  TournamentModel,
  TournamentParticipantModel,
  TournamentMatchModel,
  UserModel,
} from '../database/models';
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

function toId(id: string) {
  return new Types.ObjectId(id);
}

function toTournamentRecord(doc: Record<string, unknown>): TournamentRecord {
  return {
    id:               String(doc['id']),
    name:             doc['name'] as string,
    description:      (doc['description'] as string) ?? null,
    status:           doc['status'] as TournamentStatus,
    bracket_type:     doc['bracket_type'] as BracketType,
    max_participants: doc['max_participants'] as number,
    rounds_total:     doc['rounds_total'] as number,
    current_round:    doc['current_round'] as number,
    prize_info:       (doc['prize_info'] as string) ?? null,
    created_by:       String(doc['created_by']),
    starts_at:        doc['starts_at'] as Date,
    ended_at:         (doc['ended_at'] as Date) ?? null,
    created_at:       doc['created_at'] as Date,
    updated_at:       doc['updated_at'] as Date,
  };
}

function toParticipant(
  doc: Record<string, unknown>,
  username: string,
  avatar: string | null
): TournamentParticipant {
  return {
    id:               String(doc['id']),
    tournament_id:    String(doc['tournament_id']),
    user_id:          String(doc['user_id']),
    username,
    avatar:           avatar ?? null,
    elo_at_entry:     doc['elo_at_entry'] as number,
    seed:             (doc['seed'] as number) ?? null,
    eliminated_round: (doc['eliminated_round'] as number) ?? null,
    final_placement:  (doc['final_placement'] as number) ?? null,
    created_at:       doc['created_at'] as Date,
  };
}

function toMatch(
  doc: Record<string, unknown>,
  p1?: { username: string; avatar: string | null },
  p2?: { username: string; avatar: string | null }
): TournamentMatch {
  return {
    id:            String(doc['id']),
    tournament_id: String(doc['tournament_id']),
    round_number:  doc['round_number'] as number,
    match_number:  doc['match_number'] as number,
    room_id:       (doc['room_id'] as string) ?? null,
    player1_id:    doc['player1_id'] ? String(doc['player1_id']) : null,
    player2_id:    doc['player2_id'] ? String(doc['player2_id']) : null,
    winner_id:     doc['winner_id'] ? String(doc['winner_id']) : null,
    player1_score: (doc['player1_score'] as number) ?? null,
    player2_score: (doc['player2_score'] as number) ?? null,
    status:        doc['status'] as MatchStatus,
    scheduled_at:  (doc['scheduled_at'] as Date) ?? null,
    completed_at:  (doc['completed_at'] as Date) ?? null,
    player1:       p1,
    player2:       p2,
  };
}

async function getUserInfo(id: Types.ObjectId | null | undefined) {
  if (!id) return undefined;
  const u = await UserModel.findById(id).select('username avatar');
  if (!u) return undefined;
  const j = u.toJSON() as Record<string, unknown>;
  return { username: j['username'] as string, avatar: (j['avatar'] as string) ?? null };
}

export class TournamentRepository {
  static async create(input: CreateTournamentInput): Promise<TournamentRecord> {
    const roundsTotal = Math.ceil(Math.log2(input.maxParticipants));
    const doc = await TournamentModel.create({
      name:             input.name,
      description:      input.description ?? null,
      bracket_type:     input.bracketType,
      max_participants: input.maxParticipants,
      rounds_total:     roundsTotal,
      starts_at:        input.startsAt,
      prize_info:       input.prizeInfo ?? null,
      created_by:       toId(input.createdBy),
    });
    return toTournamentRecord(doc.toJSON() as Record<string, unknown>);
  }

  static async getById(id: string): Promise<TournamentDetail | null> {
    try {
      const tournDoc = await TournamentModel.findById(toId(id));
      if (!tournDoc) return null;

      const tid = toId(id);
      const [partDocs, matchDocs] = await Promise.all([
        TournamentParticipantModel.find({ tournament_id: tid }).sort({ seed: 1, created_at: 1 }),
        TournamentMatchModel.find({ tournament_id: tid }).sort({ round_number: 1, match_number: 1 }),
      ]);

      // Resolve user info in parallel
      const userIds = [
        ...partDocs.map((p) => p.user_id),
        ...matchDocs.flatMap((m) => [m.player1_id, m.player2_id].filter(Boolean) as Types.ObjectId[]),
      ];
      const uniqueIds = [...new Set(userIds.map((u) => u.toString()))];
      const users = await UserModel.find({ _id: { $in: uniqueIds.map(toId) } }).select('username avatar');
      const userMap = new Map(
        users.map((u) => {
          const j = u.toJSON() as Record<string, unknown>;
          return [String(j['id']), { username: j['username'] as string, avatar: (j['avatar'] as string) ?? null }];
        })
      );

      const participants: TournamentParticipant[] = partDocs.map((p) => {
        const pj = p.toJSON() as Record<string, unknown>;
        const ui = userMap.get(String(pj['user_id']));
        return toParticipant(pj, ui?.username ?? '', ui?.avatar ?? null);
      });

      const matches: TournamentMatch[] = matchDocs.map((m) => {
        const mj = m.toJSON() as Record<string, unknown>;
        const p1 = mj['player1_id'] ? userMap.get(String(mj['player1_id'])) : undefined;
        const p2 = mj['player2_id'] ? userMap.get(String(mj['player2_id'])) : undefined;
        return toMatch(mj, p1, p2);
      });

      const tournament = toTournamentRecord(tournDoc.toJSON() as Record<string, unknown>);
      return { ...tournament, participants, matches, participant_count: participants.length };
    } catch {
      return null;
    }
  }

  static async list(
    status?: TournamentStatus,
    limit = 20,
    offset = 0
  ): Promise<(TournamentRecord & { participant_count: number })[]> {
    const filter = status ? { status } : {};
    const docs = await TournamentModel.find(filter)
      .sort({ starts_at: -1 })
      .skip(offset)
      .limit(limit);

    const results = await Promise.all(
      docs.map(async (t) => {
        const count = await TournamentParticipantModel.countDocuments({ tournament_id: t._id });
        return {
          ...toTournamentRecord(t.toJSON() as Record<string, unknown>),
          participant_count: count,
        };
      })
    );
    return results;
  }

  static async register(tournamentId: string, userId: string, elo: number): Promise<void> {
    const tid = toId(tournamentId);
    const [count, tournament] = await Promise.all([
      TournamentParticipantModel.countDocuments({ tournament_id: tid }),
      TournamentModel.findById(tid).select('max_participants'),
    ]);
    if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');
    if (count >= tournament.max_participants) throw new Error('TOURNAMENT_FULL');

    try {
      await TournamentParticipantModel.create({
        tournament_id: tid,
        user_id:       toId(userId),
        elo_at_entry:  elo,
      });
    } catch (err: any) {
      if (err.code === 11000) return; // already registered — idempotent
      throw err;
    }
  }

  static async updateStatus(id: string, status: TournamentStatus): Promise<void> {
    await TournamentModel.updateOne(
      { _id: toId(id) },
      { $set: { status, updated_at: new Date() } }
    );
  }

  static async advanceRound(tournamentId: string): Promise<void> {
    await TournamentModel.updateOne(
      { _id: toId(tournamentId) },
      { $inc: { current_round: 1 }, $set: { updated_at: new Date() } }
    );
  }

  static async saveMatchResult(
    matchId: string,
    winnerId: string,
    p1Score: number,
    p2Score: number
  ): Promise<void> {
    await TournamentMatchModel.updateOne(
      { _id: toId(matchId) },
      {
        $set: {
          winner_id:     toId(winnerId),
          player1_score: p1Score,
          player2_score: p2Score,
          status:        'completed' as MatchStatus,
          completed_at:  new Date(),
        },
      }
    );
  }

  static async createMatch(
    tournamentId: string,
    roundNumber: number,
    matchNumber: number,
    player1Id: string | null,
    player2Id: string | null
  ): Promise<TournamentMatch> {
    const doc = await TournamentMatchModel.create({
      tournament_id: toId(tournamentId),
      round_number:  roundNumber,
      match_number:  matchNumber,
      player1_id:    player1Id ? toId(player1Id) : null,
      player2_id:    player2Id ? toId(player2Id) : null,
      status:        player2Id === null ? 'bye' : 'pending',
    });
    const mj = doc.toJSON() as Record<string, unknown>;
    const [p1Info, p2Info] = await Promise.all([
      getUserInfo(player1Id ? toId(player1Id) : null),
      getUserInfo(player2Id ? toId(player2Id) : null),
    ]);
    return toMatch(mj, p1Info, p2Info);
  }
}

