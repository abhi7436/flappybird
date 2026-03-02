// ============================================================
// SpriteAtlas — canvas-based sprite sheet
//
// Draws all game sprites onto a single OffscreenCanvas at
// startup. Rendering code then calls atlas.draw() which uses
// ctx.drawImage(atlas, sx, sy, sw, sh, dx, dy, dw, dh) —
// a single compositor-native call instead of path re-draws.
//
// Usage:
//   const atlas = SpriteAtlas.getInstance();
//   atlas.draw(ctx, 'coin_normal', x, y, 16, 16);
// ============================================================

export type SpriteName =
  | 'coin_normal'
  | 'coin_golden'
  | 'coin_normal_glow'
  | 'coin_golden_glow'
  | 'bug_body'
  | 'bug_wing_up'
  | 'bug_wing_down'
  | 'poop'
  | 'shield_ring'
  | 'pipe_cap_top'
  | 'pipe_cap_bottom'
  | 'pipe_body';

interface SpriteRect { x: number; y: number; w: number; h: number }

// Sprite layout constants
const PAD  = 2;   // padding between sprites on the atlas
const ROWS: Array<{ name: SpriteName; w: number; h: number }> = [
  { name: 'coin_normal',       w: 20, h: 20 },
  { name: 'coin_golden',       w: 28, h: 28 },
  { name: 'coin_normal_glow',  w: 32, h: 32 },
  { name: 'coin_golden_glow',  w: 40, h: 40 },
  { name: 'bug_body',          w: 24, h: 16 },
  { name: 'bug_wing_up',       w: 20, h: 12 },
  { name: 'bug_wing_down',     w: 20, h: 12 },
  { name: 'poop',              w: 18, h: 22 },
  { name: 'shield_ring',       w: 64, h: 64 },
  { name: 'pipe_cap_top',      w: 66, h: 24 },
  { name: 'pipe_cap_bottom',   w: 66, h: 24 },
  { name: 'pipe_body',         w: 56, h: 128 },
];

export class SpriteAtlas {
  private static _instance: SpriteAtlas | null = null;

  public  canvas:  OffscreenCanvas | HTMLCanvasElement;
  private ctx:     OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private sprites: Map<SpriteName, SpriteRect> = new Map();
  private _ready   = false;

  private constructor() {
    // ── Calculate atlas dimensions ─────────────────────────
    const maxW   = Math.max(...ROWS.map(r => r.w)) + PAD * 2;
    const totalH = ROWS.reduce((sum, r) => sum + r.h + PAD, PAD);
    const atlasW = maxW;
    const atlasH = totalH;

    if (typeof OffscreenCanvas !== 'undefined') {
      this.canvas = new OffscreenCanvas(atlasW, atlasH);
      this.ctx    = this.canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    } else {
      // Fallback for environments without OffscreenCanvas (tests, SSR)
      const c    = document.createElement('canvas');
      c.width    = atlasW;
      c.height   = atlasH;
      this.canvas = c;
      this.ctx    = c.getContext('2d') as CanvasRenderingContext2D;
    }

    this._buildAtlas();
  }

  static getInstance(): SpriteAtlas {
    if (!SpriteAtlas._instance) SpriteAtlas._instance = new SpriteAtlas();
    return SpriteAtlas._instance;
  }

  /** True after _buildAtlas() has completed. */
  get ready(): boolean { return this._ready; }

