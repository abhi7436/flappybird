import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import {
  GameEngine,
  GameConfig,
  GameEngineCallbacks,
  GameStatus,
  ActiveEffect,
  GAME_STATE,
} from '@engine/GameEngine';
import { CoinState, CoinType } from '@engine/Coin';
import { BugState } from '@engine/Bug';
import { PoopState } from '@engine/PoopDrop';
import { RandomEvent, RandomEventType } from '@engine/RandomEvents';
import { PowerUpState, PowerUpType } from '@engine/PowerUp';
import { useGameStore } from '../store/gameStore';
import { useSound } from './useSound';
import { useMultiplayerSync } from './useMultiplayerSync';
import soundManager from '../services/SoundManager';

/** Re-export for consumers (Canvas components, overlays, etc.) */
export { GAME_STATE } from '@engine/GameEngine';

export interface GameState {
  birdX:        number;
  birdY:        number;
  birdW:        number;
  birdH:        number;
  birdRotation: number;
  pipes: Array<{
    x:                number;
    gapY:             number;
    gapHeight:        number;
    width:            number;
    scored:           boolean;
    tempGapBonus:     number;
    gapBonusExpiresAt: number;
  }>;
  powerUps:      PowerUpState[];
  activeEffects: ActiveEffect[];
  hasShield:     boolean;
  coins:         CoinState[];
  bugs:          BugState[];
  poops:         PoopState[];
  windForce:      number;
  isFoggy:        boolean;
  isLightning:    boolean;
  isNight:        boolean;
  isDarkMode:     boolean;
  musicIntensity: 0 | 1 | 2;
}

export interface UseGameEngineReturn {
  status:     GameStatus | 'waiting' | 'playing';
  score:      number;
  gameState:  GameState | null;
  jump:       () => void;
  startGame:  () => void;
  resetGame:  () => void;
  dropPoop:   () => void;
  coinStreak: number;
}

