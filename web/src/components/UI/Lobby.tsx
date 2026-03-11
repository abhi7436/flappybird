import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Socket } from 'socket.io-client';
import { useGameStore } from '../../store/gameStore';
import { useSound } from '../../hooks/useSound';
import { RoomHeader } from './RoomHeader';
import { PlayerList } from './PlayerList';
import { InviteLink } from './InviteLink';

interface Props {
  socket: Socket | null;
}

// ── Connecting spinner ────────────────────────────────────────
const ConnectingScreen: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="glass-dark w-full max-w-md mx-auto rounded-3xl p-10
               flex flex-col items-center gap-5"
  >
    <div className="relative w-16 h-16">
      <div className="absolute inset-0 rounded-full border-4 border-white/8" />
      <div
        className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin"
        style={{ borderColor: '#FFD700', borderTopColor: 'transparent' }}
      />
    </div>
    <div className="text-center">
      <p className="text-white font-bold">Connecting to room</p>
      <p className="text-white/35 text-sm mt-1">Establishing secure session…</p>
    </div>
  </motion.div>
);

// ── Connection error ──────────────────────────────────────────
const ErrorScreen: React.FC<{ message: string; onBack: () => void }> = ({
  message,
  onBack,
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="glass-dark w-full max-w-md mx-auto rounded-3xl p-8
               flex flex-col items-center gap-5"
  >
    <div className="text-5xl">⚠️</div>
    <div className="text-center">
      <p className="text-white font-semibold">Could not connect</p>
      <p className="text-white/50 text-sm mt-1">{message}</p>
    </div>
    <button onClick={onBack} className="btn-secondary px-8 py-3">
      ← Back to Menu
    </button>
  </motion.div>
);

// ── Countdown overlay ─────────────────────────────────────────
const COUNTDOWN_COLORS: Record<number, string> = {
  3: '#60a5fa', // blue
  2: '#fbbf24', // amber
  1: '#f87171', // red
  0: '#4ade80', // green for GO
};

const CountdownOverlay: React.FC<{ n: number }> = ({ n }) => {
  const isGo    = n === 0;
  const color   = COUNTDOWN_COLORS[n] ?? '#ffffff';
  const content = isGo ? 'GO! 🐦' : n.toString();
  return (
    <motion.div
      key={n}
      initial={{ scale: 2.8, opacity: 0 }}
      animate={{ scale: 1,   opacity: 1 }}
      exit={{    scale: 0.3, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 18 }}
      className="absolute inset-0 flex items-center justify-center
                 bg-black/65 backdrop-blur-sm rounded-3xl z-10 pointer-events-none"
    >
      <div className="flex flex-col items-center gap-3">
        <motion.span
          className="font-black"
          style={{
            fontSize: isGo ? '3.5rem' : '6rem',
            lineHeight: 1,
            color,
            textShadow: `0 0 30px ${color}, 0 0 60px ${color}50`,
          }}
        >
          {content}
        </motion.span>
        {!isGo && (
          <span className="text-white/50 text-sm font-semibold tracking-widest uppercase">
            Get ready!
          </span>
        )}
      </div>
    </motion.div>
  );
};

// ── Timer duration presets ─────────────────────────────────────
const TIMER_PRESETS = [
  { label: '30s',  value: 30  },
  { label: '1m',   value: 60  },
  { label: '1m30', value: 90  },
  { label: '2m',   value: 120 },
  { label: '3m',   value: 180 },
];

// ── Main Lobby ────────────────────────────────────────────────
export const Lobby: React.FC<Props> = ({ socket }) => {
  const {
    room,
    roomPlayers,
    countdown,
    user,
    setScreen,
    pendingJoinRoomId,
    setPendingJoinRoomId,
    wsError,
    setWsError,
  } = useGameStore((s) => ({
    room:                 s.room,
    roomPlayers:          s.roomPlayers,
    countdown:            s.countdown,
    user:                 s.user,
    setScreen:            s.setScreen,
    pendingJoinRoomId:    s.pendingJoinRoomId,
    setPendingJoinRoomId: s.setPendingJoinRoomId,
    wsError:              s.wsError,
    setWsError:           s.setWsError,
  }));

  const { play } = useSound();
  const [connectError, setConnectError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Timer mode state (host only) ────────────────────────────
  const [timerEnabled, setTimerEnabled]   = useState(false);
  const [timerDuration, setTimerDuration] = useState(60); // seconds

  // ── Listen for timer config broadcasts from host ────────────
  useEffect(() => {
    if (!socket) return;
    const handler = ({ enabled, durationSeconds }: { enabled: boolean; durationSeconds: number }) => {
      setTimerEnabled(enabled);
      setTimerDuration(durationSeconds);
    };
    socket.on('timer_config_updated', handler);
    return () => { socket.off('timer_config_updated', handler); };
  }, [socket]);

  // ── Broadcast timer config when host changes it ─────────────
  const updateTimerConfig = (enabled: boolean, duration: number) => {
    if (room && socket) {
      socket.emit('set_timer_config', { roomId: room.id, enabled, durationSeconds: duration });
    }
  };

  // ── Play countdown sounds driven by server countdown value ──
  useEffect(() => {
    if (countdown !== null && countdown > 0) play('countdown');
  }, [countdown, play]);

  // ── Clear wsError from the store when the Lobby unmounts ────────────
  useEffect(() => () => { setWsError(null); }, [setWsError]);

  // ── 10-second connection watchdog ──────────────────────────
  useEffect(() => {
    if (room) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    timeoutRef.current = setTimeout(
      () => setConnectError('The room could not be reached. Please try again.'),
      10_000,
    );
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [room]);

  // ── Emit join_room once socket + pending ID are available ──
  useEffect(() => {
    if (pendingJoinRoomId && socket) {
      socket.emit('join_room', { roomId: pendingJoinRoomId });
      setPendingJoinRoomId(null);
    }
  }, [pendingJoinRoomId, socket, setPendingJoinRoomId]);

  // ── Leave: emit WS + navigate to menu ─────────────────────
  const handleLeave = () => {
    play('menuClick');
    if (room) socket?.emit('leave_room', { roomId: room.id });
    setScreen('menu');
  };

  // ── Start: emit to server — server runs the 3-2-1 countdown for all players ─
  const handleStart = () => {
    if (!room || isCounting) return;
    play('menuClick');
    socket?.emit('start_game', {
      roomId: room.id,
      timerConfig: timerEnabled
        ? { enabled: true, durationSeconds: timerDuration }
        : { enabled: false, durationSeconds: 0 },
    });
  };

  // ── Derived ────────────────────────────────────────────────
  const isHost     = !!user && room?.hostId === user.id;
  const canStart   = roomPlayers.length >= 2;
  const isCounting = countdown !== null;

  // ── Render states ──────────────────────────────────────────
  // wsError (from store) takes priority: it covers real-time WS errors,
  // disconnect events, and server-sent error messages.
  const displayError = wsError ?? connectError;
  if (displayError) {
    return (
      <ErrorScreen
        message={displayError}
        onBack={() => { play('menuClick'); setWsError(null); setScreen('menu'); }}
      />
    );
  }

  if (!room) return <ConnectingScreen />;

  return (
    <div className="relative w-full max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="glass-dark rounded-3xl p-6 flex flex-col gap-6"
      >
        {/* ── Room Header ────────────────────── */}
        <RoomHeader
          roomId={room.id}
          playerCount={roomPlayers.length}
          maxPlayers={50}
          isHost={isHost}
          status={room.status}
        />

        <div className="h-px bg-white/[0.08]" />

        {/* ── Invite link ────────────────────── */}
        <InviteLink roomId={room.id} />

        <div className="h-px bg-white/[0.08]" />

        {/* ── Player list ────────────────────── */}
        <PlayerList players={roomPlayers} hostId={room.hostId} />

        {/* ── Timer mode config (host only) ──── */}
        {isHost && (
          <>
            <div className="h-px bg-white/[0.08]" />
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm font-semibold flex items-center gap-1.5">
                  ⏱️ Timer Mode
                </span>
                <button
                  onClick={() => { play('menuClick'); const next = !timerEnabled; setTimerEnabled(next); updateTimerConfig(next, timerDuration); }}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                    timerEnabled ? 'bg-green-500' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                      timerEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>

              <AnimatePresence>
                {timerEnabled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2 flex-wrap">
                      {TIMER_PRESETS.map(p => (
                        <button
                          key={p.value}
                          onClick={() => { play('menuClick'); setTimerDuration(p.value); updateTimerConfig(timerEnabled, p.value); }}
                          className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                            timerDuration === p.value
                              ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black shadow-lg shadow-orange-500/30'
                              : 'glass text-white/60 hover:text-white'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-white/35 text-xs mt-2">
                      Players respawn on death. Highest score when timer ends wins!
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* Non-host: show timer mode indicator when host enables it */}
        {!isHost && timerEnabled && (
          <>
            <div className="h-px bg-white/[0.08]" />
            <p className="text-white/50 text-sm text-center">
              ⏱️ Timer Mode · {TIMER_PRESETS.find(p => p.value === timerDuration)?.label ?? `${timerDuration}s`}
            </p>
          </>
        )}

        {/* ── Action bar ─────────────────────── */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleLeave}
            disabled={isCounting}
            className="btn-secondary flex-1 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Leave
          </button>

          {isHost ? (
            <motion.button
              whileHover={canStart && !isCounting ? { scale: 1.02 } : {}}
              whileTap={canStart && !isCounting ? { scale: 0.96 } : {}}
              onClick={handleStart}
              disabled={isCounting}
              title={!canStart ? 'Need at least 2 players to start' : undefined}
              className={[
                'flex-1 py-3 rounded-2xl font-black text-white transition-all duration-300',
                isCounting
                  ? 'glass opacity-60 cursor-not-allowed'
                  : canStart
                  ? 'btn-arcade'
                  : 'glass text-white/35 cursor-not-allowed',
              ].join(' ')}
            >
              {isCounting
                ? `Starting in ${countdown === 0 ? '…' : countdown}`
                : canStart
                ? '🚀 Start Game'
                : '⏳ Waiting for players'}
            </motion.button>
          ) : (
            <div
              className="flex-1 py-3 glass rounded-2xl flex items-center
                          justify-center text-white/35 text-sm italic"
            >
              Waiting for host to start…
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Countdown overlay ──────────────── */}
      <AnimatePresence>
        {isCounting && countdown !== null && (
          <CountdownOverlay n={countdown} />
        )}
      </AnimatePresence>
    </div>
  );
};
