/**
 * EventManager — thin facade over RandomEvents that exposes a typed
 * callback interface and makes it easy to swap the underlying implementation.
 *
 * Keeping this wrapper means GameEngine doesn't import RandomEvents directly,
 * and random-event logic can be changed or mocked without touching GameEngine.
 */
import { RandomEvents, RandomEvent, RandomEventType } from '../RandomEvents';

// Re-export for consumers who only import from managers/
export type { RandomEvent, RandomEventType };

export interface EventManagerCallbacks {
  onEvent:    (e: RandomEvent) => void;
  onEventEnd: (type: RandomEventType) => void;
}

export class EventManager {
  private events: RandomEvents;

  constructor(rand: () => number, callbacks: EventManagerCallbacks) {
    this.events = new RandomEvents(
      rand,
      callbacks.onEvent,
      callbacks.onEventEnd,
    );
  }

  /**
   * Advance random-events logic for this tick.
   * @param windBoost Multiplier from DifficultySettings (default 1 = normal rate).
   * @returns a vertical-velocity delta (wind force) to apply to the bird.
   */
  tick(timestamp: number, score: number, windBoost = 1): number {
    return this.events.tick(timestamp, score, windBoost);
  }

  reset(): void {
    this.events.reset();
  }
}
