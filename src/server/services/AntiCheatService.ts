import { PlayerState } from '../types';

// ── Tuning constants ──────────────────────────────────────────
// At 60 FPS a pipe is passed roughly every 1.5-2 s in default difficulty.
// After difficulty bump (score ≥ 25) it can be slightly faster.
// We allow a generous 1 point/sec maximum rate with burst headroom.
const MAX_SCORE_RATE_PER_MS = 1 / 700; // ~1 pt per 700 ms
const MAX_SINGLE_INCREMENT = 1;         // score must increase by 1 at a time
const MAX_JUMP_INTERVAL_MS = 50;        // debounce: can't jump faster than this

interface AntiCheatResult {
  valid: boolean;
  reason?: string;
}

export class AntiCheatService {
  /** Validate a score_update event.
   *  Returns { valid: false, reason } if the update looks cheated.
   */
  static validateScoreUpdate(
    player: PlayerState,
    newScore: number
  ): AntiCheatResult {
    // 1. Score must be non-negative
    if (newScore < 0) {
      return { valid: false, reason: 'Negative score' };
    }

    // 2. Score must only go up (never decrease while alive)
    if (newScore < player.score) {
      return { valid: false, reason: 'Score decreased while alive' };
    }

    const increment = newScore - player.score;

    // 3. Score increments must be exactly 1 at a time
    if (increment > MAX_SINGLE_INCREMENT) {
      return {
        valid: false,
        reason: `Score jumped by ${increment}, expected sequential increment of 1`,
      };
    }

    // 4. Rate-limiting: blocks impossibly fast scoring
    const now = Date.now();
    const elapsed = now - player.lastScoreAt;

    if (increment > 0 && elapsed < 1 / MAX_SCORE_RATE_PER_MS) {
      return {
        valid: false,
        reason: `Score increasing too fast (${increment} pts in ${elapsed}ms)`,
      };
    }

    return { valid: true };
  }

  /** Validate a jump event.
   *  Rejects jumps that arrive faster than physically possible.
   */
  static validateJump(
    lastJumpAt: number,
    now: number = Date.now()
  ): AntiCheatResult {
    if (now - lastJumpAt < MAX_JUMP_INTERVAL_MS) {
      return {
        valid: false,
        reason: `Jump event too fast (${now - lastJumpAt}ms since last jump)`,
      };
    }
    return { valid: true };
  }
}
