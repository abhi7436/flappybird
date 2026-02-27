export interface PipeConfig {
  x: number;
  width?: number;
  gapY: number;
  gapHeight: number;
  speed: number;
  oscillating?: boolean;
  oscillationAmplitude?: number;
  oscillationSpeed?: number;
}

export interface PipeState {
  x: number;
  width: number;
  gapY: number;
  gapHeight: number;
  scored: boolean; // whether the bird has passed this pipe
}

export class Pipe {
  private state: PipeState;
  private speed: number;
  private oscillating: boolean;
  private oscillationAmplitude: number;
  private oscillationSpeed: number;
  private oscillationOffset: number;
  private elapsedMs: number;

  constructor(config: PipeConfig) {
    this.speed = config.speed;
    this.oscillating = config.oscillating ?? false;
    this.oscillationAmplitude = config.oscillationAmplitude ?? 40;
    this.oscillationSpeed = config.oscillationSpeed ?? 0.002;
    this.oscillationOffset = config.gapY;
    this.elapsedMs = 0;

    this.state = {
      x: config.x,
      width: config.width ?? 52,
      gapY: config.gapY,
      gapHeight: config.gapHeight,
      scored: false,
    };
  }

  /** Pure physics step. */
  update(deltaMs: number): void {
    const dt = deltaMs / (1000 / 60);
    this.state.x -= this.speed * dt;

    if (this.oscillating) {
      this.elapsedMs += deltaMs;
      this.state.gapY =
        this.oscillationOffset +
        Math.sin(this.elapsedMs * this.oscillationSpeed) *
          this.oscillationAmplitude;
    }
  }

  isOffScreen(): boolean {
    return this.state.x + this.state.width < 0;
  }

  markScored(): void {
    this.state.scored = true;
  }

  getState(): Readonly<PipeState> {
    return this.state;
  }

  /** Returns top and bottom pipe bounds for collision detection. */
  getBounds(): {
    top: { left: number; right: number; top: number; bottom: number };
    bottom: { left: number; right: number; top: number; bottom: number };
  } {
    const { x, width, gapY, gapHeight } = this.state;
    return {
      top: { left: x, right: x + width, top: 0, bottom: gapY },
      bottom: {
        left: x,
        right: x + width,
        top: gapY + gapHeight,
        bottom: Infinity,
      },
    };
  }
}