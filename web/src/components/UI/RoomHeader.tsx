import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  roomId:      string;
  playerCount: number;
  maxPlayers:  number;
  isHost:      boolean;
  status:      'waiting' | 'active' | 'closed';
}

const STATUS_CONFIG = {
  waiting: {
    label:  'Waiting',
    dot:    'bg-yellow-400 animate-pulse-soft',
    text:   'text-yellow-300',
    border: 'border-yellow-400/30',
    bg:     'bg-yellow-400/10',
  },
  active: {
    label:  'Live',
    dot:    'bg-emerald-400',
    text:   'text-emerald-300',
    border: 'border-emerald-400/30',
    bg:     'bg-emerald-400/10',
  },
  closed: {
    label:  'Closed',
    dot:    'bg-red-400',
    text:   'text-red-300',
    border: 'border-red-400/30',
    bg:     'bg-red-400/10',
  },
} as const;

export const RoomHeader: React.FC<Props> = ({
  roomId,
  playerCount,
  maxPlayers,
  isHost,
  status,
}) => {
  const [idCopied, setIdCopied] = useState(false);
  const cfg = STATUS_CONFIG[status];

  const copyId = async () => {
    try { await navigator.clipboard.writeText(roomId); }
    catch {
      const el = document.createElement('textarea');
      el.value = roomId;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Top row: title + status + player count */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Title with optional crown */}
          <h2 className="text-white text-xl font-black tracking-tight truncate">
            {isHost ? (
              <span className="inline-flex items-center gap-2">
                <motion.span
                  animate={{ rotate: [-5, 5, -5] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                >
                  👑
                </motion.span>
                Your Room
              </span>
            ) : (
              '🐦 Flappy Room'
            )}
          </h2>

          {/* Status pill */}
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5
                        rounded-full text-xs font-bold border ${cfg.text} ${cfg.border} ${cfg.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Player count badge */}
        <div className="flex-shrink-0 flex items-center gap-1.5 glass px-3 py-1.5 rounded-full">
          <span className="text-sm">👥</span>
          <span className="text-white text-sm font-black">
            {playerCount}
            <span className="text-white/35 font-normal text-xs">/{maxPlayers}</span>
          </span>
        </div>
      </div>

      {/* Room ID row */}
      <div className="flex items-center gap-2">
        <p className="text-white/35 text-xs uppercase tracking-widest whitespace-nowrap font-semibold">
          ID
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={copyId}
          title="Click to copy Room ID"
          className="flex items-center gap-2 glass hover:bg-white/18 transition-colors
                     rounded-xl px-3 py-1.5 group"
        >
          <span className="font-mono text-white text-sm font-bold tracking-widest">
            {roomId}
          </span>
          <span className="text-white/35 group-hover:text-white/80 transition-colors text-xs">
            {idCopied ? '✓' : '⎘'}
          </span>
        </motion.button>

        <AnimatePresence>
          {idCopied && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="text-emerald-400 text-xs font-bold"
            >
              Copied!
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
