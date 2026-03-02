// ============================================================
// RandomEvents — periodic surprising world events
//
// Fired via callbacks; the rendering layer owns the visual side.
// The engine only owns physics consequences (e.g. wind vy delta).
// ============================================================

export type RandomEventType = 'wind' | 'fog' | 'lightning' | 'night_switch';

export interface RandomEvent {
  type:       RandomEventType;
  startMs:    number;
  duration:   number;
  /** For wind: signed vertical force per frame (positive = downward push). */
  windForce?: number;
}

// ── Tuning ───────────────────────────────────────────────────────────────
const MIN_SCORE_BEFORE_EVENTS = 5;   // no events until player is warmed up
const EVENT_COOLDOWN_MS       = 14_000;
const EVENT_CHANCE_PER_TICK   = 0.006;  // ~1 / (60 * 2.8) ≈ every ~3 s opportunity window

const EVENT_TYPES: RandomEventType[] = ['wind', 'fog', 'lightning', 'night_switch'];

const EVENT_DURATIONS: Record<RandomEventType, number> = {
  wind:         3_500,
  fog:          6_000,
  lightning:    350,
  night_switch: 30_000,
};

// ─────────────────────────────────────────────────────────────────────────

export class RandomEvents {
  private activeEvents: Map<RandomEventType, RandomEvent> = new Map();
  private lastEventMs:  number = 0;
  private rand:         () => number;
  private onEvent:      (e: RandomEvent) => void;
  private onEventEnd:   (type: RandomEventType) => void;

  constructor(
    rand:       () => number,
    onEvent:    (e: RandomEvent) => void,
    onEventEnd: (type: RandomEventType) => void,
  ) {
    this.rand       = rand;
    this.onEvent    = onEvent;
    this.onEventEnd = onEventEnd;
  }

  /**
   * Call every engine tick.
   * @param nowMs     Current timestamp (ms).
   * @param score     Current score (events are gated on min score).
   * @param windBoost Multiplier applied to event spawn chance (default 1).
   * @returns signed vertical velocity delta to apply to the bird this frame.
   */
  tick(nowMs: number, score: number, windBoost = 1): number {
    let windVyDelta = 0;

    // Maybe spawn new event
    if (
      score >= MIN_SCORE_BEFORE_EVENTS &&
      nowMs - this.lastEventMs > EVENT_COOLDOWN_MS / Math.max(1, windBoost) &&
      this.rand() < EVENT_CHANCE_PER_TICK * windBoost
    ) {
      // Don't re-fire an already-active event type
      const available = EVENT_TYPES.filter(t => !this.activeEvents.has(t));
      if (available.length > 0) {
        const type      = available[Math.floor(this.rand() * available.length)];
        const duration  = EVENT_DURATIONS[type];
        const windForce = type === 'wind'
          ? (this.rand() > 0.5 ? 0.055 : -0.055)
          : 0;
        const event: RandomEvent = { type, startMs: nowMs, duration, windForce };
        this.activeEvents.set(type, event);
        this.onEvent(event);
        this.lastEventMs = nowMs;
      }
    }

    // Expire events, accumulate wind
    for (const [type, ev] of this.activeEvents) {
      if (nowMs - ev.startMs >= ev.duration) {
        this.activeEvents.delete(type);
        this.onEventEnd(type);
      } else if (type === 'wind' && ev.windForce) {
        windVyDelta = ev.windForce;
      }
    }

    return windVyDelta;
  }

  isActive(type: RandomEventType): boolean {
    return this.activeEvents.has(type);
  }

  reset(): void {
    this.activeEvents.clear();
    this.lastEventMs = 0;
  }
}
