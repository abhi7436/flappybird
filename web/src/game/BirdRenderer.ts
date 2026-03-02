/**
 * BirdRenderer — modular, time-based animated bird drawing system.
 *
 * Architecture:
 *   BirdAnimState  — all mutable animation state (owned by a useRef in each canvas)
 *   BirdRenderer   — static update() + draw(), no instance needed
 *
 * Features
 *   ✦ Sine-wave wing flap — time-based, speed scales with difficulty (score ≥ 25)
 *   ✦ Secondary covert feathers with trailing-delay rotation
 *   ✦ 3-feather tail fan that sways opposite-phase to wing
 *   ✦ Random eye blink: 2.8–5.5 s interval, 75 ms open → close → open
 *   ✦ Four expressions: neutral · focused · shocked · dead (X-eyes)
 *   ✦ Beak opens on downstroke and stays wide when shocked
 *   ✦ Feather micro-particles burst on every hard downstroke
 *   ✦ Drop shadow ellipse
 *   ✦ Gold glow pulse on score increase
 */

import { BirdSkin } from '../types';

// ─────────────────────────────────────────────────────────────
// Internal colour helpers
// ─────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
function lighten(hex: string, amt: number): string { return _shiftHex(hex,  amt); }
function darken (hex: string, amt: number): string { return _shiftHex(hex, -amt); }
function _shiftHex(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (n >> 16)         + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff)        + amt));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

// ─────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────
export type BirdExpression = 'neutral' | 'focused' | 'shocked' | 'dead';

interface Particle {
  x: number; y: number;     // world-space offset from bird centre
  vx: number; vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface SweatDrop {
  /** Position relative to bird centre (world-space, no rotation) */
  x: number;
  y: number;
  vy: number;       // falls downward each tick
  life: number;
  maxLife: number;
  size: number;
}

interface FireParticle {
  x: number;  y: number;       // offset from bird centre (world-space)
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  hue: number;              // 0–45: red → orange → yellow
}

export interface BirdAnimState {
  // Wing sine wave
  wingPhase:   number;        // radians, 0–2π
  wingSpeed:   number;        // radians per ms
  prevWingSin: number;        // detect downstroke crossing → particle burst

  // Tail
  tailAngle: number;          // radians, ± 0.27

  // Blink
  blinkT:    number;          // 0 = fully open → 1 = fully closed
  blinkDir:  number;          // +1 closing, -1 opening, 0 idle
  nextBlink: number;          // ms until next blink starts

  // Expression
  expression:      BirdExpression;
  expressionTimer: number;    // ms of forced override remaining

  // Score glow
  lastScore:  number;
  scorePulse: number;         // 1 → 0 over ~350 ms

  // Particles
  particles: Particle[];

  // Death burst (one-shot explosion on first dead frame)
  wasAlive: boolean;

  // ── Phase 3 personality ───────────────────────────────────────
  /** Flying sweat drops when near a pipe */
  sweatDrops:  SweatDrop[];
  /** 0–1 blush intensity (rosy cheeks on coin streak), fades out */
  blushLevel:  number;
  /** ms of dizzy-star orbit remaining after a near-miss */
  dizzyTimer:  number;
  /** Angular position [0–2π] of the orbiting dizzy stars */
  dizzyPhase:  number;
  /** Whether the bird was near-collision last frame (for transition detection) */
  wasNearCol:  boolean;

  // ── Phase 4: Fire trail ───────────────────────────────────────────
  /** Ember particles trailing the tail on score streak (score ≥ 8) */
  fireParticles: FireParticle[];

