import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState, GameConfig } from '@engine/GameEngine';

interface UseGameEngineOptions {
  canvasWidth: number;
  canvasHeight: number;
  onScoreChange?: (score: number) => void;
  onGameOver?: (finalScore: number) => void;
}

interface UseGameEngineReturn {
  gameState: GameState;
  jump: () => void;
  startGame: () => void;
  resetGame: () => void;
}

export function useGameEngine({
  canvasWidth,
  canvasHeight,
  onScoreChange,
  onGameOver,
}: UseGameEngineOptions): UseGameEngineReturn {
  const engineRef = useRef<GameEngine | null>(null);
  const rafRef    = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const runningRef = useRef(false);

  const [gameState, setGameState] = useState<GameState>(() => ({
    status: 'idle',
    score: 0,
    bird: {
      x: canvasWidth * 0.25,
      y: canvasHeight / 2,
      width: 34,
      height: 24,
      velocity: 0,
      rotation: 0,
    },
    pipes: [],
    difficultyTier: 0,
    powerUps: [],
    activeEffects: [],
    hasShield: false,
  }));

  // ── Initialize engine once dimensions are ready ───────────
  useEffect(() => {
    if (canvasWidth === 0 || canvasHeight === 0) return;

    const config: GameConfig = { canvasWidth, canvasHeight };

    engineRef.current = new GameEngine(config, {
      onScoreChange,
      onGameOver: (finalScore) => {
        runningRef.current = false;
        cancelAnimationFrame(rafRef.current);
        // Capture final frame
        if (engineRef.current) {
          setGameState({ ...engineRef.current.getState() });
        }
        onGameOver?.(finalScore);
      },
      onDifficultyChange: () => {},
    });

    setGameState({ ...engineRef.current.getState() });

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [canvasWidth, canvasHeight]);

  // ── Frame loop ────────────────────────────────────────────
  const loop = useCallback((ts: number) => {
    if (!runningRef.current || !engineRef.current) return;

    const delta = lastTsRef.current ? ts - lastTsRef.current : 16.67;
    lastTsRef.current = ts;

    const alive = engineRef.current.tick(ts);
    setGameState({ ...engineRef.current.getState() });

    if (alive) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, []);

  const startGame = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.reset();
    engineRef.current.start();
    runningRef.current = true;
    lastTsRef.current = 0;
    setGameState({ ...engineRef.current.getState() });
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const resetGame = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    engineRef.current?.reset();
    if (engineRef.current) {
      setGameState({ ...engineRef.current.getState() });
    }
  }, []);

  const jump = useCallback(() => {
    engineRef.current?.jump();
  }, []);

  return { gameState, jump, startGame, resetGame };
}
