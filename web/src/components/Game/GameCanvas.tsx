import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
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

interface Props {
  width:   number;
  height:  number;
  socket:  Socket | null;
  roomId:  string | null;
}

const GROUND_FRAC = 0.88; // fraction of height that is sky

export const GameCanvas: React.FC<Props> = ({ width, height, socket, roomId }) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const bgRef        = useRef<{ stars: Star[]; clouds: Cloud[] } | null>(null);
  const lastTsRef    = useRef<number>(0);
  const birdAnimRef  = useRef<BirdAnimState>(BirdRenderer.createState());
  const scoreRef     = useRef(0);

  const selectedSkin = useGameStore((s) => s.selectedSkin);
  const skin = BIRD_SKINS[selectedSkin];

  const colors = useDayNight(true);

  const { status, score, gameState, jump, startGame, resetGame } =
    useGameEngine(socket, roomId, width, height);

  // Initialise background pool once
  useLayoutEffect(() => {
    bgRef.current = initBackground(width, height);
  }, [width, height]);

  // Keyboard / touch jump
  const handleJump = useCallback(() => {
    if (status === 'waiting') {
      startGame();
    } else if (status === 'playing') {
      jump();
    }
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

  // ── Multiplayer auto-start ───────────────────────────────────
  // GameCanvas only mounts when the 'game' screen is active, which happens
  // immediately after `game_started` fires on all clients. Starting the
  // engine here ensures every player's local simulation begins in sync.
  useEffect(() => {
    if (roomId) startGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally fires once on mount only

  // ── Render loop ─────────────────────────────────────────
  useEffect(() => {
    let rafId: number;

    const render = (ts: number) => {
      const canvas = canvasRef.current;
      const bg = bgRef.current;
      if (!canvas || !bg) {
        rafId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d')!;
      const deltaMs = lastTsRef.current ? ts - lastTsRef.current : 16.67;
      lastTsRef.current = ts;

      // Advance background
      if (status === 'playing') {
        updateBackground(bg.clouds, width, deltaMs);
      }

      // Update bird animation state
      const velocity  = gameState ? gameState.birdRotation / 3 : 0;
      const nearCol   = !!gameState && gameState.pipes.some(
        p => p.x > gameState.birdX - 20 && p.x < gameState.birdX + 90,
      );
      scoreRef.current = score;
      BirdRenderer.update(birdAnimRef.current, ts, velocity, scoreRef.current, nearCol, status === 'dead');

      // Draw background
      drawBackground(ctx, width, height, colors, bg.stars, bg.clouds, ts);

      // Draw pipes + bird
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

  const isDead = status === 'dead';

  return (
    <div className="relative select-none" style={{ width, height }}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block rounded-2xl shadow-2xl cursor-pointer"
        onClick={handleJump}
      />

      {/* Score badge */}
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

      {/* Tap-to-start overlay */}
      <AnimatePresence>
        {status === 'waiting' && (
          <motion.div
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/30 rounded-2xl"
          >
            <motion.p
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="text-white text-2xl font-bold tracking-wide drop-shadow-md"
            >
              Tap / Space to Start
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Death overlay */}
      <AnimatePresence>
        {isDead && (
          <motion.div
            key="dead"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/50 rounded-2xl backdrop-blur-sm"
          >
            {roomId ? (
              /* Multiplayer — dead but others may still be alive */
              <>
                <p className="text-red-400 text-5xl font-black drop-shadow-lg">💀 You&apos;re Out!</p>
                <div className="text-center">
                  <p className="text-white text-3xl font-bold">{score}</p>
                  <p className="text-white/50 text-xs uppercase tracking-widest mt-0.5">Final Score</p>
                </div>
                <p className="text-white/40 text-sm italic animate-pulse">Watching others play…</p>
              </>
            ) : (
              /* Solo / no-room fallback */
              <>
                <p className="text-red-400 text-4xl font-black drop-shadow-lg">Game Over</p>
                <p className="text-white text-2xl font-semibold">Score: {score}</p>
                <button
                  onClick={() => { resetGame(); startGame(); }}
                  className="btn-primary text-lg px-8 py-3"
                >
                  Play Again
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
