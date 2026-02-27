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
} from '../../game/BackgroundRenderer';
import { getDifficultyTier } from '@engine/GameEngine';
import { saveGuestHighScore } from '../../services/guestSession';

interface Props {
  width:       number;
  height:      number;
  onBackToMenu: () => void;
}

const GROUND_FRAC = 0.88;
const DIFFICULTY_LABELS = ['Normal', 'Hard', 'Harder', 'Insane', 'MAXIMUM'];

export const SoloCanvas: React.FC<Props> = ({ width, height, onBackToMenu }) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const bgRef        = useRef<ReturnType<typeof initBackground> | null>(null);
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

  const { status, score, gameState, jump, startGame, resetGame } =
    useGameEngine(null, null, width, height);

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
  useEffect(() => {
    let rafId: number;

    const render = (ts: number) => {
      const canvas = canvasRef.current;
      const bg = bgRef.current;
      if (!canvas || !bg) { rafId = requestAnimationFrame(render); return; }

      const ctx      = canvas.getContext('2d')!;
      const deltaMs  = lastTsRef.current ? ts - lastTsRef.current : 16.67;
      lastTsRef.current = ts;

      if (status === 'playing') {
        updateBackground(bg.clouds, bg.grass, width, deltaMs);
      }

      // Update bird animation state each frame
      const velocity  = gameState ? gameState.birdRotation / 3 : 0;
      const nearCol   = !!gameState && gameState.pipes.some(
        p => p.x > gameState.birdX - 20 && p.x < gameState.birdX + 90,
      );
      scoreRef.current = score;
      BirdRenderer.update(birdAnimRef.current, ts, velocity, scoreRef.current, nearCol, status === 'dead');

      drawBackground(ctx, width, height, colors, bg.stars, bg.clouds, bg.grass, bg.rocks, ts);

      if (gameState) {
        for (const pipe of gameState.pipes) {
          drawPipe(ctx, pipe.x, pipe.gapY, pipe.gapHeight, pipe.width, height * GROUND_FRAC);
        }
        drawBird(ctx, gameState.birdX, gameState.birdY, gameState.birdRotation, skin, birdAnimRef.current);
      } else {
        drawBird(ctx, width * 0.25, height / 2, 0, skin, birdAnimRef.current);
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [gameState, colors, skin, width, height, status]);

  const tier      = getDifficultyTier(score);
  const diffLabel = DIFFICULTY_LABELS[Math.min(tier, DIFFICULTY_LABELS.length - 1)];
  const isNewBest = status === 'dead' && score > 0 && score >= soloHighScore;

  return (
    <div className="relative select-none" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block rounded-2xl shadow-2xl cursor-pointer"
        onClick={handleJump}
      />

      {/* Live score */}
      <AnimatePresence>
        {status === 'playing' && (
          <motion.div
            key="score"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2
                       text-white text-5xl font-black drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
          >
            {score}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Difficulty badge (once tier > 0) */}
      <AnimatePresence>
        {status === 'playing' && tier > 0 && (
          <motion.div
            key={`tier-${tier}`}
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-16 left-1/2 -translate-x-1/2
                       text-orange-400 text-xs font-bold tracking-widest uppercase"
          >
            ⚡ {diffLabel}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap-to-start */}
      <AnimatePresence>
        {status === 'waiting' && (
          <motion.div
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4
                       bg-black/30 rounded-2xl"
          >
            <motion.p
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="text-white text-2xl font-bold tracking-wide drop-shadow-md"
            >
              Tap / Space to Start
            </motion.p>
            {soloHighScore > 0 && (
              <p className="text-yellow-300 text-sm font-semibold">
                Personal Best: {soloHighScore}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Death overlay */}
      <AnimatePresence>
        {status === 'dead' && (
          <motion.div
            key="dead"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4
                       bg-black/55 rounded-2xl backdrop-blur-sm"
          >
            <p className="text-red-400 text-4xl font-black drop-shadow-lg">Game Over</p>

            <div className="text-center">
              <p className="text-white text-3xl font-bold">{score}</p>
              <p className="text-white/50 text-xs uppercase tracking-widest mt-0.5">Score</p>
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

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => { resetGame(); startGame(); }}
                className="btn-primary px-6 py-2.5 text-base"
              >
                Play Again
              </button>
              <button
                onClick={onBackToMenu}
                className="btn-secondary px-6 py-2.5 text-base"
              >
                Menu
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
