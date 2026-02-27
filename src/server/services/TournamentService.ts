// ============================================================
// TournamentService — Bracket generation, match creation,
//                     and round advancement logic.
// Supports: single-elimination, round-robin.
// ============================================================

import { TournamentRepository } from '../repositories/TournamentRepository';
import { TournamentRecord, TournamentParticipant, TournamentMatch } from '../types';
import { db } from '../database/connection';

export class TournamentService {
  /**
   * Seed participants and generate all round-1 match-ups.
   * Seeds are assigned by ELO (highest seed = best ELO).
   * Bracket follows standard single-elimination seeding so
   * the top two seeds cannot meet until the final.
   */
  static async startTournament(tournamentId: string): Promise<void> {
    const detail = await TournamentRepository.getById(tournamentId);
    if (!detail)                                   throw new Error('TOURNAMENT_NOT_FOUND');
    if (detail.status !== 'registration')          throw new Error('TOURNAMENT_NOT_IN_REGISTRATION');
    if (detail.participants.length < 2)            throw new Error('TOURNAMENT_NOT_ENOUGH_PLAYERS');

    // Assign seeds by ELO descending
    const sorted = [...detail.participants].sort(
      (a, b) => b.elo_at_entry - a.elo_at_entry
    );

    await db.tx(async (t) => {
      for (let i = 0; i < sorted.length; i++) {
        await t.none(
          'UPDATE tournament_participants SET seed = $1 WHERE id = $2',
          [i + 1, sorted[i].id]
        );
      }
    });

    if (detail.bracket_type === 'single_elimination') {
      await TournamentService.generateSEBracket(tournamentId, sorted);
    } else {
      await TournamentService.generateRoundRobinRound(tournamentId, sorted, 1);
    }

    await TournamentRepository.updateStatus(tournamentId, 'active');
    await TournamentRepository.advanceRound(tournamentId);
  }

  /** Standard single-elimination: seed 1 vs last, seed 2 vs 2nd-last, etc. */
  private static async generateSEBracket(
    tournamentId: string,
    seeded: TournamentParticipant[]
  ): Promise<void> {
    const size    = TournamentService.nextPowerOfTwo(seeded.length);
    const byes    = size - seeded.length;
    const padded  = [...seeded, ...Array(byes).fill(null)] as (TournamentParticipant | null)[];
    const matches: Array<{ p1: string | null; p2: string | null }> = [];

    for (let i = 0; i < size / 2; i++) {
      matches.push({ p1: padded[i]?.user_id ?? null, p2: padded[size - 1 - i]?.user_id ?? null });
    }

    for (let i = 0; i < matches.length; i++) {
      await TournamentRepository.createMatch(
        tournamentId, 1, i + 1, matches[i].p1, matches[i].p2
      );
    }
  }

  /** Round-robin: every player faces every other once. */
  private static async generateRoundRobinRound(
    tournamentId: string,
    participants: TournamentParticipant[],
    round: number
  ): Promise<void> {
    let matchNum = 1;
    for (let i = 0; i < participants.length - 1; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        await TournamentRepository.createMatch(
          tournamentId, round, matchNum++,
          participants[i].user_id, participants[j].user_id
        );
      }
    }
  }

  /**
   * Record a match result and advance the bracket if all matches in the
   * current round are complete.
   */
  static async recordMatchResult(
    matchId: string,
    winnerId: string,
    p1Score: number,
    p2Score: number
  ): Promise<void> {
    const match = await db.oneOrNone<TournamentMatch>(
      'SELECT * FROM tournament_matches WHERE id = $1',
      [matchId]
    );
    if (!match) throw new Error('MATCH_NOT_FOUND');

    await TournamentRepository.saveMatchResult(matchId, winnerId, p1Score, p2Score);

    // Mark loser as eliminated
    const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
    if (loserId) {
      await db.none(
        `UPDATE tournament_participants
            SET eliminated_round = (
              SELECT current_round FROM tournaments WHERE id = $1
            )
          WHERE tournament_id = $1 AND user_id = $2`,
        [match.tournament_id, loserId]
      );
    }

    // Check if the round is complete
    const { pending } = await db.one<{ pending: number }>(
      `SELECT COUNT(*) AS pending
         FROM tournament_matches
        WHERE tournament_id = $1
          AND round_number  = $2
          AND status NOT IN ('completed', 'bye')`,
      [match.tournament_id, match.round_number]
    );

    if (Number(pending) === 0) {
      await TournamentService.advanceBracket(match.tournament_id);
    }
  }

  /** Generate the next round's matches from round winners. */
  private static async advanceBracket(tournamentId: string): Promise<void> {
    const detail = await TournamentRepository.getById(tournamentId);
    if (!detail) return;

    // Collect winners of the last round
    const winners = detail.matches
      .filter((m) => m.status === 'completed' && m.winner_id)
      .sort((a, b) => a.match_number - b.match_number)
      .map((m) => m.winner_id!);

    if (winners.length < 2) {
      // Tournament over — assign final placements
      await TournamentService.finalizeTournament(tournamentId, winners[0] ?? null);
      return;
    }

    await TournamentRepository.advanceRound(tournamentId);
    const nextRound = detail.current_round + 1;

    for (let i = 0; i < winners.length; i += 2) {
      await TournamentRepository.createMatch(
        tournamentId,
        nextRound,
        Math.floor(i / 2) + 1,
        winners[i],
        winners[i + 1] ?? null
      );
    }
  }

  private static async finalizeTournament(
    tournamentId: string,
    championId: string | null
  ): Promise<void> {
    await TournamentRepository.updateStatus(tournamentId, 'completed');
    if (!championId) return;
    await db.none(
      `UPDATE tournament_participants
          SET final_placement = 1
        WHERE tournament_id = $1 AND user_id = $2`,
      [tournamentId, championId]
    );
    await db.none(
      `UPDATE tournaments SET ended_at = NOW() WHERE id = $1`,
      [tournamentId]
    );
  }

  private static nextPowerOfTwo(n: number): number {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }
}
