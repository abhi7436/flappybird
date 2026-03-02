/**
 * DifficultyManager
 * ─────────────────
 * Single source-of-truth for all difficulty parameters.
 *
 * Tier progression (Phase 6):
 *   Tier 0 (score  0–24)  — Normal: baseline physics, no music
 *   Tier 1 (score 25–49)  — HARD UNLOCK (score ≥ 25):
 *                             pipe speed  +20 %
 *                             pipe gap    −15 %
 *                             gravity     +10 %
 *                             moving pipes (oscillation) ON
 *                             random vertical variance unlocked
 *                             dark background ON
 *                             background music intensity 1
 *                             wind events 3.5× more frequent
 *                             pipe spawn distance −14 %
 *   Tier 2 (score 50–79)  — INSANE (score ≥ 50):
 *                             double obstacle pattern ON
 *                             faster scroll (+48 %)
 *                             more bugs with extreme y-positioning
 *                             music intensity 2
 *   Tier 3 (score 80+)    — MAXIMUM: everything cranked
 */

// ── Base constants (shared with GameEngine) ───────────────────────────────
export const BASE_PIPE_SPEED = 3;
export const BASE_GAP_HEIGHT = 150;
export const BASE_GRAVITY    = 0.45;
export const MIN_GAP_HEIGHT  = 60;

const BASE_OSCILLATION_AMPLITUDE = 30;    // px at tier 1
const OSCILLATION_SPEED          = 0.002; // radians/ms

// ─────────────────────────────────────────────────────────────────────────

export interface DifficultySettings {
  pipeSpeed:            number;
  gapHeight:            number;
  gravity:              number;
  oscillating:          boolean;
  oscillationAmplitude: number;
  oscillationSpeed:     number;
  verticalVariance:     number;

  // ── Phase 6 ─────────────────────────────────────────────────────────
  /** Minimum pixel gap between consecutive pipe lead edges. */
  pipeSpawnDistance:    number;
  /** Probability a bug spawns per eligible frame. */
  bugSpawnChance:       number;
  /** When true, bugs spawn at upper / lower extremes only. */
  hardBugPositions:     boolean;
  /** When true, SpawnManager emits two paired bugs per spawn event. */
  bugDoubled:           boolean;
  /** Forces a permanent dark-tinted overlay on the canvas. */
  isDarkMode:           boolean;
  /** 0 = none | 1 = ominous beat | 2 = frantic beat */
  musicIntensity:       0 | 1 | 2;
  /** Multiplier applied to random-event spawn chance (1 = normal). */
  windEventBoost:       number;
}

// ─────────────────────────────────────────────────────────────────────────

export class DifficultyManager {
  static readonly BASE_PIPE_SPEED = BASE_PIPE_SPEED;
  static readonly BASE_GAP_HEIGHT = BASE_GAP_HEIGHT;
  static readonly BASE_GRAVITY    = BASE_GRAVITY;
  static readonly MIN_GAP_HEIGHT  = MIN_GAP_HEIGHT;

  /**
   * Tier breakpoints:
   *   0 → score  0–24  (Normal)
   *   1 → score 25–49  (Hard)
   *   2 → score 50–79  (Insane)
   *   3 → score 80+    (MAXIMUM)
   */
  static getTier(score: number): number {
    if (score < 25) return 0;
    if (score < 50) return 1;
    if (score < 80) return 2;
    return 3;
  }

  static getSettings(tier: number): DifficultySettings {
    switch (tier) {
      // ── Tier 0 ─ Normal ──────────────────────────────────────────────
      case 0: return {
        pipeSpeed:            BASE_PIPE_SPEED,
        gapHeight:            BASE_GAP_HEIGHT,
        gravity:              BASE_GRAVITY,
        oscillating:          false,
        oscillationAmplitude: 0,
        oscillationSpeed:     OSCILLATION_SPEED,
        verticalVariance:     0,
        pipeSpawnDistance:    280,
        bugSpawnChance:       0.20,
        hardBugPositions:     false,
        bugDoubled:           false,
        isDarkMode:           false,
        musicIntensity:       0,
        windEventBoost:       1,
      };

      // ── Tier 1 ─ Hard (score 25–49) ──────────────────────────────────
      case 1: return {
        pipeSpeed:            BASE_PIPE_SPEED * 1.20,
        gapHeight:            Math.max(MIN_GAP_HEIGHT, BASE_GAP_HEIGHT * 0.85),
        gravity:              BASE_GRAVITY    * 1.10,
        oscillating:          true,
        oscillationAmplitude: BASE_OSCILLATION_AMPLITUDE,
        oscillationSpeed:     OSCILLATION_SPEED,
        verticalVariance:     40,
        pipeSpawnDistance:    240,
        bugSpawnChance:       0.28,
        hardBugPositions:     false,
        bugDoubled:           false,
        isDarkMode:           true,
        musicIntensity:       1,
        windEventBoost:       3.5,
      };

      // ── Tier 2 ─ Insane (score 50–79) ────────────────────────────────
      case 2: return {
        pipeSpeed:            BASE_PIPE_SPEED * 1.48,
        gapHeight:            Math.max(MIN_GAP_HEIGHT, BASE_GAP_HEIGHT * 0.68),
        gravity:              BASE_GRAVITY    * 1.22,
        oscillating:          true,
        oscillationAmplitude: BASE_OSCILLATION_AMPLITUDE + 20,
        oscillationSpeed:     OSCILLATION_SPEED,
        verticalVariance:     65,
        pipeSpawnDistance:    200,
        bugSpawnChance:       0.42,
        hardBugPositions:     true,
        bugDoubled:           true,
        isDarkMode:           true,
        musicIntensity:       2,
        windEventBoost:       5,
      };

      // ── Tier 3 ─ MAXIMUM (score 80+) ─────────────────────────────────
      default: return {
        pipeSpeed:            BASE_PIPE_SPEED * 1.78,
        gapHeight:            MIN_GAP_HEIGHT,
        gravity:              BASE_GRAVITY    * 1.38,
        oscillating:          true,
        oscillationAmplitude: BASE_OSCILLATION_AMPLITUDE + 40,
        oscillationSpeed:     OSCILLATION_SPEED * 1.3,
        verticalVariance:     90,
        pipeSpawnDistance:    175,
        bugSpawnChance:       0.52,
        hardBugPositions:     true,
        bugDoubled:           true,
        isDarkMode:           true,
        musicIntensity:       2,
        windEventBoost:       8,
      };
    }
  }

  /** Short label shown in HUD. */
  static getLabel(tier: number): string {
    const labels = ['Normal', 'Hard', 'Insane', 'MAXIMUM'];
    return labels[Math.min(tier, labels.length - 1)];
  }
}

// Convenience re-export
export function getDifficultyTier(score: number): number {
  return DifficultyManager.getTier(score);
}
