import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameEngine } from '../../hooks/useGameEngine';
import { useDayNight } from '../../hooks/useDayNight';
import { useSound } from '../../hooks/useSound';
import { useGameStore } from '../../store/gameStore';
import { BIRD_SKINS, drawBird, drawPipe, BirdRenderer, BirdAnimState, drawCrownAboveBird } from '../../game/BirdSkins';
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
import { LiveLeaderboardPanel } from './LiveLeaderboardPanel';

interface Props {
  width:   number;
  height:  number;
  socket:  Socket | null;
  roomId:  string | null;
}

const GROUND_FRAC = 0.88; // fraction of height that is sky

export const GameCanvas: React.FC<Props> = ({ width, height, socket, roomId }) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const bgRef        = useRef<{ stars: Star[]; clouds: Cloud[]; midLayer: MidElement[] } | null>(null);
  const lastTsRef    = useRef<number>(0);
  const birdAnimRef  = useRef<BirdAnimState>(BirdRenderer.createState());
  const scoreRef     = useRef(0);

  const selectedSkin = useGameStore((s) => s.selectedSkin);
  const skin = BIRD_SKINS[selectedSkin];

  const colors = useDayNight(true);
  const { play } = useSound();

  // ── Live leaderboard + current-player identity ───────────────────
  const { leaderboard, user, guest, playerPowerUps } = useGameStore((s) => ({
    leaderboard:    s.leaderboard,
    user:           s.user,
    guest:          s.guest,
    playerPowerUps: s.playerPowerUps,
  }));
  const currentUserId = user?.id ?? guest?.id ?? null;
  const top3          = leaderboard.slice(0, 3);
  const isLeader      = top3.length > 0 && top3[0].userId === currentUserId;

  // ── UI state ──────────────────────────────────────────────────────
  const [shaking,        setShaking]        = useState(false);
  const [showOops,       setShowOops]       = useState(false);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [showTaunt,      setShowTaunt]      = useState(false);
  const [tauntText,      setTauntText]      = useState('');
  const timerRafRef      = useRef<number>(0);
  const gameStartTsRef   = useRef<number>(0);
  const prevOtherTopRef  = useRef<number>(0); // highest rival score
  const coinStreakRndr   = useRef(0);         // shadow ref for rAF loop
  const TAUNTS = ['😜 Passed ya!', '💨 Too slow!', '🐦 Bye bye~', '😤 Outta my way!'];

  const { status, score, gameState, jump, startGame, resetGame, dropPoop, coinStreak } =
    useGameEngine(socket, roomId, width, height);

  // ── Hot refs — updated each render, read inside the rAF closure ─────────
  // Avoids putting volatile values in the render loop useEffect deps array,
  // which would cancel+restart the rAF 60× per second.
  const gameStateRef  = useRef(gameState);
  const statusRef     = useRef(status);
  const colorsRef     = useRef(colors);
  const skinRef       = useRef(skin);
  const isLeaderRef   = useRef(isLeader);
  gameStateRef.current = gameState;
  statusRef.current    = status;
  colorsRef.current    = colors;
  skinRef.current      = skin;
  isLeaderRef.current  = isLeader;
  scoreRef.current     = score;

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
  // Deps: [width, height] only. All volatile state read from refs
  // so the loop is never torn down and restarted mid-game.
  useEffect(() => {
    let rafId: number;

    const render = (ts: number) => {
      const canvas = canvasRef.current;
      const bg = bgRef.current;
      if (!canvas || !bg) {
        rafId = requestAnimationFrame(render);
        return;
      }

      const gs     = gameStateRef.current;
      const st     = statusRef.current;
      const clrs   = colorsRef.current;
      const sk     = skinRef.current;
      const leader = isLeaderRef.current;

      const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
      const deltaMs = lastTsRef.current ? ts - lastTsRef.current : 16.67;
      lastTsRef.current = ts;

      // Advance background
      if (st === 'playing') {
        updateBackground(bg.clouds, bg.midLayer, width, deltaMs);
      }

      // Update bird animation state
      const velocity  = gs ? gs.birdRotation / 3 : 0;
      const nearCol   = !!gs && gs.pipes.some(
        p => p.x > gs.birdX - 20 && p.x < gs.birdX + 90,
      );
      BirdRenderer.update(birdAnimRef.current, ts, velocity, scoreRef.current, nearCol, st === 'dead', Math.min(1, coinStreakRndr.current / 5));

      // Draw background
      drawBackground(ctx, width, height, clrs, bg.stars, bg.clouds, bg.midLayer, ts);

      // Draw pipes + bird
      if (gs) {
        for (const pipe of gs.pipes) {
          drawPipe(ctx, pipe.x, pipe.gapY, pipe.gapHeight + pipe.tempGapBonus, pipe.width, height * GROUND_FRAC);
        }
        drawBird(ctx, gs.birdX, gs.birdY, gs.birdRotation, sk, birdAnimRef.current);
        // Crown for current leader
        if (leader) {
          drawCrownAboveBird(ctx, gs.birdX + gs.birdW / 2, gs.birdY + gs.birdH / 2);
        }
        // Dynamic entities
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

  // ── Keep coinStreakRndr ref in sync (avoids rAF closure stale) ────
  useEffect(() => { coinStreakRndr.current = coinStreak; }, [coinStreak]);

  // ── Taunt bubble when we overtake the current leader ─────────────
  useEffect(() => {
    if (status !== 'playing' || top3.length < 2) return;
    const rivals = top3.filter(e => e.userId !== currentUserId);
    const topRival = rivals[0]?.score ?? 0;
    if (score > topRival && score > prevOtherTopRef.current) {
      const text = TAUNTS[Math.floor(Math.random() * TAUNTS.length)];
      setTauntText(text);
      setShowTaunt(true);
      play('taunt');
      const t = setTimeout(() => setShowTaunt(false), 2000);
      return () => clearTimeout(t);
    }
    prevOtherTopRef.current = topRival;
  }, [score, top3, status]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Screen shake + OOPS! bubble on death ──────────────────────────
  useEffect(() => {
    if (status !== 'dead') return;
    setShaking(true);
    setShowOops(true);
    const t1 = setTimeout(() => setShaking(false), 460);
    const t2 = setTimeout(() => setShowOops(false), 1650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Game timer (counts up while playing) ───────────────────────────
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

  const isDead = status === 'dead';

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      className={`relative select-none${shaking ? ' screen-shake' : ''}`}
      style={{ width, height, touchAction: 'none' }}
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block rounded-2xl shadow-2xl cursor-pointer"
        onPointerDown={(e) => { e.preventDefault(); handleJump(); }}
        style={{ touchAction: 'none' }}
      />

      {/* ── Lightning flash ──────────────────────────────────────────── */}
      <AnimatePresence>
        {gameState?.isLightning && (
          <motion.div
            key="lightning"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ background: 'rgba(230, 240, 255, 0.88)' }}
          />
        )}
      </AnimatePresence>

      {/* ── Night tint ───────────────────────────────────────────────── */}
      {gameState?.isNight && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ background: 'rgba(10, 15, 50, 0.38)' }}
        />
      )}

      {/* ── Dark-mode difficulty tint (tier 1+) ───────────────────── */}
      {gameState?.isDarkMode && !gameState?.isNight && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-1000"
          style={{ background: 'rgba(5, 8, 30, 0.42)' }}
        />
      )}
      {/* ── Taunt bubble (when overtaking a rival) ─────────────────── */}
      <AnimatePresence>
        {showTaunt && gameState && (
          <motion.div
            key="taunt"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, y: -8 }}
            exit={{ scale: 0, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            className="absolute pointer-events-none font-black text-sm"
            style={{
              top:  Math.max(36, gameState.birdY - 52),
              left: Math.min(gameState.birdX + 44, width - 148),
              background: 'linear-gradient(135deg, #ffe066, #ff9933)',
              borderRadius: '18px',
              padding: '4px 14px',
              color: '#1a0800',
              border: '2px solid #b87800',
              whiteSpace: 'nowrap',
              filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.45))',
            }}
          >
            {tauntText}
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── Poop button (shows when playing) ─────────────────────────── */}
      <AnimatePresence>
        {status === 'playing' && (
          <motion.button
            key="poop-btn"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1, transition: { delay: 0.5 } }}
            exit={{ opacity: 0, scale: 0 }}
            onClick={(e) => { e.stopPropagation(); dropPoop(); }}
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

      {/* ── Centre score badge ───────────────────────────────────────── */}
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

      {/* ── Live full leaderboard panel (right side) ─────────────── */}
      <AnimatePresence>
        {status === 'playing' && leaderboard.length > 0 && (
          <LiveLeaderboardPanel
            currentUserId={currentUserId}
            leaderboard={leaderboard}
            playerPowerUps={playerPowerUps}
          />
        )}
      </AnimatePresence>

      {/* ── Bottom HUD: timer + coins + bugs ────────────────────────── */}
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

      {/* ── OOPS! comic speech bubble on collision ───────────────────── */}
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

      {/* ── Tap-to-start overlay ─────────────────────────────────────── */}
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
              transition={{ repeat: Infinity, duration: 1.25 }}
              className="text-white text-2xl font-bold tracking-wide drop-shadow-md"
            >
              Tap / Space to Start 🐦
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Death overlay ────────────────────────────────────────────── */}
      <AnimatePresence>
        {isDead && (
          <motion.div
            key="dead"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.50 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-5
                       bg-black/55 rounded-2xl backdrop-blur-sm"
          >
            {roomId ? (
              <>
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.55 }}
                  className="text-red-400 text-5xl font-black drop-shadow-lg"
                >
                  💀 You&apos;re Out!
                </motion.p>
                <div className="text-center">
                  <p className="text-white text-3xl font-bold tabular-nums">{score}</p>
                  <p className="text-white/50 text-xs uppercase tracking-widest mt-0.5">
                    Final Score
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <div className="counter-pill">🪙&nbsp;{score * 3} coins</div>
                  <div className="counter-pill">🐛&nbsp;{Math.floor(score / 5)} bugs</div>
                </div>
                <p className="text-white/38 text-sm italic animate-pulse">
                  Watching others play…
                </p>
              </>
            ) : (
              <>
                <motion.p
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.55 }}
                  className="text-red-400 text-4xl font-black drop-shadow-lg"
                >
                  Game Over
                </motion.p>
                <p className="text-white text-2xl font-semibold tabular-nums">{score}</p>
                <div className="flex gap-2.5">
                  <div className="counter-pill">🪙&nbsp;{score * 3}</div>
                  <div className="counter-pill">🐛&nbsp;{Math.floor(score / 5)}</div>
                  <div className="counter-pill">🕐&nbsp;{formatTime(displaySeconds)}</div>
                </div>
                <button
                  onPointerDown={(e) => { e.preventDefault(); resetGame(); startGame(); }}
                  className="btn-arcade text-base mt-1"
                >
                  🔄 Play Again
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
