// ============================================================
// PoopDrop entity — projectile dropped by the player
//
// Physics: falls with gravity from the bird's position.
// If it enters the gap of a nearby pipe it "hits" the pipe cap
// and widens that pipe's gap temporarily.
// If it reaches the ground it plays a splash.
// ============================================================

export interface PoopConfig {
  x: number;
  y: number;
}

export interface PoopState {
  id:       number;
  x:        number;
  y:        number;
  vy:       number;
  width:    number;
  height:   number;
  splashed: boolean;
  /** Y position where the splash happened (used by renderer). */
  splashY:  number;
  /** Timestamp (performance.now) of the splash, 0 if not splashed. */
  splashTs: number;
}

const POOP_GRAVITY = 0.55;   // pixels/frame² at 60 fps

let nextId = 1;

export class PoopDrop {
  private state: PoopState;

  constructor(config: PoopConfig) {
    this.state = {
      id:       nextId++,
      x:        config.x,
      y:        config.y,
      vy:       1.8,
      width:    16,
      height:   20,
      splashed: false,
      splashY:  0,
      splashTs: 0,
    };
  }

  update(deltaMs: number): void {
    if (this.state.splashed) return;
    const dt = deltaMs / (1000 / 60);
    this.state.vy += POOP_GRAVITY * dt;
    this.state.y  += this.state.vy * dt;
  }

  /** Call when poop lands on a pipe cap or the ground. */
  splash(nowMs: number, y?: number): void {
    if (this.state.splashed) return;
    this.state.splashed = true;
    this.state.splashY  = y ?? this.state.y;
    this.state.splashTs = nowMs;
  }

  isDone(nowMs: number): boolean {
    // Remove 900 ms after splash (animation duration) or if off-screen
    if (this.state.splashed) return nowMs - this.state.splashTs > 900;
    return false;
  }

  isOffScreen(canvasHeight: number): boolean {
    return this.state.y > canvasHeight + 30;
  }

  getState(): Readonly<PoopState> {
    return this.state;
  }

  getBounds(): { top: number; bottom: number; left: number; right: number } {
    const { x, y, width, height } = this.state;
    return { top: y, bottom: y + height, left: x, right: x + width };
  }
}
