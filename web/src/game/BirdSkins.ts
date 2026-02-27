import { BirdSkin, BirdSkinId } from '../types';
import { BirdRenderer, BirdAnimState } from './BirdRenderer';

// Re-export so canvas files can import from one place
export type { BirdAnimState } from './BirdRenderer';
export { BirdRenderer } from './BirdRenderer';

export const BIRD_SKINS: Record<BirdSkinId, BirdSkin> = {
  classic: {
    id: 'classic', name: 'Classic',
    bodyColor:  '#FFD700',
    wingColor:  '#FFA500',
    eyeColor:   '#111',
    beakColor:  '#FF6B00',
    unlockScore: 0,
  },
  blue: {
    id: 'blue', name: 'Bluebird',
    bodyColor:  '#4FC3F7',
    wingColor:  '#0288D1',
    eyeColor:   '#111',
    beakColor:  '#FF8F00',
    unlockScore: 10,
  },
  red: {
    id: 'red', name: 'Cardinal',
    bodyColor:  '#EF5350',
    wingColor:  '#B71C1C',
    eyeColor:   '#111',
    beakColor:  '#FFA000',
    unlockScore: 20,
  },
  gold: {
    id: 'gold', name: 'Golden',
    bodyColor:  '#FFD700',
    wingColor:  '#F9A825',
    eyeColor:   '#000',
    beakColor:  '#E65100',
    glowColor:  'rgba(255, 215, 0, 0.6)',
    unlockScore: 35,
  },
  neon: {
    id: 'neon', name: 'Neon',
    bodyColor:  '#39FF14',
    wingColor:  '#00E676',
    eyeColor:   '#fff',
    beakColor:  '#FF1744',
    glowColor:  'rgba(57, 255, 20, 0.7)',
    unlockScore: 50,
  },
  galaxy: {
    id: 'galaxy', name: 'Galaxy',
    bodyColor:  '#7B1FA2',
    wingColor:  '#4A148C',
    eyeColor:   '#E1F5FE',
    beakColor:  '#CE93D8',
    glowColor:  'rgba(123, 31, 162, 0.8)',
    unlockScore: 75,
  },
};

/**
 * Render the bird. animState comes from BirdRenderer.createState() stored
 * in a useRef — it carries all animation timers and is mutated each frame.
 * Call BirdRenderer.update() before this each rAF tick.
 */
export function drawBird(
  ctx:       CanvasRenderingContext2D,
  cx:        number,
  cy:        number,
  rotation:  number,
  skin:      BirdSkin,
  animState: BirdAnimState,
  size = 34,
): void {
  BirdRenderer.draw(ctx, cx, cy, rotation, skin, animState, size);
}

/**
 * Render a pipe pair using Canvas 2D with cylindrical shading,
 * beveled caps, and highlight stripes.
 */
export function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  gapY: number,
  gapHeight: number,
  width: number,
  groundY: number,
): void {
  const capH = 26;
  const capW = width + 14;
  const capX = x - 7;
  const r    = 3;  // body corner radius
  const cr   = r + 3; // cap corner radius

  // ── Cylindrical body gradient (horizontal) ─────────────────
  // Simulates a rounded tube: dark left/right edges, bright highlight ~35%
  const bodyGrad = ctx.createLinearGradient(x, 0, x + width, 0);
  bodyGrad.addColorStop(0,    '#255c28');  // dark left shadow
  bodyGrad.addColorStop(0.12, '#337a37');  // mid-shadow rise
  bodyGrad.addColorStop(0.32, '#72c245');  // bright specular highlight
  bodyGrad.addColorStop(0.52, '#4aab4e');  // base green
  bodyGrad.addColorStop(0.78, '#2d7030');  // shadow slope
  bodyGrad.addColorStop(1,    '#193d1b');  // dark right edge

  // ── Cap gradient — slightly offset so cap looks raised ─────
  const capGrad = ctx.createLinearGradient(capX, 0, capX + capW, 0);
  capGrad.addColorStop(0,    '#1e4e22');
  capGrad.addColorStop(0.12, '#2c6b30');
  capGrad.addColorStop(0.32, '#62ab38');
  capGrad.addColorStop(0.52, '#3f943f');
  capGrad.addColorStop(0.78, '#256028');
  capGrad.addColorStop(1,    '#143516');

  // ── Helper: draw a pipe body section ────────────────────────
  const drawBody = (
    bx: number, by: number, bw: number, bh: number,
    radii: [number, number, number, number],
  ) => {
    if (bh <= 0) return;
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, radii);
    ctx.fill();
    // Thin specular stripe (glossy highlight ~30% from left)
    const sx = bx + bw * 0.22;
    const sw = Math.max(2, bw * 0.10);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.roundRect(sx, by, sw, bh, [radii[0] ? 2 : 0, 0, 0, radii[3] ? 2 : 0]);
    ctx.fill();
    // Dark outline shadow on left and right edges
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(bx, by, 2, bh);
    ctx.fillRect(bx + bw - 2, by, 2, bh);
  };

  const drawCap = (
    cx2: number, cy2: number, cw2: number, ch2: number,
    radii: [number, number, number, number],
    highlightTop: boolean,
  ) => {
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.roundRect(cx2, cy2, cw2, ch2, radii);
    ctx.fill();
    // Top highlight line
    if (highlightTop) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(cx2 + 3, cy2 + 2, cw2 - 6, 3);
    }
    // Bottom shadow line
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(cx2, cy2 + ch2 - 4, cw2, 4);
    // Side outlines
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(cx2, cy2, 2, ch2);
    ctx.fillRect(cx2 + cw2 - 2, cy2, 2, ch2);
  };

  // ── Top pipe ────────────────────────────────────────────────
  const topBodyH = gapY - capH;
  drawBody(x, 0, width, topBodyH, [0, 0, r, r]);

  // Top cap (flares outward, rounded top corners → no bottom radius)
  drawCap(capX, gapY - capH, capW, capH, [cr, cr, 0, 0], true);

  // ── Bottom pipe ─────────────────────────────────────────────
  const bottomY  = gapY + gapHeight;
  const botBodyH = groundY - (bottomY + capH);

  // Bottom cap (flares outward, rounded bottom corners → no top radius)
  drawCap(capX, bottomY, capW, capH, [0, 0, cr, cr], false);

  drawBody(x, bottomY + capH, width, botBodyH, [r, r, 0, 0]);
}
