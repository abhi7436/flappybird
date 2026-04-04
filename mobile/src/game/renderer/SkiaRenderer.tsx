/**
 * Declarative @shopify/react-native-skia render helpers.
 * Each component takes a slice of GameState and returns Skia elements.
 */
import React from 'react';
import {
  Group,
  Rect,
  RoundedRect,
  Circle,
  LinearGradient,
  vec,
  Skia,
  Text as SkiaText,
  useFont,
} from '@shopify/react-native-skia';
import type { BirdState } from '@engine/Bird';
import type { PipeState } from '@engine/Pipe';
import type { PowerUpState } from '@engine/PowerUp';
import type { CoinState } from '@engine/Coin';
import type { BugState } from '@engine/Bug';

// ── Skin definitions (mirrors server skins) ─────────────────────
export interface SkinColors {
  body:  string;
  wing:  string;
  eye:   string;
  beak:  string;
}

export const SKINS: Record<string, SkinColors> = {
  classic:   { body: '#FFD700', wing: '#FFA500', eye: '#FFFFFF', beak: '#FF8C00' },
  spring:    { body: '#FFB6C1', wing: '#FF69B4', eye: '#FFFFFF', beak: '#FF4500' },
  summer:    { body: '#00CED1', wing: '#20B2AA', eye: '#FFFFFF', beak: '#FF6347' },
  autumn:    { body: '#D2691E', wing: '#A0522D', eye: '#FFFFFF', beak: '#8B4513' },
  winter:    { body: '#B0E0E6', wing: '#87CEEB', eye: '#FFFFFF', beak: '#4169E1' },
  champion:  { body: '#FFD700', wing: '#DAA520', eye: '#FF0000', beak: '#B8860B' },
  neon:      { body: '#39FF14', wing: '#00FF7F', eye: '#FFFFFF', beak: '#FF1493' },
  midnight:  { body: '#191970', wing: '#000080', eye: '#AAAAFF', beak: '#4169E1' },
};

// ── Power-up color palette ──────────────────────────────────────
const POWERUP_COLORS: Record<string, { bg: string; icon: string }> = {
  shield:       { bg: '#4fc3f7', icon: '🛡️' },
  slow_pipes:   { bg: '#aed581', icon: '🐢' },
  double_score: { bg: '#ffb74d', icon: '×2' },
};

const PIPE_COLOR   = '#5d8a3c';
const PIPE_CAP_H   = 16;
const GROUND_H     = 80;

// ── Background ─────────────────────────────────────────────────
interface BackgroundProps {
  width: number;
  height: number;
}
export function Background({ width, height }: BackgroundProps) {
  return (
    <Group>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={['#74b9ff', '#a8e6cf']}
        />
      </Rect>
    </Group>
  );
}

// ── Ground ────────────────────────────────────────────────────
interface GroundProps {
  width: number;
  height: number;
  offsetX: number;
}
export function Ground({ width, height, offsetX }: GroundProps) {
  const y = height - GROUND_H;
  const x = -(offsetX % width);
  return (
    <Group>
      <Rect x={x}         y={y + 12} width={width * 2} height={GROUND_H} color="#c8924f" />
      <Rect x={x + width} y={y + 12} width={width * 2} height={GROUND_H} color="#c8924f" />
      <Rect x={x}         y={y} width={width * 2} height={12} color="#4caf50" />
      <Rect x={x + width} y={y} width={width * 2} height={12} color="#4caf50" />
    </Group>
  );
}

// ── Pipe ──────────────────────────────────────────────────────
interface PipeProps {
  pipe: PipeState;
  canvasHeight: number;
}
export function Pipe({ pipe, canvasHeight }: PipeProps) {
  const { x, width, gapY, gapHeight } = pipe;
  const topH    = gapY;
  const bottomY = gapY + gapHeight;
  const bottomH = canvasHeight - bottomY - GROUND_H;

  return (
    <Group>
      <Rect x={x} y={0} width={width} height={topH} color={PIPE_COLOR} />
      <RoundedRect
        x={x - 4} y={topH - PIPE_CAP_H}
        width={width + 8} height={PIPE_CAP_H}
        r={4} color="#4a7030"
      />
      <Rect x={x} y={bottomY} width={width} height={bottomH} color={PIPE_COLOR} />
      <RoundedRect
        x={x - 4} y={bottomY}
        width={width + 8} height={PIPE_CAP_H}
        r={4} color="#4a7030"
      />
    </Group>
  );
}

