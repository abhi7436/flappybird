// ============================================================
// ReplayRecorder — captures timestamped input events so a full
// match can be deterministically reproduced by re-feeding them
// into GameEngine with the same initial seed.
// ============================================================

export type ReplayEventType = 'jump' | 'start' | 'game_over';

export interface ReplayEvent {
  t: number;        // ms elapsed since game start
  type: ReplayEventType;
}

export interface ReplayData {
  /** Monotonic ms timestamp of first tick. */
  startedAt: number;
  /** Total elapsed ms. */
  durationMs: number;
  /** Ordered input events. */
  events: ReplayEvent[];
  /** Canvas dimensions used during the original run. */
  canvasWidth: number;
  canvasHeight: number;
  /** Seeded random used for pipe gapY — lets replay reproduce pipe positions. */
  seed: number;
  /** Final score. */
  finalScore: number;
  /** Engine version — bump when physics change to prevent mis-replays. */
  engineVersion: string;
}

export const ENGINE_VERSION = '2';

export class ReplayRecorder {
  private events: ReplayEvent[] = [];
  private startedAt = 0;
  private started = false;

  start(nowMs: number): void {
    this.startedAt = nowMs;
    this.started = true;
    this.events = [{ t: 0, type: 'start' }];
  }

  recordJump(nowMs: number): void {
    if (!this.started) return;
    this.events.push({ t: nowMs - this.startedAt, type: 'jump' });
  }

  finish(nowMs: number, finalScore: number, canvasWidth: number, canvasHeight: number, seed: number): ReplayData {
    this.events.push({ t: nowMs - this.startedAt, type: 'game_over' });
    return {
      startedAt:     this.startedAt,
      durationMs:    nowMs - this.startedAt,
      events:        [...this.events],
      canvasWidth,
      canvasHeight,
      seed,
      finalScore,
      engineVersion: ENGINE_VERSION,
    };
  }

  reset(): void {
    this.events = [];
    this.startedAt = 0;
    this.started = false;
  }
}
