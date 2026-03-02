import { DayNightColors } from '../hooks/useDayNight';

// ─────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────
export interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

export interface Cloud {
  x:     number;
  y:     number;
  w:     number;
  h:     number;
  speed: number;
  layer: 0 | 1 | 2;   // 0 = far, 1 = mid, 2 = near
}

export interface MidElement {
  x:     number;
  type:  'tree' | 'bush';
  w:     number;
  h:     number;
  speed: number;
}

// ─────────────────────────────────────────────
// Sky gradient cache (Phase 7 perf optimisation)
// The sky gradient only changes when the day-cycle colors change
// (~once every 5 min). Cache it on an OffscreenCanvas and blit it
// each frame instead of running createLinearGradient + fillRect.
// ─────────────────────────────────────────────
let _skyCanvas:   OffscreenCanvas | HTMLCanvasElement | null  = null;
let _skyCtx:      OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null = null;
let _skyW = 0, _skyH = 0;
let _cachedSkyTop    = '';
let _cachedSkyBottom = '';

function _ensureSkyCache(
  width:     number,
  groundTop: number,
  colors:    DayNightColors,
): OffscreenCanvas | HTMLCanvasElement {
  const needsRebuild =
    !_skyCanvas ||
    _skyW !== width        ||
    _skyH !== groundTop    ||
    _cachedSkyTop    !== colors.skyTop    ||
    _cachedSkyBottom !== colors.skyBottom;

  if (needsRebuild) {
    if (!_skyCanvas || _skyW !== width || _skyH !== groundTop) {
      if (typeof OffscreenCanvas !== 'undefined') {
        _skyCanvas = new OffscreenCanvas(width, groundTop);
        _skyCtx    = _skyCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      } else {
        const c = document.createElement('canvas');
        c.width = width; c.height = groundTop;
        _skyCanvas = c;
        _skyCtx    = c.getContext('2d') as CanvasRenderingContext2D;
      }
      _skyW = width; _skyH = groundTop;
    }

    const ctx      = _skyCtx!;
    const skyGrad  = ctx.createLinearGradient(0, 0, 0, groundTop);
    skyGrad.addColorStop(0, colors.skyTop);
    skyGrad.addColorStop(1, colors.skyBottom);
    ctx.fillStyle  = skyGrad;
    ctx.fillRect(0, 0, width, groundTop);

    _cachedSkyTop    = colors.skyTop;
    _cachedSkyBottom = colors.skyBottom;
  }

  return _skyCanvas!;
}


export function initBackground(width: number, height: number) {
  const stars: Star[] = Array.from({ length: 80 }, () => ({
    x:     Math.random() * width,
    y:     Math.random() * height * 0.8,
    r:     Math.random() * 1.5 + 0.5,
    alpha: Math.random(),
  }));

  const clouds: Cloud[] = [
    // Layer 0 — far: large, slow, near top
    ...Array.from({ length: 3 }, (_, i): Cloud => ({
      x:     (i / 2.5) * width + Math.random() * 60,
      y:     Math.random() * height * 0.16 + 12,
      w:     Math.random() * 90  + 130,
      h:     Math.random() * 28  + 26,
      speed: Math.random() * 0.05 + 0.06,
      layer: 0,
    })),
    // Layer 1 — mid: medium size & speed
    ...Array.from({ length: 4 }, (_, i): Cloud => ({
      x:     (i / 3.5) * width + Math.random() * 40,
      y:     Math.random() * height * 0.24 + 18,
      w:     Math.random() * 70  + 70,
      h:     Math.random() * 24  + 18,
      speed: Math.random() * 0.10 + 0.15,
      layer: 1,
    })),
    // Layer 2 — near: smaller, fast, lower
    ...Array.from({ length: 3 }, (_, i): Cloud => ({
      x:     (i / 2.2) * width + Math.random() * 30,
      y:     Math.random() * height * 0.30 + 34,
      w:     Math.random() * 50  + 44,
      h:     Math.random() * 18  + 12,
      speed: Math.random() * 0.16 + 0.36,
      layer: 2,
    })),
  ];

  const midLayer: MidElement[] = Array.from({ length: 12 }, (_, i) => {
    const isBush = Math.random() > 0.44;
    return {
      x:     (i / 12) * width * 1.25 + Math.random() * 40,
      type:  isBush ? 'bush' : 'tree',
      w:     isBush ? Math.random() * 30 + 22 : Math.random() * 18 + 12,
      h:     isBush ? Math.random() * 22 + 18 : Math.random() * 52 + 42,
      speed: isBush ? 0.55 : 0.42,
    };
  });

  return { stars, clouds, midLayer };
}

