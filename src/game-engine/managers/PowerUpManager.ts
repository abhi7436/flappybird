/**
 * PowerUpManager — owns all active power-up effect state.
 *
 * Extracted from GameEngine so that effect logic lives in one place and is
 * independently testable. GameEngine holds one instance and delegates every
 * effect-related operation through this class.
 */
import { PowerUpType, POWERUP_DURATIONS } from '../PowerUp';

export interface ActiveEffect {
  type:      PowerUpType;
  expiresAt: number; // epoch ms; 0 = permanent until explicitly consumed
}

export class PowerUpManager {
  private effects: Map<PowerUpType, number>; // type → expiresAt

  constructor() {
    this.effects = new Map();
  }

  // ── Lifecycle ────────────────────────────────────────────

  reset(): void {
    this.effects = new Map();
  }

  // ── Mutators ─────────────────────────────────────────────

  /**
   * Activate (or refresh) a power-up effect.
   * Duration comes from POWERUP_DURATIONS; 0 duration = permanent.
   */
  activate(type: PowerUpType, nowMs: number): void {
    const duration  = POWERUP_DURATIONS[type] ?? 0;
    const expiresAt = duration > 0 ? nowMs + duration : 0;
    this.effects.set(type, expiresAt);
  }

  /** Consume (remove) a single effect immediately, e.g. shield absorbing a hit. */
  consume(type: PowerUpType): void {
    this.effects.delete(type);
  }

  // ── Read-only queries ─────────────────────────────────────

  isActive(type: PowerUpType): boolean {
    return this.effects.has(type);
  }

  /** Snapshot for GameState serialisation. */
  getAll(): ActiveEffect[] {
    const out: ActiveEffect[] = [];
    for (const [type, expiresAt] of this.effects) {
      out.push({ type, expiresAt });
    }
    return out;
  }

  // ── Convenience multipliers ───────────────────────────────

  /** Speed multiplier for pipe / entity movement. */
  getSpeedMultiplier(): number {
    if (this.isActive('slow_motion')) return 0.25;
    if (this.isActive('slow_pipes'))  return 0.45;
    return 1;
  }

  /** Score multiplier applied per-pipe pass. */
  getScoreMultiplier(): number {
    if (this.isActive('golden_coin'))  return 3;
    if (this.isActive('double_score')) return 2;
    return 1;
  }

  // ── Tick ─────────────────────────────────────────────────

  /**
   * Expire timed effects whose deadline has passed.
   * Returns the list of effect types that just expired (so the caller can
   * react, e.g. restoring the bird's jump strength when turbo_jump ends).
   */
  tick(nowMs: number): PowerUpType[] {
    const expired: PowerUpType[] = [];
    for (const [type, expiresAt] of this.effects) {
      if (expiresAt > 0 && nowMs >= expiresAt) {
        this.effects.delete(type);
        expired.push(type);
      }
    }
    return expired;
  }
}
