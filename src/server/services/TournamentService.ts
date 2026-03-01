// ============================================================
// TournamentService — Bracket generation, match creation,
//                     and round advancement logic.
// Supports: single-elimination, round-robin.
// ============================================================

import { Types } from 'mongoose';
import { TournamentParticipantModel, TournamentMatchModel, TournamentModel } from '../database/models';
import { TournamentRepository } from '../repositories/TournamentRepository';
import { TournamentRecord, TournamentParticipant, TournamentMatch } from '../types';

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

    // Bulk-update seeds
    await Promise.all(
      sorted.map((p, i) =>
        TournamentParticipantModel.updateOne(
          { _id: new Types.ObjectId(p.id) },
          { $set: { seed: i + 1 } }
        )
      )
    );

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
    const matchDoc = await TournamentMatchModel.findById(new Types.ObjectId(matchId));
    if (!matchDoc) throw new Error('MATCH_NOT_FOUND');
    const match: TournamentMatch = (matchDoc.toJSON() as Record<string, unknown>) as unknown as TournamentMatch;
    Object.assign(match, {
      id:            String((matchDoc.toJSON() as Record<string, unknown>)['id']),
      tournament_id: String((matchDoc.toJSON() as Record<string, unknown>)['tournament_id']),
      player1_id:    matchDoc.player1_id ? matchDoc.player1_id.toString() : null,
      player2_id:    matchDoc.player2_id ? matchDoc.player2_id.toString() : null,
    });

    await TournamentRepository.saveMatchResult(matchId, winnerId, p1Score, p2Score);

    // Mark loser as eliminated
    const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
    if (loserId) {
      const detail = await TournamentRepository.getById(match.tournament_id);
      if (detail) {
        await TournamentParticipantModel.updateOne(
          { tournament_id: new Types.ObjectId(match.tournament_id), user_id: new Types.ObjectId(loserId) },
          { $set: { eliminated_round: detail.current_round } }
        );
      }
    }

    // Check if the round is complete
    const pending = await TournamentMatchModel.countDocuments({
      tournament_id: matchDoc.tournament_id,
      round_number:  matchDoc.round_number,
      status:        { $nin: ['completed', 'bye'] },
    });

    if (pending === 0) {
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
    await TournamentParticipantModel.updateOne(
      { tournament_id: new Types.ObjectId(tournamentId), user_id: new Types.ObjectId(championId) },
      { $set: { final_placement: 1 } }
    );
    await TournamentModel.updateOne(
      { _id: new Types.ObjectId(tournamentId) },
      { $set: { ended_at: new Date(), updated_at: new Date() } }
    );
  }

  private static nextPowerOfTwo(n: number): number {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }
}
