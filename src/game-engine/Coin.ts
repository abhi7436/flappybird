// ============================================================
// Coin entity — collectible spawned between pipes
// ============================================================

export type CoinType = 'normal' | 'golden';

export interface CoinConfig {
  x:     number;
  y:     number;
  type:  CoinType;
  speed: number;
}

export interface CoinState {
  id:        number;
  x:         number;
  y:         number;
  width:     number;
  height:    number;
  type:      CoinType;
  collected: boolean;
  /** Animation phase [0–2π], driven by engine for shimmer/bob rendering */
  phase:     number;
}

let nextId = 1;

export class Coin {
  private state: CoinState;
  private speed: number;
  private baseY:  number;

  constructor(config: CoinConfig) {
    this.speed = config.speed;
    this.baseY = config.y;
    const size = config.type === 'golden' ? 24 : 16;
    this.state = {
      id:        nextId++,
      x:         config.x,
      y:         config.y,
      width:     size,
      height:    size,
      type:      config.type,
      collected: false,
      phase:     Math.random() * Math.PI * 2,
    };
  }

  update(deltaMs: number): void {
    if (this.state.collected) return;
    const dt = deltaMs / (1000 / 60);
    this.state.x     -= this.speed * dt;
    this.state.phase  = (this.state.phase + 0.05 * dt) % (Math.PI * 2);
    // Gentle vertical bob
    this.state.y = this.baseY + Math.sin(this.state.phase) * 5;
  }

  /** Magnet attraction — pull coin toward (tx, ty). */
  attractTo(tx: number, ty: number, deltaMs: number): void {
    if (this.state.collected) return;
    const dt = deltaMs / (1000 / 60);
    const cx = this.state.x + this.state.width  / 2;
    const cy = this.state.y + this.state.height / 2;
    const dx = tx - cx;
    const dy = ty - cy;
    const strength = 0.10 * dt;
    this.state.x += dx * strength;
    this.state.y += dy * strength;
  }

  collect(): void {
    this.state.collected = true;
  }

  /**
   * Reset this instance for reuse from an ObjectPool.
   * Avoids allocation of a new Coin object.
   */
  reconfigure(config: CoinConfig): void {
    this.speed  = config.speed;
    this.baseY  = config.y;
    const size  = config.type === 'golden' ? 24 : 16;
    this.state.x         = config.x;
    this.state.y         = config.y;
    this.state.width     = size;
    this.state.height    = size;
    this.state.type      = config.type;
    this.state.collected = false;
    this.state.phase     = Math.random() * Math.PI * 2;
    // id is intentionally kept stable — pool instances retain their id
  }

  isOffScreen(): boolean {
    return this.state.x + this.state.width < 0;
  }

  getState(): Readonly<CoinState> {
    return this.state;
  }

  getBounds(): { top: number; bottom: number; left: number; right: number } {
    const { x, y, width, height } = this.state;
    return { top: y, bottom: y + height, left: x, right: x + width };
  }
}
