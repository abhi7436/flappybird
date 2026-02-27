/**
 * DifficultyManager
 * ─────────────────
 * Single source-of-truth for all difficulty parameters.
 *
 * Tier progression:
 *   Tier 0 (score  0–24)  — normal, baseline physics
 *   Tier 1 (score 25–34)  — HARD UNLOCK:
 *                             pipe speed  +20 %
 *                             pipe gap    −15 %
 *                             gravity     +10 %
 *                             moving pipes (oscillation) ON
 *                             random vertical variance unlocked
 *   Tier N (score 25 + N×10) — each additional bracket:
 *                             speed       +8 % of base (cumulative)
 *                             gap         −5 % of base (floor-capped)
 *                             oscillation amplitude grows
 *                             vertical variance grows
 */

// ── Base constants (shared with GameEngine) ───────────────────────────────
export const BASE_PIPE_SPEED = 3;
export const BASE_GAP_HEIGHT = 150;
export const BASE_GRAVITY    = 0.45;
export const MIN_GAP_HEIGHT  = 60;

// ── Per-pipe oscillation defaults ────────────────────────────────────────
const BASE_OSCILLATION_AMPLITUDE = 30;     // px at tier 1
const OSCILLATION_AMPLITUDE_STEP = 8;      // extra px per additional tier
const OSCILLATION_SPEED          = 0.002;  // radians/ms

// ── Vertical variance (random gapY offset on spawn) ──────────────────────
const BASE_VERTICAL_VARIANCE     = 40;     // px at tier 1
const VERTICAL_VARIANCE_STEP     = 15;     // extra px per additional tier

// ── Speed increments ─────────────────────────────────────────────────────
/** Multiplier at tier 1 (the big unlock). */
const TIER1_SPEED_BOOST = 1.20;  // +20 %
/** Additional multiplier applied for each tier > 1 (slight increment). */
const EXTRA_SPEED_STEP  = 0.08;  // +8 % of base per tier

// ── Gap increments ────────────────────────────────────────────────────────
/** Fraction of BASE_GAP_HEIGHT removed per tier. */
const GAP_REDUCTION_PER_TIER = 0.15; // −15 % per tier

// ── Gravity increments ────────────────────────────────────────────────────
/** Multiplier at tier 1. */
const TIER1_GRAVITY_BOOST = 1.10; // +10 %
/** Additional gravity fraction of BASE added per tier > 1. */
const EXTRA_GRAVITY_STEP  = 0.05;

// ─────────────────────────────────────────────────────────────────────────

export interface DifficultySettings {
  /** Pixels per 60-fps frame that pipes move left. */
  pipeSpeed:            number;
  /** Height of the opening between top and bottom pipe. */
  gapHeight:            number;
  /** Downward acceleration constant. */
  gravity:              number;
  /** Whether newly spawned pipes should oscillate vertically. */
  oscillating:          boolean;
  /** Peak vertical displacement of oscillating pipes (px). */
  oscillationAmplitude: number;
  /** Angular speed of oscillation (radians/ms). */
  oscillationSpeed:     number;
  /**
   * Half-range of the random vertical offset applied to `gapY` at spawn (px).
   * Actual offset = rand(-v, +v).
   */
  verticalVariance:     number;
}

// ─────────────────────────────────────────────────────────────────────────

export class DifficultyManager {
  // ── Static base constants (exposed for tests / HUD display) ──────────
  static readonly BASE_PIPE_SPEED = BASE_PIPE_SPEED;
  static readonly BASE_GAP_HEIGHT = BASE_GAP_HEIGHT;
  static readonly BASE_GRAVITY    = BASE_GRAVITY;
  static readonly MIN_GAP_HEIGHT  = MIN_GAP_HEIGHT;

  // ── Tier derivation ───────────────────────────────────────────────────

  /**
   * Returns the 0-based difficulty tier for a given score.
   *
   * ```
   *  score  0 – 24  →  tier 0
   *  score 25 – 34  →  tier 1
   *  score 35 – 44  →  tier 2
   *  score 45 – 54  →  tier 3  …
   * ```
   */
  static getTier(score: number): number {
    if (score < 25) return 0;
    return Math.floor((score - 25) / 10) + 1;
  }

  // ── Settings factory ──────────────────────────────────────────────────

  /**
   * Returns the full parameter set for `tier`.
   *
   * All values are deterministic — the same tier always produces the
   * same settings, making replay reproducibility trivial.
   */
  static getSettings(tier: number): DifficultySettings {
    if (tier === 0) {
      return {
        pipeSpeed:            BASE_PIPE_SPEED,
        gapHeight:            BASE_GAP_HEIGHT,
        gravity:              BASE_GRAVITY,
        oscillating:          false,
        oscillationAmplitude: 0,
        oscillationSpeed:     OSCILLATION_SPEED,
        verticalVariance:     0,
      };
    }

    // ── Tier >= 1 ─────────────────────────────────────────────────────
    const extraTiers = tier - 1; // tiers beyond the initial hard-unlock

    // Speed: +20 % at tier 1, then an extra +8 % per tier
    const speedMultiplier = TIER1_SPEED_BOOST + extraTiers * EXTRA_SPEED_STEP;

    // Gap: −15 % per tier, clamped to MIN_GAP_HEIGHT
    const rawGap = BASE_GAP_HEIGHT * (1 - tier * GAP_REDUCTION_PER_TIER);
    const gapHeight = Math.max(MIN_GAP_HEIGHT, rawGap);

    // Gravity: +10 % at tier 1, then +5 % of base per additional tier
    const gravityMultiplier = TIER1_GRAVITY_BOOST + extraTiers * EXTRA_GRAVITY_STEP;

    // Oscillation amplitude grows each tier
    const oscillationAmplitude =
      BASE_OSCILLATION_AMPLITUDE + extraTiers * OSCILLATION_AMPLITUDE_STEP;

    // Vertical variance grows each tier
    const verticalVariance =
      BASE_VERTICAL_VARIANCE + extraTiers * VERTICAL_VARIANCE_STEP;

    return {
      pipeSpeed:            BASE_PIPE_SPEED  * speedMultiplier,
      gapHeight,
      gravity:              BASE_GRAVITY     * gravityMultiplier,
      oscillating:          true,
      oscillationAmplitude,
      oscillationSpeed:     OSCILLATION_SPEED,
      verticalVariance,
    };
  }

  // ── Human-readable label ──────────────────────────────────────────────

  /** Short label shown in the HUD (matches SoloCanvas DIFFICULTY_LABELS). */
  static getLabel(tier: number): string {
    const labels = ['Normal', 'Hard', 'Harder', 'Insane', 'MAXIMUM'];
    return labels[Math.min(tier, labels.length - 1)];
  }
}

// ── Convenience re-export (keeps `import { getDifficultyTier } from '@engine/GameEngine'` working) ──
export function getDifficultyTier(score: number): number {
  return DifficultyManager.getTier(score);
}