// ─────────────────────────────────────────────
// Advance all moving elements by one frame
// ─────────────────────────────────────────────
export function updateBackground(
  clouds:   Cloud[],
  midLayer: MidElement[],
  width:    number,
  deltaMs:  number,
): void {
  for (const cloud of clouds) {
    cloud.x -= cloud.speed * (deltaMs / 16.67);
    if (cloud.x + cloud.w < 0) {
      cloud.x = width + cloud.w + Math.random() * 50;
      cloud.y =
        cloud.layer === 0 ? Math.random() * 80  + 12 :
        cloud.layer === 1 ? Math.random() * 120 + 18 :
                            Math.random() * 140 + 34;
    }
  }
  for (const el of midLayer) {
    el.x -= el.speed * (deltaMs / 16.67);
    if (el.x + el.w < 0) el.x = width + el.w + Math.random() * 80;
  }
}

// ─────────────────────────────────────────────
// Draw the full background scene
// ─────────────────────────────────────────────
export function drawBackground(
  ctx:      CanvasRenderingContext2D,
  width:    number,
  height:   number,
  colors:   DayNightColors,
  stars:    Star[],
  clouds:   Cloud[],
  midLayer: MidElement[],
  timeMs:   number,
): void {
  const groundTop = height * 0.88;

  // ── Sky — blit from cache (only rebuilt when day-cycle colors change) ──
  ctx.drawImage(_ensureSkyCache(width, groundTop, colors), 0, 0);

  // ── Stars (night / dawn) ──────────────────────────────────
  if (colors.showStars) {
    ctx.save();
    for (const star of stars) {
      const twinkle = 0.4 + 0.6 * Math.sin(timeMs * 0.0022 + star.alpha * 9.7);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle   = '#fff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Far clouds ────────────────────────────────────────────
  ctx.save();
  for (const c of clouds) {
    if (c.layer !== 0) continue;
    ctx.globalAlpha = colors.cloudAlpha * 0.48;
    _drawCartoonCloud(ctx, c);
  }
  ctx.restore();

  // ── Mid clouds ────────────────────────────────────────────
  ctx.save();
  for (const c of clouds) {
    if (c.layer !== 1) continue;
    ctx.globalAlpha = colors.cloudAlpha * 0.76;
    _drawCartoonCloud(ctx, c);
  }
  ctx.restore();

  // ── Midground silhouettes (trees / bushes) ────────────────
  _drawMidground(ctx, midLayer, groundTop, colors);

  // ── Near clouds (in front of midground) ───────────────────
  ctx.save();
  for (const c of clouds) {
    if (c.layer !== 2) continue;
    ctx.globalAlpha = colors.cloudAlpha * 0.90;
    _drawCartoonCloud(ctx, c);
  }
  ctx.restore();

  // ── Ground ────────────────────────────────────────────────
  const groundGrad = ctx.createLinearGradient(0, groundTop, 0, height);
  groundGrad.addColorStop(0, colors.groundTop);
  groundGrad.addColorStop(1, colors.groundBot);
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundTop, width, height - groundTop);

  // Ground edge highlight
  ctx.strokeStyle = _lighten(colors.groundTop, 40);
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundTop);
  ctx.lineTo(width, groundTop);
  ctx.stroke();

  // Animated grass tufts
  _drawGrass(ctx, width, groundTop, colors, timeMs);
}

// ─────────────────────────────────────────────
// Private renderers
// ─────────────────────────────────────────────

