/**
 * ScoreBroadcaster — rate-limited score coalescing over WebSocketManager.
 *
 * The game engine can call update() many times per second, but we only emit
 * to the server at most once every `intervalMs` to avoid flooding the WS.
 * Always call flush() just before emitting game_over so the final score is
 * never dropped.
 */

import { WebSocketManager } from './WebSocketManager';

export class ScoreBroadcaster {
  private wsm:        WebSocketManager;
  private roomId:     string;
  private intervalMs: number;

  private pending:  number | null = null; // latest score not yet sent
  private timer:    ReturnType<typeof setTimeout> | null = null;

  constructor(wsm: WebSocketManager, roomId: string, intervalMs = 150) {
    this.wsm        = wsm;
    this.roomId     = roomId;
    this.intervalMs = intervalMs;
  }

  /**
   * Coalesce a score update. If no timer is running, emit immediately and arm
   * a cooldown. If a timer is already running, just keep the latest value.
   */
  update(score: number): void {
    this.pending = score;
    if (this.timer !== null) return; // already scheduled

    // Emit now and start cooldown
    this.wsm.emitScore(this.roomId, score);
    this.pending = null;
    this.timer = setTimeout(() => {
      this.timer = null;
      // If a value accumulated during the cooldown, flush it
      if (this.pending !== null) {
        const s = this.pending;
        this.pending = null;
        this.update(s);
      }
    }, this.intervalMs);
  }

  /**
   * Immediately send any pending score, bypassing the rate limit.
   * Call this right before emitting game_over.
   */
  flush(): void {
    if (this.pending !== null) {
      this.wsm.emitScore(this.roomId, this.pending);
      this.pending = null;
    }
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Clean up timer on unmount. */
  destroy(): void {
    this.flush();
  }
}
