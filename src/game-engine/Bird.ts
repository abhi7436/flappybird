export interface BirdConfig {
  x: number;
  y: number;
  width?: number;
  height?: number;
  gravity?: number;
  jumpStrength?: number;
}

export interface BirdState {
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: number;
  rotation: number; // degrees, for rendering tilt
}

export class Bird {
  static readonly DEFAULT_JUMP_STRENGTH = -9;

  private state: BirdState;
  private gravity: number;
  private jumpStrength: number;

  constructor(config: BirdConfig) {
    this.gravity = config.gravity ?? 0.5;
    this.jumpStrength = config.jumpStrength ?? -9;
    this.state = {
      x: config.x,
      y: config.y,
      width: config.width ?? 34,
      height: config.height ?? 24,
      velocity: 0,
      rotation: 0,
    };
  }

  /** Pure physics step — no rendering concern. */
  update(deltaMs: number): void {
    // Frame-rate independent physics (normalised to 60 FPS)
    const dt = deltaMs / (1000 / 60);
    this.state.velocity += this.gravity * dt;
    this.state.y += this.state.velocity * dt;

    // Clamp rotation between -30° (nose up) and +90° (nose down)
    this.state.rotation = Math.min(90, Math.max(-30, this.state.velocity * 3));
  }

  clampToTop(minY = 0): void {
    if (this.state.y >= minY) return;

    this.state.y = minY;
    if (this.state.velocity < 0) this.state.velocity = 0;
    this.state.rotation = Math.max(this.state.rotation, -15);
  }

  jump(): void {
    this.state.velocity = this.jumpStrength;
  }

  /** Set gravity (used by difficulty scaling). */
  setGravity(gravity: number): void {
    this.gravity = gravity;
  }

  /** Override jump velocity (used by turbo-jump effect). */
  setJumpStrength(strength: number): void {
    this.jumpStrength = strength;
  }

  /**
   * Nudge the bird's vertical velocity — used by the wind event.
   * Positive dv = pushes downward; negative = upward.
   */
  addVerticalVelocity(dv: number): void {
    this.state.velocity += dv;
  }

  getState(): Readonly<BirdState> {
    return this.state;
  }

  /** Axis-aligned bounding box — used for floor/ceiling and power-up tests. */
  getBounds(): { top: number; bottom: number; left: number; right: number } {
    return {
      top:    this.state.y,
      bottom: this.state.y + this.state.height,
      left:   this.state.x,
      right:  this.state.x + this.state.width,
    };
  }

  /**
   * Tight circular hitbox centred on the bird's body mass.
   *
   * The visual sprite is ~34×24 px. The body core is narrower than the
   * sprite to avoid beak/tip collisions — we bias the circle slightly
   * rearwards and reduce the radius for a tighter, more forgiving hitbox.
   *
   *   cx  = left edge + 40% of width   (slightly rear of previous centre)
   *   cy  = top  edge + 50% of height
   *   r   = height × 0.30
   */
  getCircleHitbox(): { cx: number; cy: number; r: number } {
    return {
      cx: this.state.x + this.state.width  * 0.30,
      cy: this.state.y + this.state.height * 0.20,
      r:  this.state.height * 0.20,
    };
  }

  reset(x: number, y: number): void {
    this.state.y = y;
    this.state.x = x;
    this.state.velocity = 0;
    this.state.rotation = 0;
  }
}