/**
 * ParticleSystem — canonical interfaces and per-frame tick helpers for all
 * canvas particles used across the game.
 *
 * Keeping these types here (rather than scattered in renderer files) lets every
 * renderer import the same shapes without circular deps.
 */

// ── Base interface ────────────────────────────────────────────────────────────

/** Anything that lives for a finite number of frames and has a 2-D position. */
export interface Particle {
  x:        number;
  y:        number;
  vx:       number;
  vy:       number;
  life:     number; // remaining lifetime in frames (0 = dead)
  maxLife:  number;
  /** Opacity derived from life ratio — convenience getter. */
  readonly alpha: number;
}

// ── Sweat drop ───────────────────────────────────────────────────────────────

export interface SweatDrop extends Particle {
  radius: number;
}

/** Spawn a sweat drop relative to the bird's head. */
export function createSweatDrop(birdX: number, birdY: number): SweatDrop {
  const life = 18 + Math.floor(Math.random() * 8);
  return {
    x:       birdX + 14 + Math.random() * 6,
    y:       birdY + 4  + Math.random() * 4,
    vx:      0.4 + Math.random() * 0.4,
    vy:      -0.5 - Math.random() * 0.3,
    life,
    maxLife: life,
    radius:  2 + Math.random() * 1.5,
    get alpha() { return this.life / this.maxLife; },
  };
}

/** Advance a sweat drop one frame. Returns false when dead. */
export function tickSweatDrop(d: SweatDrop): boolean {
  d.x  += d.vx;
  d.y  += d.vy;
  d.vy += 0.06; // gravity
  d.life--;
  return d.life > 0;
}

// ── Fire particle ─────────────────────────────────────────────────────────────

export interface FireParticle extends Particle {
  size:  number;
  color: string; // CSS colour — rotates yellow → orange → red as life decays
}

const FIRE_COLORS = ['#fff7aa', '#ffe566', '#ff9900', '#ff4400', '#cc2200'] as const;

/** Spawn a fire particle at the given position (e.g. bird's tail). */
export function createFireParticle(x: number, y: number): FireParticle {
  const life = 10 + Math.floor(Math.random() * 8);
  return {
    x,
    y,
    vx:      -1.5 - Math.random() * 1.5,
    vy:      (Math.random() - 0.5) * 1.2,
    life,
    maxLife: life,
    size:    3 + Math.random() * 3,
    color:   FIRE_COLORS[0],
    get alpha() { return this.life / this.maxLife; },
  };
}

/** Advance a fire particle one frame. Returns false when dead. */
export function tickFireParticle(p: FireParticle): boolean {
  p.x    += p.vx;
  p.y    += p.vy;
  p.size *= 0.90;
  p.life--;
  // Update colour based on remaining life fraction
  const idx = Math.floor((1 - p.life / p.maxLife) * (FIRE_COLORS.length - 1));
  p.color = FIRE_COLORS[Math.min(idx, FIRE_COLORS.length - 1)];
  return p.life > 0 && p.size > 0.5;
}

// ── Batch helpers ─────────────────────────────────────────────────────────────

/** In-place tick + compact for any Particle array. */
export function tickParticles<T extends Particle>(
  particles: T[],
  tickFn: (p: T) => boolean,
): void {
  let write = 0;
  for (let i = 0; i < particles.length; i++) {
    if (tickFn(particles[i])) {
      particles[write++] = particles[i];
    }
  }
  particles.length = write;
}
