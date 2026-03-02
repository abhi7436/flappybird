// ============================================================
// Bug entity — flying collectible that grants turbo boost
// ============================================================

export interface BugConfig {
  x:     number;
  y:     number;
  speed: number;
}

export interface BugState {
  id:        number;
  x:         number;
  y:         number;
  width:     number;
  height:    number;
  /** Wing animation phase [0–2π] for renderer */
  wingPhase: number;
  collected: boolean;
}

let nextId = 1;

export class Bug {
  private state:     BugState;
  private speed:     number;
  private baseY:     number;
  private bobPhase:  number;

  constructor(config: BugConfig) {
    this.speed    = config.speed;
    this.baseY    = config.y;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.state = {
      id:        nextId++,
      x:         config.x,
      y:         config.y,
      width:     20,
      height:    14,
      wingPhase: Math.random() * Math.PI * 2,
      collected: false,
    };
  }

  update(deltaMs: number): void {
    if (this.state.collected) return;
    const dt = deltaMs / (1000 / 60);
    this.state.x        -= this.speed * dt;
    this.bobPhase        = (this.bobPhase + 0.07 * dt) % (Math.PI * 2);
    this.state.y         = this.baseY + Math.sin(this.bobPhase) * 14;
    this.state.wingPhase = (this.state.wingPhase + 0.32 * dt) % (Math.PI * 2);
  }

  collect(): void {
    this.state.collected = true;
  }

  /**
   * Reset this instance for reuse from an ObjectPool.
   * Avoids allocation of a new Bug object.
   */
  reconfigure(config: BugConfig): void {
    this.speed    = config.speed;
    this.baseY    = config.y;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.state.x         = config.x;
    this.state.y         = config.y;
    this.state.collected = false;
    this.state.wingPhase = Math.random() * Math.PI * 2;
    // id is intentionally kept stable — pool instances retain their id
  }

  isOffScreen(): boolean {
    return this.state.x + this.state.width < 0;
  }

  getState(): Readonly<BugState> {
    return this.state;
  }

  getBounds(): { top: number; bottom: number; left: number; right: number } {
    const { x, y, width, height } = this.state;
    return { top: y, bottom: y + height, left: x, right: x + width };
  }
}
