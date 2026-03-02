import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoomPlayer } from '../../types';

interface Props {
  players: RoomPlayer[];
  hostId:  string;
}

// Deterministic gradient colours based on username
const AVATAR_GRADIENTS = [
  ['#F59E0B', '#EF4444'], // amber → red
  ['#06B6D4', '#6366F1'], // cyan → indigo
  ['#10B981', '#14B8A6'], // emerald → teal
  ['#EC4899', '#8B5CF6'], // pink → violet
  ['#F97316', '#FBBF24'], // orange → yellow
  ['#3B82F6', '#6366F1'], // blue → indigo
  ['#EF4444', '#EC4899'], // red → pink
  ['#8B5CF6', '#06B6D4'], // violet → cyan
] as const;

const avatarGradient = (username: string) =>
  AVATAR_GRADIENTS[username.charCodeAt(0) % AVATAR_GRADIENTS.length];

// ── Single player card ────────────────────────────────────────
const PlayerCard: React.FC<{ player: RoomPlayer; isHost: boolean; index: number }> = ({
  player,
  isHost,
  index,
}) => {
  const [from, to] = avatarGradient(player.username);
  return (
    <motion.li
      layout
      key={player.userId}
      initial={{ opacity: 0, x: -24, scale: 0.95 }}
      animate={{ opacity: 1,  x: 0,   scale: 1    }}
      exit={{    opacity: 0,  x: 24,  scale: 0.9  }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 320, damping: 28 }}
      className={[
        'glass flex items-center gap-3 px-4 py-3 rounded-2xl',
        player.ready ? 'ring-1 ring-emerald-400/30' : '',
      ].join(' ')}
    >
      {/* Avatar circle with gradient */}
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center
                   text-base font-black text-white shadow-md flex-shrink-0 relative"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      >
        {player.username[0].toUpperCase()}
        {/* Ready ring */}
        {player.ready && (
          <div
            className="absolute inset-0 rounded-full ready-glow"
            style={{ border: '2px solid #10b981' }}
          />
        )}
      </div>

      {/* Name + best score */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold truncate flex items-center gap-1.5 text-sm">
          {player.username}
          {isHost && (
            <span className="text-xs animate-crown-bounce">👑</span>
          )}
        </p>
        <p className="text-white/35 text-xs mt-0.5 flex items-center gap-1">
          <span className="text-yellow-400/60">⭐</span>
          <span>Best&nbsp;
            <span className="text-white/55 font-semibold">{player.highScore ?? 0}</span>
          </span>
        </p>
      </div>

      {/* Ready status badge */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {player.ready ? (
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full
                       text-emerald-300 border border-emerald-400/40 bg-emerald-400/10"
          >
            ✓ Ready
          </motion.span>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full
                           text-white/30 border border-white/10">
            Waiting
          </span>
        )}
      </div>
    </motion.li>
  );
};

// ── Ghost slot ────────────────────────────────────────────────
const GhostSlot: React.FC<{ index: number }> = ({ index }) => (
  <motion.li
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.12 + index * 0.07 }}
    className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-white/10"
  >
    <div className="w-11 h-11 rounded-full bg-white/5 flex-shrink-0" />
    <p className="text-white/18 text-sm italic">Waiting for player…</p>
  </motion.li>
);

// ── Animated ellipsis ─────────────────────────────────────────
const WaitingDots: React.FC = () => (
  <span className="inline-flex gap-0.5">
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        className="text-white/50"
      >
        .
      </motion.span>
    ))}
  </span>
);

// ── Main PlayerList ───────────────────────────────────────────
export const PlayerList: React.FC<Props> = ({ players, hostId }) => {
  const isSolo     = players.length <= 1;
  const readyCount = players.filter((p) => p.ready).length;
  const ghostCount = isSolo ? 3 : Math.max(0, Math.min(3, 4 - players.length));

  return (
    <div className="flex flex-col gap-3">
      {/* Section label + ready counter */}
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Players</p>
        {!isSolo && (
          <span
            className={[
              'text-xs font-bold px-2 py-0.5 rounded-full',
              readyCount === players.length
                ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                : 'text-white/40',
            ].join(' ')}
          >
            {readyCount}/{players.length} ready
          </span>
        )}
        {isSolo && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-white/45 text-xs flex items-center gap-1"
          >
            Waiting
            <WaitingDots />
          </motion.p>
        )}
      </div>

      {/* Solo banner */}
      <AnimatePresence>
        {isSolo && (
          <motion.div
            key="solo-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1,  y: 0  }}
            exit={{    opacity: 0,  y: -8 }}
            className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
          >
            <div className="text-2xl">🚪</div>
            <div>
              <p className="text-white font-bold text-sm">You're the only one here</p>
              <p className="text-white/40 text-xs mt-0.5">Share the invite link to fill the room</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player cards */}
      <ul className="flex flex-col gap-2">
        <AnimatePresence>
          {players.map((p, i) => (
            <PlayerCard
              key={p.userId}
              player={p}
              isHost={p.userId === hostId}
              index={i}
            />
          ))}
          {Array.from({ length: ghostCount }, (_, i) => (
            <GhostSlot key={`ghost-${i}`} index={i} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
};
