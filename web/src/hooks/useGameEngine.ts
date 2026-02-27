import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import {
  GameEngine,
  GameConfig,
  GameEngineCallbacks,
  GameStatus,
} from '@engine/GameEngine';
import { useGameStore } from '../store/gameStore';
import { useSound } from './useSound';

export interface GameState {
  birdX:       number;
  birdY:       number;
  birdW:       number;
  birdH:       number;
  birdRotation: number;
  pipes: Array<{
    x: number;
    gapY: number;
    gapHeight: number;
    width: number;
    scored: boolean;
  }>;
}

export interface UseGameEngineReturn {
  status:    GameStatus | 'waiting' | 'playing';
  score:     number;
  gameState: GameState | null;
  jump:      () => void;
  startGame: () => void;
  resetGame: () => void;
}

export function useGameEngine(
  socket: Socket | null,
  roomId:      string | null,
  canvasWidth  = 400,
  canvasHeight = 600
): UseGameEngineReturn {
  const { setScore, setIsAlive, setFinalScore } = useGameStore((s) => ({
    setScore:      s.setScore,
    setIsAlive:    s.setIsAlive,
    setFinalScore: s.setFinalScore,
  }));

  const { play } = useSound();

  const engineRef   = useRef<GameEngine | null>(null);
  const rafRef      = useRef<number>(0);
  const scoreRef    = useRef<number>(0);

  const [uiStatus,    setUiStatus]    = useState<'waiting' | 'playing' | 'dead'>('waiting');
  const [score,       setLocalScore]  = useState(0);
  const [gameState,   setGameState]   = useState<GameState | null>(null);

  // ── rAF tick ────────────────────────────────────────────
  const tick = useCallback((timestamp: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    const alive = engine.tick(timestamp);
    const state = engine.getState();
    const { bird, pipes } = state;

    setGameState({
      birdX:        bird.x,
      birdY:        bird.y,
      birdW:        bird.width,
      birdH:        bird.height,
      birdRotation: bird.rotation,
      pipes: pipes.map((p) => ({
        x:         p.x,
        gapY:      p.gapY,
        gapHeight: p.gapHeight,
        width:     p.width,
        scored:    p.scored,
      })),
    });

    if (!alive) {
      setUiStatus('dead');
      setIsAlive(false);
      setFinalScore(scoreRef.current);
      // Server game_over handler expects `finalScore` (not `score`)
      socket?.emit('game_over', { roomId, finalScore: scoreRef.current });
      play('die');
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [socket, roomId, setIsAlive, setFinalScore, play]);

  // ── Start ────────────────────────────────────────────────
  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    scoreRef.current = 0;

    const config: GameConfig = { canvasWidth, canvasHeight };

    const callbacks: GameEngineCallbacks = {
      onScoreChange: (s) => {
        scoreRef.current = s;
        setLocalScore(s);
        setScore(s);
        socket?.emit('score_update', { roomId, score: s });
        play('score');
      },
    };

    const engine = new GameEngine(config, callbacks);
    engine.reset();
    engine.start();
    engineRef.current = engine;

    setUiStatus('playing');
    setIsAlive(true);
    setLocalScore(0);
    setScore(0);
    play('start');

    rafRef.current = requestAnimationFrame(tick);
  }, [canvasWidth, canvasHeight, socket, roomId, setScore, setIsAlive, play, tick]);

  // ── Jump ─────────────────────────────────────────────────
  const jump = useCallback(() => {
    if (!engineRef.current || uiStatus !== 'playing') return;
    engineRef.current.jump();
    play('jump');
    socket?.emit('jump', { roomId });
  }, [uiStatus, socket, roomId, play]);

  // ── Reset ────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    engineRef.current = null;
    scoreRef.current  = 0;
    setUiStatus('waiting');
    setLocalScore(0);
    setGameState(null);
    setIsAlive(false);
  }, [setIsAlive]);

  // Cleanup on unmount
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  return { status: uiStatus, score, gameState, jump, startGame, resetGame };
}
