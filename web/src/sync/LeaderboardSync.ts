/**
 * LeaderboardSync — pure utility for merging server leaderboard payloads.
 *
 * Extracted from useWebSocket's inline handler so it can be unit-tested
 * independently and reused in any component or hook.
 */

import type { LeaderboardEntry, LeaderboardUpdate } from '../types';

export class LeaderboardSync {
  /**
   * Merge a raw server update with the current client-side leaderboard.
   *
   * - Computes `previousRank` from `current` so the UI can animate rank changes.
   * - Normalises the `isAlive` field (server may send `alive` instead).
   *
   * @param update  Raw payload from the 'leaderboard_update' socket event.
   * @param current The leaderboard entries currently held by the client.
   * @returns       A new array ready to be written into the store.
   */
  static process(
    update:  LeaderboardUpdate,
    current: LeaderboardEntry[],
  ): LeaderboardEntry[] {
    const prevRankMap = new Map<string, number>(
      current.map((e) => [e.userId, e.rank]),
    );

    return update.entries.map((e) => ({
      ...e,
      isAlive:      e.isAlive ?? (e as any).alive ?? true,
      previousRank: prevRankMap.get(e.userId) ?? null,
    }));
  }
}
