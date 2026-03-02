/**
 * useGameDimensions
 *
 * Returns canvas { width, height } that fill the available viewport while:
 *  - maintaining the game's 2:3 aspect ratio (400 × 600 logical)
 *  - respecting top-bar / sidebar chrome
 *  - clamping to a sensible min (280 × 420) and max (500 × 750)
 *  - re-computing on every window resize / orientation change
 */

import { useEffect, useState } from 'react';

const ASPECT_W = 2; // width units
const ASPECT_H = 3; // height units   →  w / h === 2/3

interface Dims { width: number; height: number }

/**
 * @param mode
 *   'solo' — full-width canvas (no sidebar)
 *   'game' — canvas + sidebar side-by-side; sidebar reserves ≈ 220 px
 */
export function useGameDimensions(mode: 'solo' | 'game' = 'solo'): Dims {
  const [dims, setDims] = useState<Dims>(() => compute(mode));

  useEffect(() => {
    const onResize = () => setDims(compute(mode));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // visualViewport fires when mobile browser chrome (address bar) shows/hides
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, [mode]);

  return dims;
}

// ─────────────────────────────────────────────────────────────────────────────

function compute(mode: 'solo' | 'game'): Dims {
  // visualViewport gives the true visible area on mobile (excludes address bar,
  // iOS home indicator, etc.). Falls back to window dimensions on desktop.
  const vw = window.visualViewport?.width  ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;

  // Horizontal: container p-2 (8px each side = 16px) + optional sidebar
  const hPad     = 16;                          // 8 px each side
  const sidebarW = mode === 'game' ? 272 : 0;   // leaderboard w-64 (256px) + gap-4 (16px)
  const availW   = vw - hPad - sidebarW;

  // Vertical: p-2 (16px) + top-bar / HUD (~44px) + gap-4 (16px) = ~76px
  const vPad   = mode === 'game' ? 96 : 80;     // game mode has HUD above canvas
  const availH = vh - vPad;

  // Try width-first
  let w = availW;
  let h = Math.round(w * ASPECT_H / ASPECT_W);   // h = w * 1.5

  // If that overflows height, shrink to fit height
  if (h > availH) {
    h = availH;
    w = Math.round(h * ASPECT_W / ASPECT_H);      // w = h * 0.667
  }

  // Clamp to min / max
  w = clamp(w, 280, 500);
  h = clamp(h, 420, 750);

  // Re-enforce aspect ratio after clamping (prefer respecting width clamp)
  h = Math.round(w * ASPECT_H / ASPECT_W);

  return { width: w, height: h };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