export function useGameEngine(
  socket: Socket | null,
  roomId:      string | null,
  canvasWidth  = 400,
  canvasHeight = 600
): UseGameEngineReturn {
  const { setScore, setIsAlive, setFinalScore, setPlayerPowerUp, user, guest } = useGameStore((s) => ({
    setScore:         s.setScore,
    setIsAlive:       s.setIsAlive,
    setFinalScore:    s.setFinalScore,
    setPlayerPowerUp: s.setPlayerPowerUp,
    user:             s.user,
    guest:            s.guest,
  }));
  const selfId = user?.id ?? guest?.id ?? null;

  const { play } = useSound();
  const { broadcastScore, broadcastGameOver, broadcastPowerUp, broadcastJump } =
    useMultiplayerSync(socket, roomId);

  const engineRef   = useRef<GameEngine | null>(null);
  const rafRef      = useRef<number>(0);
  const scoreRef    = useRef<number>(0);
  const coinStreakRef = useRef<number>(0);   // resets on death
  // Random-event overlay state (communicated to Canvas layer via gameState)
  const windForceRef    = useRef<number>(0);
  const isFoggyRef      = useRef<boolean>(false);
  const isLightningRef  = useRef<boolean>(false);
  const isNightRef      = useRef<boolean>(false);
  const isDarkModeRef   = useRef<boolean>(false);
  const musicIntensityRef = useRef<0 | 1 | 2>(0);

  const [uiStatus,    setUiStatus]    = useState<'waiting' | 'playing' | 'dead'>('waiting');
  const [score,       setLocalScore]  = useState(0);
  const [gameState,   setGameState]   = useState<GameState | null>(null);
  const [coinStreak,  setCoinStreak]  = useState(0);

  // ── rAF tick ────────────────────────────────────────────
  const tick = useCallback((timestamp: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    const alive = engine.tick(timestamp);
    const state = engine.getState();
    const { bird, pipes, powerUps, activeEffects, hasShield, coins, bugs, poops } = state;

    setGameState({
      birdX:        bird.x,
      birdY:        bird.y,
      birdW:        bird.width,
      birdH:        bird.height,
      birdRotation: bird.rotation,
      pipes: pipes.map((p) => ({
        x:                 p.x,
        gapY:              p.gapY,
        gapHeight:         p.gapHeight,
        width:             p.width,
        scored:            p.scored,
        tempGapBonus:      p.tempGapBonus,
        gapBonusExpiresAt: p.gapBonusExpiresAt,
      })),
      powerUps,
      activeEffects,
      hasShield,
      coins:       coins  as CoinState[],
      bugs:        bugs   as BugState[],
      poops:       poops  as PoopState[],
      windForce:      windForceRef.current,
      isFoggy:        isFoggyRef.current,
      isLightning:    isLightningRef.current,
      isNight:        isNightRef.current,
      isDarkMode:     isDarkModeRef.current,
      musicIntensity: musicIntensityRef.current,
    });

    if (!alive) {
      soundManager.setMusicIntensity(0);
      setUiStatus('dead');
      setIsAlive(false);
      setFinalScore(scoreRef.current);
      broadcastGameOver({ finalScore: scoreRef.current });
      play('die');
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [broadcastGameOver, setIsAlive, setFinalScore, play]);

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
        broadcastScore(s);
        play('score');
      },
      onPowerUpCollected: (type: PowerUpType) => {
        play('powerUp');
        broadcastPowerUp(type);
        // Show badge for self too (server won't echo back to sender)
        if (selfId) setPlayerPowerUp(selfId, type);
      },
      onCoinCollected: (_type: CoinType) => {
        play('coin');
        coinStreakRef.current += 1;
        setCoinStreak(coinStreakRef.current);
      },
      onBugCollected: () => { play('bugCrunch'); },
      onPoopSplash: () => { play('poopSplash'); },
      onRandomEvent: (e: RandomEvent) => {
        if (e.type === 'wind')         { windForceRef.current  = e.windForce ?? 0.055; play('wind'); }
        else if (e.type === 'fog')     { isFoggyRef.current    = true; }
        else if (e.type === 'lightning') { isLightningRef.current = true; play('lightning');
          setTimeout(() => { isLightningRef.current = false; }, 400);
        }
        else if (e.type === 'night_switch') { isNightRef.current = !isNightRef.current; }
      },
      onRandomEventEnd: (type: RandomEventType) => {
        if (type === 'wind') windForceRef.current = 0;
        if (type === 'fog')  isFoggyRef.current   = false;
      },
      onMusicIntensityChange: (intensity: 0 | 1 | 2) => {
        musicIntensityRef.current = intensity;
        isDarkModeRef.current = intensity > 0;
        soundManager.setMusicIntensity(intensity);
      },
    };

    const engine = new GameEngine(config, callbacks);
    engine.reset();
    engine.start();
    engine.jump();                     // initial flap so bird doesn't freefall on first frame
    engineRef.current = engine;

    setUiStatus('playing');
    setIsAlive(true);
    setLocalScore(0);
    setScore(0);
    coinStreakRef.current = 0;
    setCoinStreak(0);
    play('start');

    rafRef.current = requestAnimationFrame(tick);
  }, [canvasWidth, canvasHeight, broadcastScore, broadcastPowerUp, setScore, setIsAlive, selfId, setPlayerPowerUp, play, tick]);

  // ── Poop drop ────────────────────────────────────────────
  const dropPoop = useCallback(() => {
    if (!engineRef.current || uiStatus !== 'playing') return;
    engineRef.current.dropPoop(performance.now());
  }, [uiStatus]);

  // ── Jump ─────────────────────────────────────────────────
  const jump = useCallback(() => {
    if (!engineRef.current || uiStatus !== 'playing') return;
    engineRef.current.jump();
    play('jump');
    broadcastJump();
  }, [uiStatus, broadcastJump, play]);

  // ── Reset ────────────────────────────────────────────────
  const resetGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    soundManager.setMusicIntensity(0);
    engineRef.current      = null;
    scoreRef.current       = 0;
    coinStreakRef.current   = 0;
    musicIntensityRef.current = 0;
    isDarkModeRef.current     = false;
    setUiStatus('waiting');
    setLocalScore(0);
    setGameState(null);
    setCoinStreak(0);
    setIsAlive(false);
  }, [setIsAlive]);

  // Cleanup on unmount
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  return { status: uiStatus, score, gameState, jump, startGame, resetGame, dropPoop, coinStreak };
}
