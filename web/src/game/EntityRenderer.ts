// ============================================================
// EntityRenderer — Canvas 2D draw calls for coins, bugs,
// poop drops, power-ups, and environmental effect overlays.
// ============================================================

import type { CoinState } from '@engine/Coin';
import type { BugState }  from '@engine/Bug';
import type { PoopState } from '@engine/PoopDrop';
import type { PowerUpState } from '@engine/PowerUp';

// ─────────────────────────────────────────────────────────────
// Coins
// ─────────────────────────────────────────────────────────────

export function drawCoins(
  ctx: CanvasRenderingContext2D,
  coins: ReadonlyArray<CoinState>,
  ts:    number,
): void {
  for (const c of coins) {
    if (c.collected) continue;
    const cx = c.x + c.width  / 2;
    const cy = c.y + c.height / 2;
    const r  = c.width / 2;

    if (c.type === 'golden') {
      // Glowing golden coin
      const pulse = 0.85 + 0.15 * Math.sin(ts * 0.006 + cx * 0.05);
      const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.5);
      grad.addColorStop(0,   `rgba(255, 230, 60, ${0.5 * pulse})`);
      grad.addColorStop(0.7, `rgba(255, 170,  0, ${0.2 * pulse})`);
      grad.addColorStop(1,   'rgba(255, 170, 0, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Star sparkles
      const sf = 0.5 + 0.5 * Math.sin(ts * 0.008);
      drawSparkle(ctx, cx - r, cy - r,     3 * sf, 'rgba(255, 240, 100, 0.9)');
      drawSparkle(ctx, cx + r, cy + r * 0.3, 2.5 * sf, 'rgba(255, 255, 160, 0.7)');
    }

    // Coin body
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    if (c.type === 'golden') {
      bodyGrad.addColorStop(0, '#ffe040');
      bodyGrad.addColorStop(0.6, '#f5b800');
      bodyGrad.addColorStop(1, '#c68800');
    } else {
      bodyGrad.addColorStop(0, '#ffe4b5');
      bodyGrad.addColorStop(0.5, '#ffc864');
      bodyGrad.addColorStop(1, '#e8980a');
    }
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = c.type === 'golden' ? '#b87800' : '#b85e00';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Shine highlight
    ctx.beginPath();
    ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fill();

    if (c.type === 'golden') {
      // Inner star glyph
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ts * 0.001);
      ctx.fillStyle = '#fff8c0';
      ctx.font = `bold ${Math.round(r * 1.1)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
      ctx.restore();
    }
  }
}

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size * 0.4, size * 0.4);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.4, size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// Bugs
// ─────────────────────────────────────────────────────────────

export function drawBugs(
  ctx:  CanvasRenderingContext2D,
  bugs: ReadonlyArray<BugState>,
): void {
  for (const b of bugs) {
    if (b.collected) continue;
    const cx = b.x + b.width  / 2;
    const cy = b.y + b.height / 2;

    // Wings (oscillate via wingPhase)
    const wf = Math.abs(Math.sin(b.wingPhase));
    const wingW = b.width * 0.38;
    const wingH = b.height * 0.55 * (0.4 + 0.6 * wf);

    ctx.save();
    ctx.globalAlpha = 0.75;
    // Left wing
    ctx.beginPath();
    ctx.ellipse(cx - b.width * 0.28, cy - wingH * 0.3, wingW, wingH, -Math.PI / 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(160, 230, 160, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 160, 60, 0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Right wing
    ctx.beginPath();
    ctx.ellipse(cx + b.width * 0.28, cy - wingH * 0.3, wingW, wingH, Math.PI / 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(160, 230, 160, 0.8)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Body
    ctx.beginPath();
    ctx.ellipse(cx, cy, b.width * 0.3, b.height * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2d8a1e';
    ctx.fill();
    ctx.strokeStyle = '#1a4f12';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(cx + b.width * 0.2, cy, b.height * 0.27, 0, Math.PI * 2);
    ctx.fillStyle = '#3cad28';
    ctx.fill();
    ctx.strokeStyle = '#1a4f12';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Eyes
    ctx.beginPath();
    ctx.arc(cx + b.width * 0.27, cy - 2, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4a4a';
    ctx.fill();
  }
}

// ─────────────────────────────────────────────────────────────
// Poop drops
// ─────────────────────────────────────────────────────────────

export function drawPoops(
  ctx:   CanvasRenderingContext2D,
  poops: ReadonlyArray<PoopState>,
  nowMs: number,
): void {
  for (const p of poops) {
    if (p.splashed) {
      // Splash circle — fade out over 900 ms
      const age   = nowMs - p.splashTs;
      const alpha = Math.max(0, 1 - age / 900);
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath();
      ctx.ellipse(p.x + p.width / 2, p.splashY + 4, 18 * (1 + age / 600), 8 * (1 + age / 900), 0, 0, Math.PI * 2);
      ctx.fillStyle = '#7a4a0a';
      ctx.fill();
      ctx.restore();
      continue;
    }

    const cx = p.x + p.width / 2;
    const cy = p.y;

    // Classic poop shape — 3-tier stacked circles
    ctx.save();
    ctx.fillStyle = '#7a4a0a';
    ctx.strokeStyle = '#3d2005';
    ctx.lineWidth = 1;

    // Bottom tier
    ctx.beginPath();
    ctx.ellipse(cx, cy + p.height * 0.35, p.width * 0.44, p.height * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Mid tier
    ctx.beginPath();
    ctx.ellipse(cx, cy + p.height * 0.12, p.width * 0.34, p.height * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Top tier / tip
    ctx.beginPath();
    ctx.ellipse(cx, cy - p.height * 0.08, p.width * 0.22, p.height * 0.18, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shine
    ctx.beginPath();
    ctx.arc(cx - 2, cy - p.height * 0.06, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 220, 150, 0.5)';
    ctx.fill();

    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
// Power-up icons (extended)
// ─────────────────────────────────────────────────────────────

export function drawPowerUpIcon(
  ctx: CanvasRenderingContext2D,
  pu:  PowerUpState,
  ts:  number,
): void {
  const { x, y, width: w, height: h, type } = pu;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pulse = 0.88 + 0.12 * Math.sin(ts * 0.005);

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.55 * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = _puColor(type, 0.45);
  ctx.lineWidth = 3;
  ctx.stroke();

  // Background circle
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = _puColor(type, 0.85);
  ctx.fill();
  ctx.strokeStyle = '#ffffff40';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Icon emoji
  ctx.save();
  ctx.font = `${Math.round(w * 0.48)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const icons: Record<string, string> = {
    shield:       '🛡️',
    slow_pipes:   '🐌',
    double_score: '✖️',
    slow_motion:  '⏳',
    magnet:       '🧲',
    golden_coin:  '⭐',
    turbo_jump:   '⚡',
  };
  ctx.fillText(icons[type] ?? '?', cx, cy + 1);
  ctx.restore();
}

function _puColor(type: string, alpha: number): string {
  const map: Record<string, string> = {
    shield:       `rgba(80, 160, 255, ${alpha})`,
    slow_pipes:   `rgba(120, 220, 120, ${alpha})`,
    double_score: `rgba(255, 200, 50, ${alpha})`,
    slow_motion:  `rgba(180, 120, 255, ${alpha})`,
    magnet:       `rgba(255, 100, 100, ${alpha})`,
    golden_coin:  `rgba(255, 220, 30, ${alpha})`,
    turbo_jump:   `rgba(60, 220, 200, ${alpha})`,
  };
  return map[type] ?? `rgba(200,200,200,${alpha})`;
}

// ─────────────────────────────────────────────────────────────
// Wind arrows overlay
// ─────────────────────────────────────────────────────────────

export function drawWindArrows(
  ctx:       CanvasRenderingContext2D,
  width:     number,
  height:    number,
  windForce: number,
  ts:        number,
): void {
  if (windForce === 0) return;
  const dir     = windForce > 0 ? 1 : -1;  // 1 = down, -1 = up
  const offsetY = Math.sin(ts * 0.003) * 6;
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.15 * Math.abs(Math.sin(ts * 0.004));

  // Three horizontal arrows evenly spaced across canvas
  for (let i = 0; i < 3; i++) {
    const ax = width * (0.2 + i * 0.3);
    const ay = height * 0.18 + offsetY + i * 12 * dir;
    drawArrow(ctx, ax - 20, ay, ax + 20, ay, dir);
  }

  ctx.restore();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  _dir: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - 8, y2 - 6);
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 8, y2 + 6);
  ctx.strokeStyle = '#a0e0ff';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// ─────────────────────────────────────────────────────────────
// Fog overlay
// ─────────────────────────────────────────────────────────────

export function drawFogOverlay(
  ctx:    CanvasRenderingContext2D,
  width:  number,
  height: number,
  alpha:  number,
): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Dense edges, clear in centre
  const grad = ctx.createRadialGradient(
    width / 2, height / 2, height * 0.1,
    width / 2, height / 2, height * 0.85,
  );
  grad.addColorStop(0,   'rgba(200, 220, 255, 0)');
  grad.addColorStop(0.6, 'rgba(200, 220, 255, 0.18)');
  grad.addColorStop(1,   'rgba(200, 220, 255, 0.62)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