function _drawCartoonCloud(ctx: CanvasRenderingContext2D, cloud: Cloud): void {
  const { x, y, w, h } = cloud;
  const rx = w / 2;
  const ry = h / 2;

  // Main fill
  ctx.fillStyle   = 'rgba(255,255,255,0.96)';
  ctx.strokeStyle = 'rgba(190,220,255,0.55)';
  ctx.lineWidth   = 1.8;
  ctx.beginPath();
  ctx.ellipse(x + rx,         y + ry,         rx,         ry * 0.65,  0, 0, Math.PI * 2);
  ctx.ellipse(x + rx * 1.60,  y + ry * 0.68,  rx * 0.74,  ry * 0.84,  0, 0, Math.PI * 2);
  ctx.ellipse(x + rx * 0.40,  y + ry * 0.73,  rx * 0.62,  ry * 0.78,  0, 0, Math.PI * 2);
  ctx.ellipse(x + rx,         y + ry * 0.28,  rx * 0.80,  ry,         0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Inner highlight shimmer
  ctx.fillStyle = 'rgba(255,255,255,0.52)';
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.76, y + ry * 0.18, rx * 0.40, ry * 0.28, -0.25, 0, Math.PI * 2);
  ctx.fill();

  // Bottom soft shadow
  ctx.fillStyle = 'rgba(170,205,240,0.28)';
  ctx.beginPath();
  ctx.ellipse(x + rx, y + ry * 1.32, rx * 0.82, ry * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
}

function _drawMidground(
  ctx:      CanvasRenderingContext2D,
  elements: MidElement[],
  groundTop: number,
  colors:   DayNightColors,
): void {
  // Derive a dark silhouette from the sky bottom (subtract brightness)
  const silhouette = _lighten(colors.skyBottom, -62);

  ctx.save();
  ctx.fillStyle   = silhouette;
  ctx.globalAlpha = 0.36;

  for (const el of elements) {
    if (el.type === 'tree') {
      // Trunk
      const trunkW = el.w * 0.28;
      const trunkH = el.h * 0.38;
      ctx.fillRect(el.x + el.w * 0.5 - trunkW * 0.5, groundTop - trunkH, trunkW, trunkH);
      // First canopy tier
      ctx.beginPath();
      ctx.moveTo(el.x,              groundTop - trunkH);
      ctx.lineTo(el.x + el.w * 0.5, groundTop - el.h);
      ctx.lineTo(el.x + el.w,       groundTop - trunkH);
      ctx.closePath();
      ctx.fill();
      // Second higher tier
      ctx.beginPath();
      ctx.moveTo(el.x + el.w * 0.14, groundTop - trunkH - el.h * 0.28);
      ctx.lineTo(el.x + el.w * 0.50, groundTop - el.h  - el.h * 0.24);
      ctx.lineTo(el.x + el.w * 0.86, groundTop - trunkH - el.h * 0.28);
      ctx.closePath();
      ctx.fill();
    } else {
      // Bush — 3 rounded bumps
      ctx.beginPath();
      ctx.ellipse(el.x + el.w * 0.46, groundTop - el.h * 0.55, el.w * 0.50, el.h * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(el.x + el.w * 0.90, groundTop - el.h * 0.38, el.w * 0.38, el.h * 0.38, 0, 0, Math.PI * 2);
      ctx.ellipse(el.x + el.w * 0.09, groundTop - el.h * 0.34, el.w * 0.33, el.h * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function _drawGrass(
  ctx:      CanvasRenderingContext2D,
  width:    number,
  groundTop: number,
  colors:   DayNightColors,
  timeMs:   number,
): void {
  const TUFTS = 24;
  ctx.save();
  ctx.strokeStyle = _lighten(colors.groundTop, 50);
  ctx.lineWidth   = 1.5;
  ctx.lineCap     = 'round';
  ctx.globalAlpha = 0.80;

  for (let i = 0; i < TUFTS; i++) {
    const bx   = (i / TUFTS) * width + 14;
    const sway = Math.sin(timeMs * 0.0012 + i * 1.35) * 2.2;
    // 3 blades per tuft
    for (let b = -1; b <= 1; b++) {
      ctx.beginPath();
      ctx.moveTo(bx + b * 3.5,  groundTop + 1);
      ctx.quadraticCurveTo(
        bx + b * 3.5 + sway,        groundTop - 7,
        bx + b * 5.5 + sway * 1.6,  groundTop - 13,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ─────────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────────
function _lighten(hex: string, amt: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r   = Math.min(255, Math.max(0, (num >> 16)         + amt));
  const g   = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b   = Math.min(255, Math.max(0, (num & 0xff)        + amt));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
