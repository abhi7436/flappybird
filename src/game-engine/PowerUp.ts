// ============================================================
// PowerUp entity — pure physics, no rendering concern
// ============================================================

export type PowerUpType = 'shield' | 'slow_pipes' | 'double_score';

export interface PowerUpConfig {
  x: number;
  y: number;
  type: PowerUpType;
  speed: number;
}

export interface PowerUpState {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: PowerUpType;
  collected: boolean;
}

let nextId = 1;

/** Duration in milliseconds each power-up effect lasts. */
export const POWERUP_DURATIONS: Record<PowerUpType, number> = {
  shield:       0,      // instant — blocks one collision
  slow_pipes:   6_000,  // 6 seconds
  double_score: 10_000, // 10 seconds
};

export class PowerUp {
  private state: PowerUpState;
  private speed: number;

  constructor(config: PowerUpConfig) {
    this.speed = config.speed;
    this.state = {
      id: nextId++,
      x: config.x,
      y: config.y,
      width: 28,
      height: 28,
      type: config.type,
      collected: false,
    };
  }

  update(deltaMs: number): void {
    if (this.state.collected) return;
    const dt = deltaMs / (1000 / 60);
    this.state.x -= this.speed * dt;
  }

  collect(): void {
    this.state.collected = true;
  }

  isOffScreen(): boolean {
    return this.state.x + this.state.width < 0;
  }

  getState(): Readonly<PowerUpState> {
    return this.state;
  }

  getBounds(): { top: number; bottom: number; left: number; right: number } {
    return {
      top:    this.state.y,
      bottom: this.state.y + this.state.height,
      left:   this.state.x,
      right:  this.state.x + this.state.width,
    };
  }
}
