import { db } from '../database/connection';
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
    return db.one(
      `INSERT INTO tournaments
         (name, description, bracket_type, max_participants, rounds_total, starts_at, prize_info, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.name, input.description ?? null, input.bracketType,
        input.maxParticipants, roundsTotal, input.startsAt,
        input.prizeInfo ?? null, input.createdBy,
      ]
    );
  }

  static async getById(id: string): Promise<TournamentDetail | null> {
    const tournament = await db.oneOrNone<TournamentRecord>(
      'SELECT * FROM tournaments WHERE id = $1',
      [id]
    );
    if (!tournament) return null;

    const [participants, matches] = await Promise.all([
      db.any<TournamentParticipant>(
        `SELECT tp.*, u.username, u.avatar
           FROM tournament_participants tp
           JOIN users u ON u.id = tp.user_id
          WHERE tp.tournament_id = $1
          ORDER BY tp.seed NULLS LAST, tp.created_at`,
        [id]
      ),
      db.any<TournamentMatch>(
        `SELECT tm.*,
                p1.username AS "player1Username", p1.avatar AS "player1Avatar",
                p2.username AS "player2Username", p2.avatar AS "player2Avatar",
                w.username  AS "winnerUsername"
           FROM tournament_matches tm
           LEFT JOIN users p1 ON p1.id = tm.player1_id
           LEFT JOIN users p2 ON p2.id = tm.player2_id
           LEFT JOIN users w  ON w.id  = tm.winner_id
          WHERE tm.tournament_id = $1
          ORDER BY tm.round_number, tm.match_number`,
        [id]
      ),
    ]);

    return {
      ...tournament,
      participants,
      matches,
      participant_count: participants.length,
    };
  }

  static async list(status?: TournamentStatus, limit = 20, offset = 0): Promise<TournamentRecord[]> {
    if (status) {
      return db.any(
        `SELECT t.*, COUNT(tp.id) AS participant_count
           FROM tournaments t
      LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id
          WHERE t.status = $1
          GROUP BY t.id
          ORDER BY t.starts_at DESC
          LIMIT $2 OFFSET $3`,
        [status, limit, offset]
      );
    }
    return db.any(
      `SELECT t.*, COUNT(tp.id) AS participant_count
         FROM tournaments t
    LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id
        GROUP BY t.id
        ORDER BY t.starts_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  }

  static async register(tournamentId: string, userId: string, elo: number): Promise<void> {
    // Enforce capacity
    const { count } = await db.one<{ count: string }>(
      'SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = $1',
      [tournamentId]
    );
    const { max_participants } = await db.one<{ max_participants: number }>(
      'SELECT max_participants FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    if (parseInt(count) >= max_participants) throw new Error('TOURNAMENT_FULL');

    await db.none(
      `INSERT INTO tournament_participants (tournament_id, user_id, elo_at_entry)
       VALUES ($1, $2, $3)
       ON CONFLICT (tournament_id, user_id) DO NOTHING`,
      [tournamentId, userId, elo]
    );
  }

  static async updateStatus(id: string, status: TournamentStatus): Promise<void> {
    await db.none(
      `UPDATE tournaments SET status = $1, updated_at = NOW()
        WHERE id = $2`,
      [status, id]
    );
  }

  static async advanceRound(tournamentId: string): Promise<void> {
    await db.none(
      `UPDATE tournaments SET current_round = current_round + 1, updated_at = NOW()
        WHERE id = $1`,
      [tournamentId]
    );
  }

  static async saveMatchResult(
    matchId: string,
    winnerId: string,
    p1Score: number,
    p2Score: number
  ): Promise<void> {
    await db.none(
      `UPDATE tournament_matches
          SET winner_id = $1, player1_score = $2, player2_score = $3,
              status = 'completed', completed_at = NOW()
        WHERE id = $4`,
      [winnerId, p1Score, p2Score, matchId]
    );
  }

  static async createMatch(
    tournamentId: string,
    roundNumber: number,
    matchNumber: number,
    player1Id: string | null,
    player2Id: string | null
  ): Promise<TournamentMatch> {
    return db.one(
      `INSERT INTO tournament_matches
         (tournament_id, round_number, match_number, player1_id, player2_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tournamentId, roundNumber, matchNumber, player1Id, player2Id,
        player2Id === null ? 'bye' : 'pending',
      ]
    );
  }
}
