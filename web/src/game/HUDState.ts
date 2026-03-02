/**
 * HUDState — immutable value-object representing everything the HUD needs
 * to display in a single frame.
 *
 * Centralises the derivation logic so neither GameCanvas.tsx nor SoloCanvas.tsx
 * need to compute rank / isLeader / activePowerUps inline.
 */

import type { ActiveEffect } from '@engine/GameEngine';
import type { PowerUpType }  from '@engine/PowerUp';

// ── Type ─────────────────────────────────────────────────────────────────────

export interface HUDState {
  /** Current player score. */
  score:         number;
  /** Elapsed game time in seconds (rounded). */
  timeElapsed:   number;
  /** Current coin streak (consecutive coins without missing). */
  coinStreak:    number;
  /** Player rank (1-based). Null in solo mode. */
  rank:          number | null;
  /** Total players in the room. Null in solo mode. */
  totalPlayers:  number | null;
  /** True when rank === 1 and totalPlayers > 1. */
  isLeader:      boolean;
  /** Power-up types that are currently active. */
  activePowerUps: PowerUpType[];
}

// ── Builder ───────────────────────────────────────────────────────────────────

export interface BuildHUDStateParams {
  score:         number;
  gameStartMs:   number;
  nowMs:         number;
  coinStreak?:   number;
  rank?:         number | null;
  totalPlayers?: number | null;
  activeEffects: ActiveEffect[];
}

/**
 * Pure function — converts raw game state into a flat HUDState.
 * Safe to call every frame (no allocations beyond a small filter).
 */
export function buildHUDState(p: BuildHUDStateParams): HUDState {
  const timeElapsed  = Math.floor((p.nowMs - p.gameStartMs) / 1000);
  const coinStreak   = p.coinStreak ?? 0;
  const rank         = p.rank ?? null;
  const totalPlayers = p.totalPlayers ?? null;
  const isLeader     = rank === 1 && totalPlayers !== null && totalPlayers > 1;

  const activePowerUps: PowerUpType[] = p.activeEffects
    .filter((e) => e.expiresAt === 0 || e.expiresAt > p.nowMs)
    .map((e) => e.type);

  return { score: p.score, timeElapsed, coinStreak, rank, totalPlayers, isLeader, activePowerUps };
}
