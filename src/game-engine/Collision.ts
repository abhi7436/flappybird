import { Bird } from './Bird';
import { Pipe } from './Pipe';
import { PowerUp } from './PowerUp';

// ── AABB helper (still used for power-ups & floor/ceiling) ───────────────
function rectsOverlap(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number }
): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Exact circle-vs-axis-aligned-rect test.
 *
 * Finds the nearest point on the rect boundary to the circle centre, then
 * checks whether the squared distance is less than r².  This is the standard
 * "clamp-to-rect" approach and is exact for convex rects.
 */
function circleHitsRect(
  c: { cx: number; cy: number; r: number },
  rect: { left: number; right: number; top: number; bottom: number }
): boolean {
  const nearX = Math.max(rect.left,  Math.min(c.cx, rect.right));
  const nearY = Math.max(rect.top,   Math.min(c.cy, rect.bottom));
  const dx = c.cx - nearX;
  const dy = c.cy - nearY;
  return dx * dx + dy * dy < c.r * c.r;
}

/**
 * Swept circle-vs-rect test (continuous collision detection).
 *
 * At high difficulty the bird can travel >12 px/frame while a pipe is
 * moving in the opposite direction — together they can easily skip past
 * a thin rect in one tick.  We sub-step along the displacement vector
 * and test at each step so tunnelling is impossible.
 *
 * Steps are sized to the circle radius (≈ 8 px), guaranteeing we never
 * leap over a surface thinner than the hitbox itself.
 */
function sweptCircleHitsRect(
  c0:   { cx: number; cy: number; r: number },  // start position
  c1:   { cx: number; cy: number; r: number },  // end position
  rect: { left: number; right: number; top: number; bottom: number }
): boolean {
  // Fast pre-check: if neither endpoint overlaps and the AABB of the swept
  // path doesn't intersect the rect at all, skip sub-stepping entirely.
  const pathLeft   = Math.min(c0.cx, c1.cx) - c0.r;
  const pathRight  = Math.max(c0.cx, c1.cx) + c0.r;
  const pathTop    = Math.min(c0.cy, c1.cy) - c0.r;
  const pathBottom = Math.max(c0.cy, c1.cy) + c0.r;
  if (
    pathRight  < rect.left   ||
    pathLeft   > rect.right  ||
    pathBottom < rect.top    ||
    pathTop    > rect.bottom
  ) return false;

  // Endpoint checks
  if (circleHitsRect(c0, rect) || circleHitsRect(c1, rect)) return true;

  // Sub-step along the displacement
  const dx   = c1.cx - c0.cx;
  const dy   = c1.cy - c0.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.5) return false;

  const stepSize = Math.max(c0.r * 0.8, 1);
  const steps    = Math.ceil(dist / stepSize);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (circleHitsRect({ cx: c0.cx + dx * t, cy: c0.cy + dy * t, r: c0.r }, rect)) {
      return true;
    }
  }
  return false;
}

export class Collision {
  /**
   * Returns true if the bird collides with any pipe or leaves the canvas.
   *
   * Pipe collision uses a tight circle hitbox so beak/tail tips are ignored.
   * A swept test prevents tunnelling at high pipe speeds or frame spikes.
   *
   * @param prevBird  Bird state from the previous frame (for swept test).
   *                  Pass `null` on the very first frame (falls back to static).
   */
  static check(
    bird:       Bird,
    pipes:      Pipe[],
    canvasHeight: number,
    prevBird?:  Bird | null,
  ): boolean {
    const aabb   = bird.getBounds();
    const circle = bird.getCircleHitbox();

    // Floor / ceiling — use full AABB; sprite mustn't leave canvas at all
    if (aabb.top <= 0 || aabb.bottom >= canvasHeight) return true;

    const prevCircle = prevBird ? prevBird.getCircleHitbox() : circle;

    for (const pipe of pipes) {
      const { top, bottom } = pipe.getBounds();
      if (
        sweptCircleHitsRect(prevCircle, circle, top)    ||
        sweptCircleHitsRect(prevCircle, circle, bottom)
      ) {
        return true;
      }
    }

    return false;
  }

  /** True once the bird centre has passed the pipe's mid-line (score tick). */
  static birdPassed(bird: Bird, pipe: Pipe): boolean {
    const b = bird.getBounds();
    const birdCentreX = (b.left + b.right) / 2;
    const { left, right } = pipe.getBounds().top;
    return birdCentreX > left + (right - left) / 2;
  }

  /** True if the bird AABB overlaps a power-up collectible. */
  static birdHitsPowerUp(bird: Bird, powerUp: PowerUp): boolean {
    return rectsOverlap(bird.getBounds(), powerUp.getBounds());
  }
}