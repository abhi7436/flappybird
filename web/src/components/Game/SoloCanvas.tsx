/**
 * SoloCanvas — identical render loop to GameCanvas but:
 *  • No socket / room wiring
 *  • Death overlay shows personal best and "Menu" button
 *  • Saves high score to localStorage via guestSession on every death
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useDayNight } from '../../hooks/useDayNight';
import { useGameStore } from '../../store/gameStore';
import { BIRD_SKINS, drawBird, drawPipe, BirdRenderer, BirdAnimState } from '../../game/BirdSkins';
import {
  initBackground,
  updateBackground,
  drawBackground,
  Star,
  Cloud,
  MidElement,
} from '../../game/BackgroundRenderer';
import {
  drawCoins,
  drawBugs,
  drawPoops,
  drawPowerUpIcon,
  drawWindArrows,
  drawFogOverlay,
} from '../../game/EntityRenderer';
import { getDifficultyTier } from '@engine/GameEngine';
import { saveGuestHighScore } from '../../services/guestSession';

interface Props {
  width:       number;
  height:      number;
  onBackToMenu: () => void;
}

const GROUND_FRAC = 0.88;
const DIFFICULTY_LABELS = ['Normal', 'Hard', 'Insane', 'MAXIMUM'];

export const SoloCanvas: React.FC<Props> = ({ width, height, onBackToMenu }) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const bgRef        = useRef<{ stars: Star[]; clouds: Cloud[]; midLayer: MidElement[] } | null>(null);
  const lastTsRef    = useRef<number>(0);
  const birdAnimRef  = useRef<BirdAnimState>(BirdRenderer.createState());
  const scoreRef     = useRef(0);
  const savedRef     = useRef(false); // prevent double-save per round

  const { selectedSkin, setSoloHighScore, soloHighScore, user } = useGameStore((s) => ({
    selectedSkin:     s.selectedSkin,
    setSoloHighScore: s.setSoloHighScore,
    soloHighScore:    s.soloHighScore,
    user:             s.user,
  }));
  const skin   = BIRD_SKINS[selectedSkin];
  const colors = useDayNight(true);

  // ── UI state ────────────────────────────────────────────────────────
  const [shaking,        setShaking]        = useState(false);
  const [showOops,       setShowOops]       = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const timerRafRef    = useRef<number>(0);
  const gameStartTsRef = useRef<number>(0);

  const { status, score, gameState, jump, startGame, resetGame, dropPoop, coinStreak } =
    useGameEngine(null, null, width, height);

  // ── Hot refs — updated each render, read inside the rAF closure ─────────
  // Avoids putting volatile values in the render loop useEffect deps array,
  // which would cancel+restart the rAF 60× per second.
  const gameStateRef = useRef(gameState);
  const statusRef    = useRef(status);
  const colorsRef    = useRef(colors);
  const skinRef      = useRef(skin);
  gameStateRef.current = gameState;
  statusRef.current    = status;
  colorsRef.current    = colors;
  skinRef.current      = skin;
  scoreRef.current     = score;
  const coinStreakRndr = useRef(0);

  // Keep coinStreakRndr ref in sync
  useEffect(() => { coinStreakRndr.current = coinStreak; }, [coinStreak]);

  // Save high score once on death
  useEffect(() => {
    if (status === 'dead' && !savedRef.current) {
      savedRef.current = true;
      const best = saveGuestHighScore(score);
      setSoloHighScore(best);

      // Sync to server for authenticated users (fire-and-forget)
      if (user && score > 0) {
        fetch('/api/profile/me/solo-score', {
          method:      'POST',
          credentials: 'include',
          headers:     {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${user.token}`,
          },
          body: JSON.stringify({ score }),
        })
          .then((r) => r.json())
          .then(() => {
            if (score > (user.highScore ?? 0)) {
              useGameStore.getState().setUser({ ...user, highScore: score });
            }
          })
          .catch(console.error);
      }
    }
    if (status === 'playing') {
      savedRef.current = false;
    }
  }, [status, score, setSoloHighScore, user]);

  useLayoutEffect(() => {
    bgRef.current = initBackground(width, height);
  }, [width, height]);

  const handleJump = useCallback(() => {
    if (status === 'waiting') startGame();
    else if (status === 'playing') jump();
  }, [status, startGame, jump]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleJump]);

  // ── Render loop ────────────────────────────────────────────
  // Deps: only [width, height] — all runtime values are read through refs
  // so the loop is created ONCE and never torn down mid-game.
  useEffect(() => {
    let rafId: number;

    const render = (ts: number) => {
      const canvas = canvasRef.current;
      const bg = bgRef.current;
      if (!canvas || !bg) { rafId = requestAnimationFrame(render); return; }

      const gs     = gameStateRef.current;
      const st     = statusRef.current;
      const clrs   = colorsRef.current;
      const sk     = skinRef.current;

      const ctx     = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
      const deltaMs = lastTsRef.current ? ts - lastTsRef.current : 16.67;
      lastTsRef.current = ts;

      if (st === 'playing') {
        updateBackground(bg.clouds, bg.midLayer, width, deltaMs);
      }

      // Bird animation
      const velocity = gs ? gs.birdRotation / 3 : 0;
      const nearCol  = !!gs && gs.pipes.some(
        p => p.x > gs.birdX - 20 && p.x < gs.birdX + 90,
      );
      BirdRenderer.update(birdAnimRef.current, ts, velocity, scoreRef.current, nearCol, st === 'dead', Math.min(1, coinStreakRndr.current / 5));

      drawBackground(ctx, width, height, clrs, bg.stars, bg.clouds, bg.midLayer, ts);

      if (gs) {
        for (const pipe of gs.pipes) {
          drawPipe(ctx, pipe.x, pipe.gapY, pipe.gapHeight + pipe.tempGapBonus, pipe.width, height * GROUND_FRAC);
        }
        drawBird(ctx, gs.birdX, gs.birdY, gs.birdRotation, sk, birdAnimRef.current);
        drawCoins(ctx, gs.coins, ts);
        drawBugs(ctx, gs.bugs);
        drawPoops(ctx, gs.poops, ts);
        for (const pu of gs.powerUps) drawPowerUpIcon(ctx, pu, ts);
        if (gs.windForce !== 0) drawWindArrows(ctx, width, height, gs.windForce, ts);
        if (gs.isFoggy)         drawFogOverlay(ctx, width, height, 0.72);
      } else {
        drawBird(ctx, width * 0.25, height / 2, 0, sk, birdAnimRef.current);
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [width, height]); // stable — volatile state read through refs above

  // ── Screen shake + OOPS! on death ──────────────────────────────────
  useEffect(() => {
    if (status !== 'dead') {
      setShaking(false);
      setShowOops(false);
      return;
    }
    setShaking(true);
    setShowOops(true);
    const t1 = setTimeout(() => setShaking(false), 460);
    const t2 = setTimeout(() => setShowOops(false), 1650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Game timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'playing') {
      gameStartTsRef.current = performance.now();
      const tick = () => {
        const elapsed = Math.floor((performance.now() - gameStartTsRef.current) / 1000);
        setDisplaySeconds(elapsed);
        timerRafRef.current = requestAnimationFrame(tick);
      };
      timerRafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(timerRafRef.current);
      if (status === 'waiting') setDisplaySeconds(0);
    }
    return () => cancelAnimationFrame(timerRafRef.current);
  }, [status]);

  const tier      = getDifficultyTier(score);
  const diffLabel = DIFFICULTY_LABELS[Math.min(tier, DIFFICULTY_LABELS.length - 1)];
  const isNewBest = status === 'dead' && score > 0 && score >= soloHighScore;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      className={`relative select-none${shaking ? ' screen-shake' : ''}`}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block cursor-pointer"
        onPointerDown={(e) => { e.preventDefault(); handleJump(); }}
        style={{ touchAction: 'manipulation', width: '100%', height: '100%' }}
      />

      {/* ── Lightning flash ────────────────────────────────────────────── */}
      <AnimatePresence>
        {gameState?.isLightning && (
          <motion.div
            key="lightning"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(230, 240, 255, 0.88)' }}
          />
        )}
      </AnimatePresence>

      {/* ── Night tint ─────────────────────────────────────────────────── */}
      {gameState?.isNight && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(10, 15, 50, 0.38)' }}
        />
      )}

      {/* ── Dark-mode difficulty tint (tier 1+) ──────────────────────── */}
      {gameState?.isDarkMode && !gameState?.isNight && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
          style={{ background: 'rgba(5, 8, 30, 0.42)' }}
        />
      )}

      {/* ── Poop button ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {status === 'playing' && (
          <motion.button
            key="poop-btn"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: 0.5 } }}
            exit={{ opacity: 0, scale: 0 }}
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); dropPoop(); }}
            className="absolute bottom-[calc(12%+52px)] right-3
                       w-11 h-11 rounded-full bg-black/40 border border-white/20
                       text-xl flex items-center justify-center
                       hover:bg-black/60 active:scale-95 transition-transform
                       backdrop-blur-sm shadow-lg"
            title="Drop Poop (widen pipe gap)"
          >
            💩
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Live score ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {status === 'playing' && (
          <motion.div
            key="score"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none
                       tabular-nums text-white text-5xl font-black
                       drop-shadow-[0_2px_8px_rgba(0,0,0,0.88)]"
          >
            {score}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Difficulty badge ──────────────────────────────────────────── */}
      <AnimatePresence>
        {status === 'playing' && tier > 0 && (
          <motion.div
            key={`tier-${tier}`}
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-16 left-1/2 -translate-x-1/2
                       text-orange-400 text-xs font-bold tracking-widest uppercase pointer-events-none"
          >
            ⚡ {diffLabel}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom HUD: timer + coins + bugs ──────────────────────────── */}
      <AnimatePresence>
        {status === 'playing' && (
          <motion.div
            key="bottom-hud"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.25 } }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-[calc(12%+12px)] left-0 right-0
                       flex justify-center gap-2 pointer-events-none"
          >
            <div className="counter-pill">
              <span>🕐</span>
              <span className="game-timer">{formatTime(displaySeconds)}</span>
            </div>
            <div className="counter-pill">
              <span>🪙</span>
              <span>{score * 3}</span>
            </div>
            <div className="counter-pill">
              <span>🐛</span>
              <span>{Math.floor(score / 5)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── OOPS! comic bubble on collision ───────────────────────────── */}
      <AnimatePresence>
        {showOops && (
          <motion.div
            key="oops"
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 8 }}
            exit={{ scale: 0, opacity: 0, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 22 }}
            className="absolute pointer-events-none"
            style={{
              top: gameState
                ? Math.max(50, Math.min(gameState.birdY - 68, height * 0.5))
                : height * 0.34,
              left: gameState
                ? Math.min(gameState.birdX + 28, width - 142)
                : width * 0.30,
            }}
          >
            <div className="comic-bubble">💥 Oops!</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tap-to-start ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {status === 'waiting' && (
          <motion.div
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onPointerDown={(e) => { e.preventDefault(); handleJump(); }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4
                       bg-black/30 cursor-pointer"
            style={{ touchAction: 'manipulation' }}
          >
            <motion.p
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="text-white text-2xl font-bold tracking-wide drop-shadow-md pointer-events-none"
            >
              Tap / Space to Start 🐦
            </motion.p>
            {soloHighScore > 0 && (
              <p className="text-yellow-300 text-sm font-semibold pointer-events-none">
                Personal Best: {soloHighScore}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Death overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {status === 'dead' && (
          <motion.div
            key="dead"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.50 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4
                       bg-black/55 backdrop-blur-sm"
          >
            <motion.p
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.55 }}
              className="text-red-400 text-4xl font-black drop-shadow-lg"
            >
              Game Over
            </motion.p>

            <div className="text-center">
              <p className="text-white text-3xl font-bold tabular-nums">{score}</p>
              <p className="text-white/50 text-xs uppercase tracking-widest mt-0.5">Score</p>
            </div>

            {/* Run summary pills */}
            <div className="flex gap-2.5">
              <div className="counter-pill">🕐&nbsp;{formatTime(displaySeconds)}</div>
              <div className="counter-pill">🪙&nbsp;{score * 3}</div>
              <div className="counter-pill">🐛&nbsp;{Math.floor(score / 5)}</div>
            </div>

            {isNewBest ? (
              <motion.p
                initial={{ scale: 0.8 }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: 3, duration: 0.35 }}
                className="text-yellow-300 font-black text-lg"
              >
                🏆 New Personal Best!
              </motion.p>
            ) : (
              <p className="text-white/60 text-sm">
                Best: <span className="text-yellow-300 font-bold">{soloHighScore}</span>
              </p>
            )}

            <div className="flex gap-3 mt-1">
              <button
                onPointerDown={(e) => { e.preventDefault(); resetGame();  }}
                className="btn-arcade text-base px-6"
              >
                🔄 Play Again
              </button>
 {/*              <button
                onPointerDown={(e) => { e.preventDefault(); onBackToMenu(); }}
                className="btn-secondary px-6 py-2.5 text-base"
              >
                Menu
              </button> */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