  // Frame timing
  lastTs: number;
}

// ─────────────────────────────────────────────────────────────
// BirdRenderer namespace
// ─────────────────────────────────────────────────────────────
export const BirdRenderer = {

  // ── Factory ────────────────────────────────────────────
  createState(): BirdAnimState {
    return {
      wingPhase:       0,
      wingSpeed:       0.0044,      // ≈ 4.2 full flaps/s at 60 fps
      prevWingSin:     0,
      tailAngle:       0,
      blinkT:          0,
      blinkDir:        0,
      nextBlink:       lerp(2800, 5500, Math.random()),
      expression:      'neutral',
      expressionTimer: 0,
      lastScore:       0,
      scorePulse:      0,
      particles:       [],
      wasAlive:        true,
      sweatDrops:      [],
      blushLevel:      0,
      dizzyTimer:      0,
      dizzyPhase:      0,
      wasNearCol:      false,
      fireParticles:   [],
      lastTs:          0,
    };
  },

  // ── Update — call each rAF before draw ─────────────────
  update(
    s:             BirdAnimState,
    ts:            number,
    velocity:      number,      // bird physics velocity (+ve = falling)
    score:         number,
    nearCollision: boolean,
    isDead:        boolean,
    blushLevel     = 0,         // 0–1 from caller (coin streak)
  ): void {
    const dt = s.lastTs ? Math.min(ts - s.lastTs, 50) : 16.67;
    s.lastTs = ts;

    // Wing — speed scales subtly with difficulty
    const boost  = score >= 25 ? Math.min((score - 25) * 0.000030, 0.0014) : 0;
    s.wingSpeed  = 0.0044 + boost;
    s.wingPhase  = (s.wingPhase + s.wingSpeed * dt) % (Math.PI * 2);
    const wSin   = Math.sin(s.wingPhase);

    // Feather particles on hard downstroke crossing
    if (!isDead && s.prevWingSin > 0.52 && wSin < 0.12) {
      for (let i = 0; i < 5; i++) {
        s.particles.push({
          x: (Math.random() - 0.5) * 18,
          y: (Math.random() - 0.5) * 12,
          vx: -(0.030 + Math.random() * 0.068),
          vy: (Math.random() - 0.5) * 0.055,
          life:    380 + Math.random() * 320,
          maxLife: 700,
          size:    2.0 + Math.random() * 2.6,
        });
      }
    }
    s.prevWingSin = wSin;

    // Tail — opposite phase, ±0.27 rad
    s.tailAngle = Math.sin(s.wingPhase + Math.PI) * 0.27;

    // Blink
    if (!isDead) {
      s.nextBlink -= dt;
      if (s.nextBlink <= 0 && s.blinkDir === 0) {
        s.blinkDir  =  1;
        s.nextBlink = lerp(2800, 5500, Math.random());
      }
    } else {
      s.blinkT = 1; // dead = eyes closed / X
    }
    if (s.blinkDir !== 0) {
      s.blinkT += s.blinkDir * (dt / 75);
      if (s.blinkT >= 1) { s.blinkT = 1; s.blinkDir = -1; }
      if (s.blinkT <= 0) { s.blinkT = 0; s.blinkDir =  0; }
    }

    // Expression
    if (isDead) {
      s.expression      = 'dead';
      s.expressionTimer = 0;
    } else if (nearCollision || velocity > 7.0) {
      s.expression      = 'shocked';
      s.expressionTimer = 480;
    } else if (s.expressionTimer > 0) {
      s.expressionTimer -= dt;
    } else if (score >= 25) {
      s.expression = 'focused';
    } else {
      s.expression = 'neutral';
    }

    // ── Death burst — one-shot omnidirectional feather explosion ──
    if (isDead && s.wasAlive) {
      s.wasAlive = false;
      for (let i = 0; i < 34; i++) {
        const angle = (i / 34) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
        const spd   = 0.055 + Math.random() * 0.22;
        s.particles.push({
          x:       (Math.random() - 0.5) * 12,
          y:       (Math.random() - 0.5) * 8,
          vx:      Math.cos(angle) * spd,
          vy:      Math.sin(angle) * spd - 0.055,
          life:    650 + Math.random() * 700,
          maxLife: 1350,
          size:    2.0 + Math.random() * 5.0,
        });
      }
    }

    // Score glow pulse
    if (score !== s.lastScore) { s.scorePulse = 1.0; s.lastScore = score; }
    s.scorePulse = Math.max(0, s.scorePulse - dt * 0.0030);

    // ── Phase 3 personality updates ──────────────────────────────────

    // Blush — lerp toward caller-supplied level, then slowly fade
    s.blushLevel = lerp(s.blushLevel, blushLevel, Math.min(1, dt * 0.008));
    if (blushLevel === 0) s.blushLevel = Math.max(0, s.blushLevel - dt * 0.0012);

    // Sweat drops — spawn on transition into near-collision
    if (!isDead && nearCollision && !s.wasNearCol) {
      for (let i = 0; i < 3; i++) {
        s.sweatDrops.push({
          x:       16 + (Math.random() - 0.5) * 10,  // near head (right side)
          y:       -18 + (Math.random() - 0.5) * 6,
          vy:      0.040 + Math.random() * 0.022,
          life:    420 + Math.random() * 220,
          maxLife: 640,
          size:    2.5 + Math.random() * 1.8,
        });
      }
    }

    // Near-miss detection: was near, now safe, still alive → dizzy
    if (!isDead && s.wasNearCol && !nearCollision) {
      s.dizzyTimer = 1_400;
    }
    s.wasNearCol = nearCollision;

    // Dizzy stars spin
    if (s.dizzyTimer > 0) {
      s.dizzyTimer  = Math.max(0, s.dizzyTimer  - dt);
      s.dizzyPhase  = (s.dizzyPhase + dt * 0.0046) % (Math.PI * 2);
    }

    // Tick sweat drops
    s.sweatDrops = s.sweatDrops.filter(d => d.life > 0);
    for (const d of s.sweatDrops) {
      d.life -= dt;
      d.y    += d.vy * dt;
    }

    // Tick feather particles
    s.particles = s.particles.filter(p => p.life > 0);
    for (const p of s.particles) {
      p.life -= dt;
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.vy   += 0.00013 * dt; // gentle gravity
    }

    // ── Phase 4: Fire trail (score streak) ──────────────────────────
    if (!isDead && score >= 8) {
      const intensity = Math.min(1, (score - 8) / 28); // ramps 8 → 36
      const slots     = 1 + Math.floor(intensity * 2);
      for (let i = 0; i < slots; i++) {
        if (Math.random() < 0.55 + intensity * 0.35) {
          s.fireParticles.push({
            x:       -14 + (Math.random() - 0.5) * 10, // tail (left of centre)
            y:       (Math.random() - 0.5) * 14,
            vx:      -(0.028 + Math.random() * 0.052), // drifts left
            vy:      (Math.random() - 0.5) * 0.030,
            life:    260 + Math.random() * 300,
            maxLife: 560,
            size:    1.8 + Math.random() * 2.6 + intensity * 1.8,
            hue:     Math.random() * 45,               // red–orange–yellow
          });
        }
      }
    }
    s.fireParticles = s.fireParticles.filter(f => f.life > 0);
    for (const f of s.fireParticles) {
      f.life -= dt;
      f.x    += f.vx * dt;
      f.y    += f.vy * dt;
    }
  },

  // ── Draw — call each rAF after update ──────────────────
  draw(
    ctx:      CanvasRenderingContext2D,
    cx:       number,
    cy:       number,
    rotation: number,   // degrees (from Bird physics)
    skin:     BirdSkin,
    s:        BirdAnimState,
    size = 34,
  ): void {
    const r = size / 2;

    // ── Drop shadow ──────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle   = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 1.66, r * 1.05, r * 0.21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Sweat drops (world-space, fall straight down) ────
    for (const d of s.sweatDrops) {
      const alpha = (d.life / d.maxLife) * 0.82;
      const wx = cx + d.x;
      const wy = cy + d.y;
      ctx.save();
      ctx.globalAlpha = alpha;
      // Teardrop shape: ellipse tilted slightly
      ctx.fillStyle = '#a0d8ef';
      ctx.strokeStyle = '#5ba3c9';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(wx, wy, d.size * 0.52, d.size, Math.PI * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(wx - d.size * 0.12, wy - d.size * 0.32, d.size * 0.18, d.size * 0.24, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Gold score-glow pulse ─────────────────────────
    if (s.scorePulse > 0) {
      ctx.save();
      ctx.globalAlpha = s.scorePulse * 0.50;
      const sg = ctx.createRadialGradient(cx, cy, r * 0.25, cx, cy, r * 2.9);
      sg.addColorStop(0,   '#FFE566');
      sg.addColorStop(0.38,'#FFAA00');
      sg.addColorStop(1,   'transparent');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 2.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Feather particles (world-space, no rotation applied) ──
    for (const p of s.particles) {
      const alpha = (p.life / p.maxLife) * 0.70;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = skin.wingColor;
      const angle = Math.atan2(p.vy, p.vx);
      ctx.beginPath();
      ctx.ellipse(cx + p.x, cy + p.y, p.size, p.size * 0.36, angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Fire trail particles (world-space, drawn behind bird) ────────
    for (const f of s.fireParticles) {
      const t  = f.life / f.maxLife;
      const wx = cx + f.x;
      const wy = cy + f.y;
      ctx.save();
      ctx.globalAlpha = t * 0.88;
      const fg = ctx.createRadialGradient(wx, wy, 0, wx, wy, f.size * 1.1);
      fg.addColorStop(0,   `hsl(${f.hue + 22}, 100%, 92%)`);
      fg.addColorStop(0.5, `hsl(${f.hue},      100%, 58%)`);
      fg.addColorStop(1,   `hsla(${f.hue - 8}, 100%, 40%, 0)`);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(wx, wy, f.size * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Enter rotated local coordinate space ─────────
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);

    const wingAngle = Math.sin(s.wingPhase) * 0.72;   // ±41°

    // ── Skin glow (premium skins only) ────────────────
    if (skin.glowColor) {
      const sg = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.4);
      sg.addColorStop(0, skin.glowColor);
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── TAIL FEATHERS (3, fan, behind body) ───────────
    const tailHues = [
      darken(skin.wingColor, 22),
      skin.wingColor,
      lighten(skin.wingColor, 24),
    ];
    for (let i = 0; i < 3; i++) {
      const spread = (i - 1) * 0.33;
      ctx.save();
      ctx.translate(-r * 0.76, r * 0.06);
      ctx.rotate(Math.PI + spread + s.tailAngle); // feathers point leftward
      ctx.fillStyle = tailHues[i];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(r * 0.12, -r * 0.20, r * 0.80, -r * 0.12, r * 0.93, 0);
      ctx.bezierCurveTo(r * 0.80,  r * 0.12, r * 0.12,  r * 0.20, 0, 0);
      ctx.closePath();
      ctx.fill();
      // quill centre-line
      ctx.strokeStyle = darken(tailHues[i], 40);
      ctx.lineWidth   = r * 0.063;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(r * 0.06, 0);
      ctx.lineTo(r * 0.87, 0);
      ctx.stroke();
      ctx.restore();
    }

    // ── BODY (teardrop, faces right) ──────────────────
    const bGrad = ctx.createLinearGradient(-r * 0.80, -r * 0.66, r * 0.60, r * 0.66);
    bGrad.addColorStop(0,    lighten(skin.bodyColor, 32));
    bGrad.addColorStop(0.52, skin.bodyColor);
    bGrad.addColorStop(1,    darken(skin.bodyColor, 30));
    ctx.fillStyle   = bGrad;
    ctx.strokeStyle = darken(skin.bodyColor, 44);
    ctx.lineWidth   = r * 0.082;
    ctx.beginPath();
    ctx.moveTo(-r * 0.84, r * 0.04);
    ctx.bezierCurveTo(-r * 0.65, -r * 0.70,  r * 0.18, -r * 0.73,  r * 0.60, -r * 0.22);
    ctx.bezierCurveTo( r * 0.74, -r * 0.05,  r * 0.74,  r * 0.19,  r * 0.60,  r * 0.30);
    ctx.bezierCurveTo( r * 0.18,  r * 0.68, -r * 0.65,  r * 0.62, -r * 0.84,  r * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ── SECONDARY (covert) FEATHERS — trailing lag ────
    // Three small feathers behind the primary, rotating at 48% of wing angle
    ctx.save();
    ctx.translate(-r * 0.10, -r * 0.06);
    ctx.rotate(wingAngle * 0.48);
    ctx.globalAlpha = 0.60;
    for (let i = 0; i < 3; i++) {
      const xOff = (i - 1) * r * 0.22;
      ctx.fillStyle = darken(skin.wingColor, 8 + i * 7);
      ctx.beginPath();
      ctx.moveTo(xOff - r * 0.10, 0);
      ctx.bezierCurveTo(xOff - r * 0.05, -r * 0.32, xOff + r * 0.28, -r * 0.38, xOff + r * 0.36, 0);
      ctx.bezierCurveTo(xOff + r * 0.28,  r * 0.18, xOff - r * 0.04,  r * 0.18, xOff - r * 0.10, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ── PRIMARY WING ──────────────────────────────────
    ctx.save();
    ctx.translate(-r * 0.06, -r * 0.06);
    ctx.rotate(wingAngle);
    const wGrad = ctx.createLinearGradient(-r * 0.52, -r * 0.44, r * 0.56, r * 0.22);
    wGrad.addColorStop(0,    lighten(skin.wingColor, 28));
    wGrad.addColorStop(0.52, skin.wingColor);
    wGrad.addColorStop(1,    darken(skin.wingColor, 36));
    ctx.fillStyle   = wGrad;
    ctx.strokeStyle = darken(skin.wingColor, 42);
    ctx.lineWidth   = r * 0.070;
    ctx.beginPath();
    ctx.moveTo(-r * 0.52, r * 0.06);
    ctx.bezierCurveTo(-r * 0.40, -r * 0.46, r * 0.24, -r * 0.50, r * 0.58, -r * 0.06);
    ctx.bezierCurveTo( r * 0.40,  r * 0.32, -r * 0.28,  r * 0.34, -r * 0.52, r * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 5 feather barb lines
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const tx = -r * 0.40 + i * r * 0.24;
      ctx.beginPath();
      ctx.moveTo(tx, r * 0.24);
      ctx.quadraticCurveTo(tx + r * 0.08, -r * 0.06, tx + r * 0.18, -r * 0.40);
      ctx.stroke();
    }
    ctx.restore();

    // ── HEAD ──────────────────────────────────────────
    const hx = r * 0.22, hy = -r * 0.47, hr = r * 0.54;
    const hGrad = ctx.createRadialGradient(
      hx - hr * 0.28, hy - hr * 0.30, hr * 0.05,
      hx, hy, hr,
    );
    hGrad.addColorStop(0,    lighten(skin.bodyColor, 36));
    hGrad.addColorStop(0.68, skin.bodyColor);
    hGrad.addColorStop(1,    darken(skin.bodyColor, 26));
    ctx.fillStyle   = hGrad;
    ctx.strokeStyle = darken(skin.bodyColor, 44);
    ctx.lineWidth   = r * 0.082;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // ── EYE + EXPRESSION ───────────────────────────────
    _drawEye(ctx, r, hx, hy, skin, s);

    // ── BLUSH (rosy cheeks on coin streak) ───────────
    if (s.blushLevel > 0.02) {
      ctx.save();
      ctx.globalAlpha = s.blushLevel * 0.42;
      ctx.fillStyle   = '#ff6b8a';
      // Left cheek (toward tail)
      ctx.beginPath();
      ctx.ellipse(hx - r * 0.26, hy + r * 0.22, r * 0.23, r * 0.14, -0.1, 0, Math.PI * 2);
      ctx.fill();
      // Right cheek (toward beak)
      ctx.beginPath();
      ctx.ellipse(hx + r * 0.22, hy + r * 0.22, r * 0.23, r * 0.14, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── DIZZY STARS (near-miss aftermath) ─────────────
    if (s.dizzyTimer > 0) {
      const fadeAlpha = Math.min(1, s.dizzyTimer / 300);
      const orbitR    = r * 1.22;
      ctx.save();
      ctx.globalAlpha = fadeAlpha * 0.88;
      for (let i = 0; i < 3; i++) {
        const angle = s.dizzyPhase + (i / 3) * Math.PI * 2;
        const sx    = hx + Math.cos(angle) * orbitR;
        const sy    = hy + Math.sin(angle) * orbitR;
        _drawStar(ctx, sx, sy, r * 0.18, r * 0.08, 4,
          i === 0 ? '#ffe066' : i === 1 ? '#ff99cc' : '#99eeff');
      }
      ctx.restore();
    }

    // ── BEAK ──────────────────────────────────────────
    _drawBeak(ctx, r, hx, hy, hr, skin, wingAngle, s);

    // ── BELLY HIGHLIGHT ───────────────────────────────
    const bg2 = ctx.createRadialGradient(r * 0.10, r * 0.28, 0, r * 0.10, r * 0.34, r * 0.54);
    bg2.addColorStop(0, 'rgba(255,255,255,0.23)');
    bg2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bg2;
    ctx.beginPath();
    ctx.ellipse(r * 0.10, r * 0.34, r * 0.40, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // exit rotated space
  },
};

// ─────────────────────────────────────────────────────────────
// Crown — drawn above the bird for the current room leader
// Call from outside the rotated ctx.save() block (world-space)
// ─────────────────────────────────────────────────────────────

export function drawCrownAboveBird(
  ctx:  CanvasRenderingContext2D,
  cx:   number,
  cy:   number,
  size = 34,
): void {
  const r   = size / 2;
  const top = cy - r * 1.28;   // just above bird top
  const cw  = r * 1.10;        // crown half-width
  const ch  = r * 0.64;        // crown height

  ctx.save();

  // Outer glow
  ctx.shadowColor = 'rgba(255, 215, 0, 0.7)';
  ctx.shadowBlur  = 8;

  // Crown body — 5-point flat crown shape
  ctx.fillStyle   = '#f5c518';
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth   = 1.4;
  ctx.beginPath();
  // Bottom edge
  ctx.moveTo(cx - cw, top + ch);
  ctx.lineTo(cx + cw, top + ch);
  // Right side zigzag up
  ctx.lineTo(cx + cw, top + ch * 0.44);
  ctx.lineTo(cx + cw * 0.58, top + ch * 0.82);
  ctx.lineTo(cx + cw * 0.28, top);
  // Center peak
  ctx.lineTo(cx, top + ch * 0.62);
  ctx.lineTo(cx - cw * 0.28, top);
  // Left side zigzag down
  ctx.lineTo(cx - cw * 0.58, top + ch * 0.82);
  ctx.lineTo(cx - cw, top + ch * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Three jewel dots
  const jewels: Array<[number, number]> = [
    [cx - cw * 0.46, top + ch * 0.62],
    [cx,             top + ch * 0.54],
    [cx + cw * 0.46, top + ch * 0.62],
  ];
  const jewelColors = ['#ff4466', '#ffffff', '#44aaff'];
  jewels.forEach(([jx, jy], i) => {
    ctx.beginPath();
    ctx.arc(jx, jy, r * 0.090, 0, Math.PI * 2);
    ctx.fillStyle = jewelColors[i];
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth   = 0.7;
    ctx.stroke();
    // shine
    ctx.beginPath();
    ctx.arc(jx - r * 0.032, jy - r * 0.028, r * 0.035, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  });

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// Private sub-renderers (module-level, no object allocation)
// ─────────────────────────────────────────────────────────────

/** 4-point or N-point star shape */
function _drawStar(
  ctx:    CanvasRenderingContext2D,
  cx:     number,
  cy:     number,
  outerR: number,
  innerR: number,
  points: number,
  color:  string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const dist  = i % 2 === 0 ? outerR : innerR;
    const x     = cx + Math.cos(angle) * dist;
    const y     = cy + Math.sin(angle) * dist;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function _drawEye(
  ctx:  CanvasRenderingContext2D,
  r:    number,
  hx:   number, hy: number,
  skin: BirdSkin,
  s:    BirdAnimState,
): void {
  const ex   = hx + r * 0.24;
  const ey   = hy - r * 0.09;
  const eR   = r * 0.25;
  const expr = s.expression;

  // ── Dead expression → X eyes ────────────────────
  if (expr === 'dead') {
    ctx.strokeStyle = skin.eyeColor === '#fff' ? '#ccc' : '#1a1a1a';
    ctx.lineWidth   = r * 0.14;
    ctx.lineCap     = 'round';
    for (const sign of [1, -1] as const) {
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.18, ey - r * 0.18 * sign);
      ctx.lineTo(ex + r * 0.18, ey + r * 0.18 * sign);
      ctx.stroke();
    }
    return;
  }

  // ── Sclera (taller oval when shocked) ────────────
  const scaleY = expr === 'shocked' ? 1.38 : 1.0;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(ex, ey, eR, eR * scaleY, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Eyelid blink (slides down over sclera) ───────
  if (s.blinkT > 0) {
    const lidH = eR * scaleY * 2 * s.blinkT;
    ctx.fillStyle = darken(skin.bodyColor, 5); // eyelid = head colour
    ctx.beginPath();
    ctx.ellipse(ex, ey, eR * 1.06, lidH * 0.54, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Iris + pupils ─────────────────────────────────
  if (s.blinkT < 0.60) {
    const irisR = expr === 'shocked' ? r * 0.168 : r * 0.128;
    ctx.fillStyle = skin.eyeColor;
    ctx.beginPath();
    ctx.arc(ex + r * 0.044, ey + r * 0.028, irisR, 0, Math.PI * 2);
    ctx.fill();
    // Primary shine
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(ex + r * 0.078, ey - r * 0.024, r * 0.052, 0, Math.PI * 2);
    ctx.fill();
    // Secondary micro-shine
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.beginPath();
    ctx.arc(ex + r * 0.020, ey + r * 0.088, r * 0.029, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Eyebrow (shape changes per expression) ───────
  const browBaseY = ey - eR * scaleY - r * 0.105;
  let browIn  = 0;
  let browOut = 0;

  if (expr === 'shocked') {
    browIn  = -r * 0.20;   // both ends raised
    browOut = -r * 0.24;
  } else if (expr === 'focused') {
    browIn  =  r * 0.16;   // inner end pushed down (scowl/determined)
    browOut = -r * 0.04;
  } else {
    browIn  = -r * 0.03;   // neutral — slight confident slope
    browOut = -r * 0.10;
  }
  ctx.strokeStyle = darken(skin.bodyColor, 66);
  ctx.lineWidth   = r * 0.13;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(ex - r * 0.22, browBaseY + browIn);
  ctx.quadraticCurveTo(ex, browBaseY - r * 0.04, ex + r * 0.22, browBaseY + browOut);
  ctx.stroke();
}

function _drawBeak(
  ctx:       CanvasRenderingContext2D,
  r:         number,
  hx:        number, hy: number, hr: number,
  skin:      BirdSkin,
  wingAngle: number,
  s:         BirdAnimState,
): void {
  const bx = hx + hr * 0.86;
  const by = hy + r * 0.05;

  // Beak opens on downstroke and stays wide when shocked/dead
  const strokeFactor = Math.max(0, (wingAngle - 0.26) / 0.46);
  const openFactor   = s.expression === 'shocked' ? 1.0
                     : s.expression === 'dead'    ? 0.55
                     : strokeFactor;
  const gap = openFactor * r * 0.17;

  // Upper mandible
  ctx.fillStyle = skin.beakColor;
  ctx.beginPath();
  ctx.moveTo(bx - r * 0.10, by - r * 0.15);
  ctx.lineTo(bx + r * 0.44, by - r * 0.08 - gap * 0.28);
  ctx.lineTo(bx - r * 0.04, by + r * 0.02);
  ctx.closePath();
  ctx.fill();

  // Lower mandible (darker)
  ctx.fillStyle = darken(skin.beakColor, 32);
  ctx.beginPath();
  ctx.moveTo(bx - r * 0.04, by + r * 0.02);
  ctx.lineTo(bx + r * 0.40, by + gap * 0.72);
  ctx.lineTo(bx - r * 0.10, by + r * 0.19);
  ctx.closePath();
  ctx.fill();

  // Nostril dot
  ctx.fillStyle = darken(skin.beakColor, 48);
  ctx.beginPath();
  ctx.arc(bx + r * 0.09, by - r * 0.09, r * 0.041, 0, Math.PI * 2);
  ctx.fill();
}
