import { DayNightColors } from '../hooks/useDayNight';

export interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
}

export interface Cloud {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
}

export interface Rock {
  /** x position as a fraction [0,1] of canvas width, for resize-safety. */
  xFrac: number;
  /** y offset from groundTop (px) */
  yOff:  number;
  rx:    number;
  ry:    number;
  shade: number; // 0..1 — stone brightness variation
}

export interface GrassState {
  /** Horizontal scroll offset (px). Advances each frame during play. */
  offset: number;
}

/** Initialise a fixed pool of stars, clouds, grass state, and rocks once. */
export function initBackground(width: number, height: number) {
  const stars: Star[] = Array.from({ length: 80 }, () => ({
    x:     Math.random() * width,
    y:     Math.random() * height * 0.8,
    r:     Math.random() * 1.5 + 0.5,
    alpha: Math.random(),
  }));

  const clouds: Cloud[] = Array.from({ length: 6 }, (_, i) => ({
    x:     (i * width) / 5,
    y:     Math.random() * height * 0.4 + 20,
    w:     Math.random() * 100 + 70,
    h:     Math.random() * 35 + 20,
    speed: Math.random() * 0.3 + 0.15,
  }));

  const grass: GrassState = { offset: 0 };

  // Rocks spread across the ground area; xFrac keeps them resize-safe
  const groundH = height * 0.12;
  const rocks: Rock[] = Array.from({ length: 14 }, () => ({
    xFrac: Math.random(),
    yOff:  14 + Math.random() * (groundH - 18),
    rx:    Math.random() * 9 + 4,
    ry:    Math.random() * 5 + 3,
    shade: Math.random(),
  }));

  return { stars, clouds, grass, rocks };
}

/** Advance cloud and grass positions by one frame. */
export function updateBackground(
  clouds:  Cloud[],
  grass:   GrassState,
  width:   number,
  deltaMs: number
): void {
  const dt = deltaMs / 16.67;

  for (const cloud of clouds) {
    cloud.x -= cloud.speed * dt;
    if (cloud.x + cloud.w < 0) {
      cloud.x = width + cloud.w;
      cloud.y = Math.random() * 160 + 20;
    }
  }

  // Grass scrolls in sync with the pipe/world movement feel
  const TILE = 20; // blade tile width; must match drawBackground constant
  grass.offset = (grass.offset + 2.2 * dt) % TILE;
}

/** Draw the entire background (sky + stars + clouds + ground with grass and rocks). */
export function drawBackground(
  ctx:    CanvasRenderingContext2D,
  width:  number,
  height: number,
  colors: DayNightColors,
  stars:  Star[],
  clouds: Cloud[],
  grass:  GrassState,
  rocks:  Rock[],
  timeMs: number
): void {
  // ── Sky gradient ─────────────────────────────────────────────
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.88);
  skyGrad.addColorStop(0, colors.skyTop);
  skyGrad.addColorStop(1, colors.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height * 0.88);

  // ── Stars (night / dawn) ──────────────────────────────────────
  if (colors.showStars) {
    ctx.save();
    for (const star of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(timeMs * 0.002 + star.alpha * 10);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Clouds ────────────────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = colors.cloudAlpha;
  for (const cloud of clouds) {
    drawCloud(ctx, cloud);
  }
  ctx.restore();

  // ── Ground ────────────────────────────────────────────────────
  const groundTop = height * 0.88;
  const groundH   = height - groundTop;

  // Base dirt gradient (three-stop for richer look)
  const groundGrad = ctx.createLinearGradient(0, groundTop, 0, height);
  groundGrad.addColorStop(0,    colors.groundTop);
  groundGrad.addColorStop(0.35, darkenHex(colors.groundTop, 18));
  groundGrad.addColorStop(1,    colors.groundBot);
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundTop, width, groundH);

  // ── Dirt texture: scattered rocks ─────────────────────────────
  ctx.save();
  for (const rock of rocks) {
    const rx  = rock.xFrac * width;
    const ry  = groundTop + rock.yOff;
    const lv  = Math.floor(52 + rock.shade * 38); // lightness value 52-90
    // Base stone
    ctx.fillStyle = `rgb(${lv + 10},${lv},${lv - 8})`;
    ctx.beginPath();
    ctx.ellipse(rx, ry, rock.rx, rock.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(rx - rock.rx * 0.15, ry - rock.ry * 0.28, rock.rx * 0.52, rock.ry * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.ellipse(rx + rock.rx * 0.10, ry + rock.ry * 0.30, rock.rx * 0.60, rock.ry * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // ── Grass band at the very top of the ground ──────────────────
  const grassBandH = 11;
  const grassGrad = ctx.createLinearGradient(0, groundTop, 0, groundTop + grassBandH);
  grassGrad.addColorStop(0, '#469930');
  grassGrad.addColorStop(1, '#306e1e');
  ctx.fillStyle = grassGrad;
  ctx.fillRect(0, groundTop, width, grassBandH);

  // ── Scrolling grass blades ────────────────────────────────────
  const TILE         = 20; // tile width (keep in sync with updateBackground)
  const bladePalette = ['#4eb832', '#5cc838', '#3ea020', '#68d444'];
  const total        = Math.ceil(width / TILE) + 2;
  const startX       = -(grass.offset % TILE);
  // Alternating blade heights for natural variation
  const hPattern     = [13, 8, 11, 9, 14, 7, 12, 10];

  ctx.save();
  // Clip blades so they only peep above the grass band
  ctx.beginPath();
  ctx.rect(0, groundTop - 16, width, 19);
  ctx.clip();

  for (let i = 0; i < total; i++) {
    const bx = startX + i * TILE;
    const bh = hPattern[i % hPattern.length];

    // Left blade (leans slightly left)
    ctx.fillStyle = bladePalette[i % bladePalette.length];
    ctx.beginPath();
    ctx.moveTo(bx,      groundTop + 2);
    ctx.lineTo(bx - 3,  groundTop - bh + 2);
    ctx.lineTo(bx + 2,  groundTop + 2);
    ctx.closePath();
    ctx.fill();

    // Right blade (leans slightly right)
    ctx.fillStyle = bladePalette[(i + 2) % bladePalette.length];
    ctx.beginPath();
    ctx.moveTo(bx + 8,  groundTop + 2);
    ctx.lineTo(bx + 11, groundTop - (bh - 3));
    ctx.lineTo(bx + 14, groundTop + 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // ── Ground top edge highlight ─────────────────────────────────
  ctx.strokeStyle = 'rgba(120,215,75,0.50)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, groundTop);
  ctx.lineTo(width, groundTop);
  ctx.stroke();
}

function drawCloud(ctx: CanvasRenderingContext2D, cloud: Cloud): void {
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const { x, y, w, h } = cloud;
  const rx = w / 2;
  const ry = h / 2;

  ctx.beginPath();
  ctx.ellipse(x + rx,        y + ry,        rx,        ry,        0, 0, Math.PI * 2);
  ctx.ellipse(x + rx * 1.5,  y + ry * 0.8,  rx * 0.75, ry * 0.8,  0, 0, Math.PI * 2);
  ctx.ellipse(x + rx * 0.5,  y + ry * 0.8,  rx * 0.65, ry * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
}

function darkenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r   = Math.max(0, (num >> 16) - amount);
  const g   = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b   = Math.max(0, (num & 0xff) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
