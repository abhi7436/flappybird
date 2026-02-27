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
      <div className="absolute inset-0 rounded-full border-4 border-white/10" />
      <div className="absolute inset-0 rounded-full border-4 border-sky-400
                      border-t-transparent animate-spin" />
    </div>
    <div className="text-center">
      <p className="text-white font-semibold">Connecting to room</p>
      <p className="text-white/40 text-sm mt-1">Establishing secure session…</p>
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
const CountdownOverlay: React.FC<{ n: number }> = ({ n }) => (
  <motion.div
    key={n}
    initial={{ scale: 2.5, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0.4, opacity: 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    className="absolute inset-0 flex items-center justify-center
               bg-black/60 backdrop-blur-sm rounded-3xl z-10 pointer-events-none"
  >
    <span className="text-white font-black text-8xl drop-shadow-[0_0_32px_rgba(255,215,0,0.8)]">
      {n === 0 ? '🐦' : n}
    </span>
  </motion.div>
);

// ── Main Lobby ────────────────────────────────────────────────
export const Lobby: React.FC<Props> = ({ socket }) => {
  const {
    room,
    roomPlayers,
    user,
    setScreen,
    pendingJoinRoomId,
    setPendingJoinRoomId,
    wsError,
    setWsError,
  } = useGameStore((s) => ({
    room:                 s.room,
    roomPlayers:          s.roomPlayers,
    user:                 s.user,
    setScreen:            s.setScreen,
    pendingJoinRoomId:    s.pendingJoinRoomId,
    setPendingJoinRoomId: s.setPendingJoinRoomId,
    wsError:              s.wsError,
    setWsError:           s.setWsError,
  }));

  const { play } = useSound();
  const [countdown, setCountdown]       = useState<number | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── Countdown → start_game ─────────────────────────────────
  const handleStart = () => {
    if (!room) return;
    play('menuClick');

    let n = 3;
    setCountdown(n);
    const iv = setInterval(() => {
      n--;
      if (n < 0) {
        clearInterval(iv);
        setCountdown(null);
        socket?.emit('start_game', { roomId: room.id });
      } else {
        setCountdown(n);
        if (n > 0) play('countdown');
      }
    }, 1000);
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
              whileTap={canStart && !isCounting ? { scale: 0.96 } : {}}
              onClick={handleStart}
              disabled={isCounting}
              title={!canStart ? 'Need at least 2 players to start' : undefined}
              className={[
                'flex-1 py-3 rounded-2xl font-bold text-white transition-all duration-300',
                isCounting
                  ? 'glass opacity-60 cursor-not-allowed'
                  : canStart
                  ? 'btn-primary'
                  : 'glass text-white/40 cursor-not-allowed',
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
                          justify-center text-white/40 text-sm italic"
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