// ── Bird ──────────────────────────────────────────────────────
interface BirdSpriteProps {
  bird:    BirdState;
  skinId?: string;
  shielded?: boolean;
  shieldExpiring?: boolean;
}
export function BirdSprite({
  bird,
  skinId = 'classic',
  shielded = false,
  shieldExpiring = false,
}: BirdSpriteProps) {
  const { x, y, width, height, rotation } = bird;
  const cx    = x + width  / 2;
  const cy    = y + height / 2;
  const skin  = SKINS[skinId] ?? SKINS.classic;
  const blinkOn = !shieldExpiring || Math.floor(Date.now() / 120) % 2 === 0;
  const shieldOpacity = shieldExpiring ? (blinkOn ? 0.48 : 0.16) : 0.35;
  const shieldRadius = width * (shieldExpiring ? 0.98 : 0.85);

  const m = Skia.Matrix();
  m.translate(cx, cy);
  m.rotate((rotation * Math.PI) / 180);
  m.translate(-cx, -cy);

  return (
    <Group matrix={m}>
      {/* Shield glow ring */}
      {shielded && (
        <>
          <Circle cx={cx} cy={cy} r={shieldRadius} color={`rgba(79,195,247,${shieldOpacity})`} />
          {shieldExpiring && blinkOn && (
            <Circle cx={cx} cy={cy} r={width * 1.08} color="rgba(79,195,247,0.18)" />
          )}
        </>
      )}
      {/* Body */}
      <RoundedRect x={x} y={y} width={width} height={height} r={height / 2} color={skin.body} />
      {/* Wing hint */}
      <RoundedRect
        x={x + 2} y={y + height * 0.55}
        width={width * 0.45} height={height * 0.3}
        r={5} color={skin.wing}
      />
      {/* Eye white */}
      <Circle cx={x + width * 0.7} cy={y + height * 0.3} r={4} color={skin.eye} />
      {/* Pupil */}
      <Circle cx={x + width * 0.72} cy={y + height * 0.3} r={2} color="#333" />
      {/* Beak */}
      <Rect x={x + width - 4} y={y + height * 0.45} width={8} height={5} color={skin.beak} />
    </Group>
  );
}

// ── Power-up collectible ─────────────────────────────────────
interface PowerUpSpriteProps {
  powerUp: PowerUpState;
}
export function PowerUpSprite({ powerUp }: PowerUpSpriteProps) {
  const { x, y, width, height, type } = powerUp;
  const palette = POWERUP_COLORS[type] ?? { bg: '#fff', icon: '?' };
  const cx = x + width  / 2;
  const cy = y + height / 2;
  const r  = width / 2;

  return (
    <Group>
      {/* Outer glow */}
      <Circle cx={cx} cy={cy} r={r + 4} color={`${palette.bg}55`} />
      {/* Background circle */}
      <Circle cx={cx} cy={cy} r={r} color={palette.bg} />
      {/* Inner ring */}
      <Circle cx={cx} cy={cy} r={r - 3} color="rgba(255,255,255,0.3)" />
    </Group>
  );
}

// ── Coin collectible ─────────────────────────────────────────
interface CoinSpriteProps {
  coin: CoinState;
}
export function CoinSprite({ coin }: CoinSpriteProps) {
  if (coin.collected) return null;
  const cx = coin.x + coin.width  / 2;
  const cy = coin.y + coin.height / 2;
  const r  = coin.width / 2;
  const isGolden = coin.type === 'golden';

  return (
    <Group>
      {/* Glow for golden coins */}
      {isGolden && (
        <Circle cx={cx} cy={cy} r={r * 1.5} color="rgba(255, 230, 60, 0.3)" />
      )}
      {/* Coin body */}
      <Circle cx={cx} cy={cy} r={r} color={isGolden ? '#f5b800' : '#ffc864'} />
      {/* Highlight */}
      <Circle cx={cx - r * 0.25} cy={cy - r * 0.25} r={r * 0.3} color="rgba(255,255,255,0.45)" />
      {/* Rim */}
      <Circle cx={cx} cy={cy} r={r - 1} color={isGolden ? '#b87800' : '#b85e00'}
        style="stroke" strokeWidth={1.5} />
    </Group>
  );
}

// ── Bug collectible ──────────────────────────────────────────
interface BugSpriteProps {
  bug: BugState;
}
export function BugSprite({ bug }: BugSpriteProps) {
  if (bug.collected) return null;
  const cx = bug.x + bug.width  / 2;
  const cy = bug.y + bug.height / 2;

  return (
    <Group>
      {/* Body */}
      <RoundedRect
        x={cx - bug.width * 0.3}
        y={cy - bug.height * 0.45}
        width={bug.width * 0.6}
        height={bug.height * 0.9}
        r={bug.width * 0.15}
        color="#2d8a1e"
      />
      {/* Head */}
      <Circle cx={cx + bug.width * 0.2} cy={cy} r={bug.height * 0.27} color="#3cad28" />
      {/* Eye */}
      <Circle cx={cx + bug.width * 0.27} cy={cy - 2} r={1.5} color="#ff4a4a" />
    </Group>
  );
}
