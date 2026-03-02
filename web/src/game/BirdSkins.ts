import { BirdSkin, BirdSkinId } from '../types';
import { BirdRenderer, BirdAnimState, drawCrownAboveBird } from './BirdRenderer';

// Re-export so canvas files can import from one place
export type { BirdAnimState } from './BirdRenderer';
export { BirdRenderer, drawCrownAboveBird } from './BirdRenderer';

export const BIRD_SKINS: Record<BirdSkinId, BirdSkin> = {
  classic: {
    id: 'classic', name: 'Classic', emoji: '🐦',
    rarity: 'common',
    bodyColor:   '#FFD700',
    wingColor:   '#FFA500',
    eyeColor:    '#111',
    beakColor:   '#FF6B00',
    unlockScore: 0,
  },
  blue: {
    id: 'blue', name: 'Bluebird', emoji: '🐦‍❄️',
    rarity: 'common',
    bodyColor:   '#4FC3F7',
    wingColor:   '#0288D1',
    eyeColor:    '#111',
    beakColor:   '#FF8F00',
    unlockScore: 10,
  },
  red: {
    id: 'red', name: 'Cardinal', emoji: '🐓',
    rarity: 'common',
    bodyColor:   '#EF5350',
    wingColor:   '#B71C1C',
    eyeColor:    '#111',
    beakColor:   '#FFA000',
    unlockScore: 20,
  },
  gold: {
    id: 'gold', name: 'Golden', emoji: '✨',
    rarity: 'rare',
    bodyColor:   '#FFD700',
    wingColor:   '#F9A825',
    eyeColor:    '#000',
    beakColor:   '#E65100',
    glowColor:   'rgba(255, 215, 0, 0.7)',
    unlockScore: 35,
  },
  neon: {
    id: 'neon', name: 'Neon', emoji: '⚡',
    rarity: 'rare',
    bodyColor:   '#39FF14',
    wingColor:   '#00E676',
    eyeColor:    '#fff',
    beakColor:   '#FF1744',
    glowColor:   'rgba(57, 255, 20, 0.8)',
    unlockScore: 50,
  },
  galaxy: {
    id: 'galaxy', name: 'Galaxy', emoji: '🌌',
    rarity: 'epic',
    bodyColor:   '#7B1FA2',
    wingColor:   '#4A148C',
    eyeColor:    '#E1F5FE',
    beakColor:   '#CE93D8',
    glowColor:   'rgba(123, 31, 162, 0.9)',
    unlockScore: 75,
  },
  inferno: {
    id: 'inferno', name: 'Inferno', emoji: '🔥',
    rarity: 'epic',
    bodyColor:   '#FF3D00',
    wingColor:   '#FF6D00',
    eyeColor:    '#FFF176',
    beakColor:   '#FFFF00',
    glowColor:   'rgba(255, 61, 0, 0.9)',
    unlockScore: 100,
  },
  aqua: {
    id: 'aqua', name: 'Aqua', emoji: '🌊',
    rarity: 'epic',
    bodyColor:   '#00BCD4',
    wingColor:   '#006064',
    eyeColor:    '#fff',
    beakColor:   '#00E5FF',
    glowColor:   'rgba(0, 229, 255, 0.8)',
    unlockScore: 125,
  },
  thunder: {
    id: 'thunder', name: 'Thunder', emoji: '🌩️',
    rarity: 'epic',
    bodyColor:   '#FDD835',
    wingColor:   '#F57F17',
    eyeColor:    '#212121',
    beakColor:   '#FFFFFF',
    glowColor:   'rgba(253, 216, 53, 0.9)',
    unlockScore: 150,
  },
  shadow: {
    id: 'shadow', name: 'Shadow', emoji: '👤',
    rarity: 'legendary',
    bodyColor:   '#1A1A2E',
    wingColor:   '#16213E',
    eyeColor:    '#E040FB',
    beakColor:   '#9C27B0',
    glowColor:   'rgba(156, 39, 176, 0.9)',
    unlockScore: 200,
  },
  rainbow: {
    id: 'rainbow', name: 'Rainbow', emoji: '🌈',
    rarity: 'legendary',
    bodyColor:   '#FF6B9D',
    wingColor:   '#A855F7',
    eyeColor:    '#fff',
    beakColor:   '#FBBF24',
    glowColor:   'rgba(168, 85, 247, 0.9)',
    unlockScore: 300,
  },
};

export const RARITY_CONFIG = {
  common:    { label: 'Common',    color: '#94a3b8', glow: '' },
  rare:      { label: 'Rare',      color: '#60a5fa', glow: '0 0 8px rgba(96,165,250,0.6)' },
  epic:      { label: 'Epic',      color: '#c084fc', glow: '0 0 8px rgba(192,132,252,0.7)' },
  legendary: { label: 'Legendary', color: '#fbbf24', glow: '0 0 12px rgba(251,191,36,0.8)' },
} as const;

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
  size       = 34,
  blushLevel = 0,
): void {
  BirdRenderer.draw(ctx, cx, cy, rotation, skin, animState, size);
  void blushLevel; // blushLevel is now stored on animState via update(); kept in signature for clarity
}

/**
 * Render a pipe pair using Canvas 2D.
 */
export function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  gapY: number,
  gapHeight: number,
  width: number,
  canvasHeight: number,
  color = '#4CAF50',
  capColor = '#388E3C'
): void {
  const capH  = 24;
  const capW  = width + 10;
  const capX  = x - 5;

  // ── Top pipe ────────────────────────────────────
  const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
  gradient.addColorStop(0,   color);
  gradient.addColorStop(0.5, lighten(color, 20));
  gradient.addColorStop(1,   darken(color, 20));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, 0, width, gapY - capH, [0, 0, 4, 4]);
  ctx.fill();

  ctx.fillStyle = capColor;
  ctx.beginPath();
  ctx.roundRect(capX, gapY - capH, capW, capH, [6, 6, 0, 0]);
  ctx.fill();

  // ── Bottom pipe ──────────────────────────────────
  const bottomY = gapY + gapHeight;

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, bottomY + capH, width, canvasHeight - bottomY - capH, [4, 4, 0, 0]);
  ctx.fill();

  ctx.fillStyle = capColor;
  ctx.beginPath();
  ctx.roundRect(capX, bottomY, capW, capH, [0, 0, 6, 6]);
  ctx.fill();
}

function lighten(hex: string, amount: number): string {
  return shiftColor(hex, amount);
}

function darken(hex: string, amount: number): string {
  return shiftColor(hex, -amount);
}

function shiftColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r   = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g   = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b   = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