  /**
   * Draw a named sprite at (dx, dy) scaled to (dw, dh).
   * Falls back to source dimensions if dw/dh omitted.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    name: SpriteName,
    dx: number,
    dy: number,
    dw?: number,
    dh?: number,
  ): void {
    const r = this.sprites.get(name);
    if (!r) return;
    ctx.drawImage(
      this.canvas,
      r.x, r.y, r.w, r.h,
      dx, dy,
      dw ?? r.w,
      dh ?? r.h,
    );
  }

  // ── Atlas construction ──────────────────────────────────────
  private _buildAtlas(): void {
    const ctx = this.ctx;
    let curY  = PAD;

    for (const spec of ROWS) {
      const x = PAD;
      this.sprites.set(spec.name, { x, y: curY, w: spec.w, h: spec.h });
      this._drawSprite(ctx, spec.name, x, curY, spec.w, spec.h);
      curY += spec.h + PAD;
    }

    this._ready = true;
  }

  private _drawSprite(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    name: SpriteName,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    ctx.save();
    ctx.translate(x, y);

    switch (name) {
      case 'coin_normal':   this._drawCoin(ctx, w, h, '#f5c518', '#ffe066'); break;
      case 'coin_golden':   this._drawCoin(ctx, w, h, '#ff9900', '#ffdd44'); break;
      case 'coin_normal_glow': this._drawCoinGlow(ctx, w, h, 'rgba(245,197,24,0.4)'); break;
      case 'coin_golden_glow': this._drawCoinGlow(ctx, w, h, 'rgba(255,153,0,0.5)');  break;
      case 'bug_body':      this._drawBugBody(ctx, w, h); break;
      case 'bug_wing_up':   this._drawBugWing(ctx, w, h, -0.3); break;
      case 'bug_wing_down': this._drawBugWing(ctx, w, h,  0.3); break;
      case 'poop':          this._drawPoop(ctx, w, h); break;
      case 'shield_ring':   this._drawShieldRing(ctx, w, h); break;
      case 'pipe_cap_top':     this._drawPipeCap(ctx, w, h, 'top');    break;
      case 'pipe_cap_bottom':  this._drawPipeCap(ctx, w, h, 'bottom'); break;
      case 'pipe_body':     this._drawPipeBody(ctx, w, h); break;
    }

    ctx.restore();
  }

  // ── Individual sprite painters ──────────────────────────────
  private _drawCoin(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    w: number,
    h: number,
    fill: string,
    shine: string,
  ) {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, shine);
    g.addColorStop(1, fill);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Dollar sign
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font      = `bold ${Math.round(r * 1.1)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', cx, cy + 1);
  }

  private _drawCoinGlow(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    w: number,
    h: number,
    color: string,
  ) {
    const cx = w / 2, cy = h / 2;
    const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private _drawBugBody(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    w: number,
    h: number,
  ) {
    // Abdomen
    ctx.beginPath();
    ctx.ellipse(w * 0.55, h * 0.5, w * 0.38, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a9e1a';
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(w * 0.16, h * 0.5, h * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#0d7a0d';
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(w * 0.13, h * 0.38, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.21, h * 0.38, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(w * 0.13, h * 0.38, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.21, h * 0.38, 1, 0, Math.PI * 2); ctx.fill();
  }

  private _drawBugWing(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    w: number,
    h: number,
    yOffset: number,
  ) {
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.5 + yOffset * h, w * 0.48, h * 0.35, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,240,200,0.65)';
    ctx.strokeStyle = 'rgba(0,160,0,0.5)';
    ctx.lineWidth = 0.8;
    ctx.fill(); ctx.stroke();
  }

  private _drawPoop(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    w: number,
    h: number,
  ) {
    ctx.fillStyle = '#7b4f2e';
    // Three stacked blobs
    const blobs = [
      { cx: w * 0.5, cy: h * 0.82, r: w * 0.42 },
      { cx: w * 0.5, cy: h * 0.55, r: w * 0.32 },
      { cx: w * 0.5, cy: h * 0.32, r: w * 0.22 },
    ];
    for (const b of blobs) {
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(w * 0.4, h * 0.27, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.6, h * 0.27, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(w * 0.4, h * 0.27, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.6, h * 0.27, 1, 0, Math.PI * 2); ctx.fill();
  }

  private _drawShieldRing(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    w: number,
    h: number,
  ) {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 4;
    const g  = ctx.createRadialGradient(cx, cy, r - 6, cx, cy, r + 2);
    g.addColorStop(0, 'rgba(100,220,255,0.9)');
    g.addColorStop(1, 'rgba(50,150,255,0.1)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = g;
    ctx.lineWidth   = 6;
    ctx.stroke();
  }

  private _drawPipeCap(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    w: number,
    h: number,
    side: 'top' | 'bottom',
  ) {
    const isTop = side === 'top';
    // Main cap body
    ctx.fillStyle = '#3a8c3a';
    ctx.strokeStyle = '#2a6c2a';
    ctx.lineWidth = 1.5;
    const r = 5;
    if (isTop) {
      roundRect(ctx, 0, 0, w, h, [0, 0, r, r]); // rounded bottom corners
    } else {
      roundRect(ctx, 0, 0, w, h, [r, r, 0, 0]); // rounded top corners
    }
    ctx.fill(); ctx.stroke();
    // Highlight stripe
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(6, isTop ? 4 : 2, w - 12, 5);
  }

  private _drawPipeBody(
    ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    w: number,
    h: number,
  ) {
    // Body gradient
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0,   '#2d7a2d');
    g.addColorStop(0.4, '#4aaa4a');
    g.addColorStop(0.6, '#4aaa4a');
    g.addColorStop(1,   '#2d7a2d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Edge stripes
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(8, 0, 4, h);
    ctx.fillRect(w - 12, 0, 4, h);
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────
function roundRect(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  radii: [number, number, number, number],
): void {
  const [tl, tr, br, bl] = radii;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y,       x + w,     y + tr);
  ctx.lineTo(x + w,     y + h - br);
  ctx.quadraticCurveTo(x + w, y + h,   x + w - br, y + h);
  ctx.lineTo(x + bl,    y + h);
  ctx.quadraticCurveTo(x,     y + h,   x,          y + h - bl);
  ctx.lineTo(x,         y + tl);
  ctx.quadraticCurveTo(x,     y,       x + tl,     y);
  ctx.closePath();
}
