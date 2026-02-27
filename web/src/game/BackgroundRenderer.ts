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

/** Initialise a fixed pool of stars and clouds once. */
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

  return { stars, clouds };
}

/** Advance cloud positions by one frame. */
export function updateBackground(
  clouds: Cloud[],
  width: number,
  deltaMs: number
): void {
  for (const cloud of clouds) {
    cloud.x -= cloud.speed * (deltaMs / 16.67);
    if (cloud.x + cloud.w < 0) {
      cloud.x = width + cloud.w;
      cloud.y = Math.random() * 160 + 20;
    }
  }
}

/** Draw the entire background (sky + stars + clouds + ground). */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width:       number,
  height:      number,
  colors:      DayNightColors,
  stars:       Star[],
  clouds:      Cloud[],
  timeMs:      number
): void {
  // ── Sky gradient ────────────────────────────────────────
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.88);
  skyGrad.addColorStop(0, colors.skyTop);
  skyGrad.addColorStop(1, colors.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height * 0.88);

  // ── Stars (night / dawn) ─────────────────────────────────
  if (colors.showStars) {
    ctx.save();
    for (const star of stars) {
      // Twinkle
      const twinkle = 0.5 + 0.5 * Math.sin(timeMs * 0.002 + star.alpha * 10);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Clouds ───────────────────────────────────────────────
  ctx.save();
  ctx.globalAlpha = colors.cloudAlpha;
  for (const cloud of clouds) {
    drawCloud(ctx, cloud);
  }
  ctx.restore();

  // ── Ground ───────────────────────────────────────────────
  const groundTop = height * 0.88;
  const groundGrad = ctx.createLinearGradient(0, groundTop, 0, height);
  groundGrad.addColorStop(0, colors.groundTop);
  groundGrad.addColorStop(1, colors.groundBot);
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundTop, width, height - groundTop);

  // Ground edge highlight
  ctx.strokeStyle = lighterOf(colors.groundTop);
  ctx.lineWidth = 2;
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

function lighterOf(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r   = Math.min(255, (num >> 16) + 40);
  const g   = Math.min(255, ((num >> 8) & 0xff) + 40);
  const b   = Math.min(255, (num & 0xff) + 40);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
