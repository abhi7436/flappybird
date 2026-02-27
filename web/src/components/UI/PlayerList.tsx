import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoomPlayer } from '../../types';

interface Props {
  players: RoomPlayer[];
  hostId:  string;
}

// Deterministic avatar colours based on first letter
const AVATAR_COLOURS = [
  'from-sky-400 to-indigo-600',
  'from-emerald-400 to-teal-600',
  'from-rose-400 to-pink-600',
  'from-amber-400 to-orange-600',
  'from-violet-400 to-purple-600',
  'from-cyan-400 to-blue-600',
];
const avatarColour = (username: string) =>
  AVATAR_COLOURS[username.charCodeAt(0) % AVATAR_COLOURS.length];

// ── Single player card ────────────────────────────────────────
const PlayerCard: React.FC<{ player: RoomPlayer; isHost: boolean; index: number }> = ({
  player,
  isHost,
  index,
}) => (
  <motion.li
    layout
    key={player.userId}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20, scale: 0.9 }}
    transition={{ delay: index * 0.05 }}
    className="glass flex items-center gap-3 px-4 py-3 rounded-xl"
  >
    {/* Avatar circle */}
    <div
      className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColour(player.username)}
                  flex items-center justify-center text-base font-black text-white
                  shadow-md flex-shrink-0`}
    >
      {player.username[0].toUpperCase()}
    </div>

    {/* Name + score */}
    <div className="flex-1 min-w-0">
      <p className="text-white font-semibold truncate flex items-center gap-1.5">
        {player.username}
        {isHost && (
          <span className="text-yellow-400 text-xs font-bold">👑 Host</span>
        )}
      </p>
      <p className="text-white/40 text-xs mt-0.5">
        Best&nbsp;score:&nbsp;
        <span className="text-white/60 font-semibold">{player.highScore ?? 0}</span>
      </p>
    </div>

    {/* Ready dot */}
    <div
      title={player.ready ? 'Ready' : 'Not ready'}
      className={[
        'w-3 h-3 rounded-full flex-shrink-0 transition-all duration-500',
        player.ready
          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
          : 'bg-white/20',
      ].join(' ')}
    />
  </motion.li>
);

// ── Ghost slot ────────────────────────────────────────────────
const GhostSlot: React.FC<{ index: number }> = ({ index }) => (
  <motion.li
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.1 + index * 0.06 }}
    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed
               border-white/10"
  >
    <div className="w-10 h-10 rounded-full bg-white/5 flex-shrink-0" />
    <p className="text-white/20 text-sm italic">Waiting for player…</p>
  </motion.li>
);

// ── Animated ellipsis ─────────────────────────────────────────
const WaitingDots: React.FC = () => {
  const dots = [0, 1, 2];
  return (
    <span className="inline-flex gap-0.5">
      {dots.map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          className="text-white/60"
        >
          .
        </motion.span>
      ))}
    </span>
  );
};

// ── Main PlayerList ───────────────────────────────────────────
export const PlayerList: React.FC<Props> = ({ players, hostId }) => {
  const isSolo = players.length <= 1;
  // Show ghost slots to hint at empty seats (max 3 ghosts, only when waiting)
  const ghostCount = isSolo ? 3 : Math.max(0, Math.min(3, 4 - players.length));

  return (
    <div className="flex flex-col gap-3">
      {/* Section label */}
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-xs uppercase tracking-widest">Players</p>
        {isSolo && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-white/50 text-xs flex items-center gap-1"
          >
            Waiting for players to join
            <WaitingDots />
          </motion.p>
        )}
      </div>

      {/* Solo banner — shown prominently when only host is present */}
      <AnimatePresence>
        {isSolo && (
          <motion.div
            key="solo-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <div className="text-2xl">🚪</div>
            <div>
              <p className="text-white font-semibold text-sm">You're the only one here</p>
              <p className="text-white/40 text-xs mt-0.5">
                Share the link above to invite friends
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player cards */}
      <ul className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {players.map((p, i) => (
            <PlayerCard
              key={p.userId}
              player={p}
              isHost={p.userId === hostId}
              index={i}
            />
          ))}
        </AnimatePresence>

        {/* Ghost slots */}
        <AnimatePresence>
          {ghostCount > 0 &&
            Array.from({ length: ghostCount }).map((_, i) => (
              <GhostSlot key={`ghost-${i}`} index={i} />
            ))}
        </AnimatePresence>
      </ul>
    </div>
  );
};
