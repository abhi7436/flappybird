import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { DayPhase } from '../types';

const PHASE_DURATIONS: Record<DayPhase, number> = {
  day:   40_000,
  dusk:  15_000,
  night: 35_000,
  dawn:  10_000,
};

const PHASE_ORDER: DayPhase[] = ['day', 'dusk', 'night', 'dawn'];

export interface DayNightColors {
  skyTop:    string;
  skyBottom: string;
  groundTop: string;
  groundBot: string;
  showStars: boolean;
  cloudAlpha: number;
}

export const DAY_NIGHT_COLORS: Record<DayPhase, DayNightColors> = {
  day: {
    skyTop:    '#1a9bf0',
    skyBottom: '#70d4ff',
    groundTop: '#5d8a3c',
    groundBot: '#3d5c27',
    showStars: false,
    cloudAlpha: 1,
  },
  dusk: {
    skyTop:    '#e05b1a',
    skyBottom: '#f5a623',
    groundTop: '#5d7a3c',
    groundBot: '#3d5c27',
    showStars: false,
    cloudAlpha: 0.8,
  },
  night: {
    skyTop:    '#0a0e2a',
    skyBottom: '#1a2a5e',
    groundTop: '#2a4a1c',
    groundBot: '#1a2e10',
    showStars: true,
    cloudAlpha: 0.2,
  },
  dawn: {
    skyTop:    '#3b1f6e',
    skyBottom: '#c75b8a',
    groundTop: '#3d5c27',
    groundBot: '#2a3d1a',
    showStars: true,
    cloudAlpha: 0.5,
  },
};

/**
 * Advances the day/night phase automatically while the game is running.
 * Returns current colour values and whether stars are visible.
 */
export function useDayNight(active: boolean): DayNightColors {
  const { dayPhase, setDayPhase } = useGameStore((s) => ({
    dayPhase: s.dayPhase,
    setDayPhase: s.setDayPhase,
  }));

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<DayPhase>(dayPhase);
  phaseRef.current = dayPhase;

  useEffect(() => {
    if (!active) return;

    const advance = () => {
      const next = PHASE_ORDER[
        (PHASE_ORDER.indexOf(phaseRef.current) + 1) % PHASE_ORDER.length
      ];
      setDayPhase(next);
      timerRef.current = setTimeout(advance, PHASE_DURATIONS[next]);
    };

    timerRef.current = setTimeout(advance, PHASE_DURATIONS[dayPhase]);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return DAY_NIGHT_COLORS[dayPhase];
}
