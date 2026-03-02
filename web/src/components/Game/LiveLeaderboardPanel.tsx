/**
 * LiveLeaderboardPanel — Phase 4 full leaderboard side panel.
 *
 * Features:
 *   ✦ All players (not just top-3), scrollable
 *   ✦ Crown 👑 for rank #1 with gold accent bar
 *   ✦ Animated ▲▼ position-change indicator using previousRank
 *   ✦ Score badge that gold-flashes on each update (keyed by score value)
 *   ✦ Active power-up emoji badge (fed from store, auto-expires after 12 s)
 *   ✦ Dead players dimmed; layout-animated reordering via Framer Motion
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LeaderboardEntry } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────────

const POWERUP_MAX_MS = 12_000; // max ms we show the badge before it auto-expires

const POWERUP_EMOJIS: Record<string, string> = {
  shield:       '🛡',
  slow_pipes:   '🌀',
  double_score: '✖2',
  slow_motion:  '⏱',
  magnet:       '🧲',
  // Phase 2 additions
  invincibility: '✨',
  speed_boost:   '⚡',
  tiny_bird:     '🐤',
};

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  currentUserId:  string | null;
  leaderboard:    LeaderboardEntry[];
  /** Keyed by userId → { type, activatedAt } from store */
  playerPowerUps: Record<string, { type: string; activatedAt: number }>;
}

// ── Component ──────────────────────────────────────────────────────────────

export const LiveLeaderboardPanel: React.FC<Props> = ({
  currentUserId,
  leaderboard,
  playerPowerUps,
}) => {
  const now = Date.now();

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0, transition: { delay: 0.32, duration: 0.28 } }}
      exit={{ opacity: 0, x: 32, transition: { duration: 0.18 } }}
      className="absolute top-14 right-3 rounded-xl overflow-hidden"
      style={{
        width:            '152px',
        background:       'rgba(8, 10, 24, 0.85)',
        border:           '1px solid rgba(255,255,255,0.10)',
        backdropFilter:   'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow:        '0 4px 28px rgba(0,0,0,0.52)',
      }}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="px-2.5 py-1.5 flex items-center gap-1.5 border-b border-white/10">
        <span className="text-yellow-400 text-[11px]">🏆</span>
        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">
          Live
        </span>
        <span className="ml-auto text-[9px] text-white/25 tabular-nums">
          {leaderboard.length}p
        </span>
      </div>

      {/* ── Player rows ──────────────────────────────────────────── */}
      <div style={{ maxHeight: '264px', overflowY: 'auto' }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {leaderboard.map((entry) => {
            const isSelf    = entry.userId === currentUserId;
            const isFirst   = entry.rank === 1;
            const rankUp    = entry.previousRank !== null &&
                              entry.previousRank > entry.rank;  // rank number decreased = moved up
            const rankDown  = entry.previousRank !== null &&
                              entry.previousRank < entry.rank;
            const pu        = playerPowerUps[entry.userId];
            const puActive  = pu && (now - pu.activatedAt) < POWERUP_MAX_MS;
            const puEmoji   = puActive ? (POWERUP_EMOJIS[pu.type] ?? '⚡') : null;
            const isOnFire  = entry.score >= 10 && entry.isAlive;  // fire indicator

            return (
              <motion.div
                key={entry.userId}
                layout
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: entry.isAlive ? 1 : 0.30, x: 0 }}
                exit={{ opacity: 0, x: 14, transition: { duration: 0.16 } }}
                transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                className={[
                  'relative flex items-center gap-1 px-2 py-[5px] text-xs',
                  isSelf   ? 'bg-yellow-400/[0.13]' : '',
                  isFirst && !isSelf ? 'bg-amber-400/[0.07]' : '',
                  isFirst && isSelf  ? 'bg-yellow-400/[0.18]' : '',
                ].join(' ')}
              >
                {/* Gold accent bar for #1 */}
                {isFirst && (
                  <span
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{
                      background: 'linear-gradient(180deg,#ffd700 0%,#ff9900 100%)',
                      borderRadius: '0 2px 2px 0',
                    }}
                  />
                )}

                {/* Rank badge / Crown */}
                <span className="w-5 text-center flex-shrink-0 leading-none">
                  {isFirst
                    ? <span className="text-[13px]">👑</span>
                    : <span className="text-white/40 text-[10px] font-bold">{entry.rank}</span>
                  }
                </span>

                {/* ↑↓ rank-change indicator */}
                <AnimatePresence>
                  {(rankUp || rankDown) && (
                    <motion.span
                      key={`mv-${entry.userId}-${entry.rank}`}
                      initial={{ opacity: 0, y: rankUp ? 5 : -5, scale: 0.6 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.2 } }}
                      transition={{ type: 'spring', stiffness: 480, damping: 22 }}
                      className={`absolute left-[23px] top-[2px] text-[8px] font-black leading-none select-none ${
                        rankUp ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {rankUp ? '▲' : '▼'}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Username */}
                <span
                  className={`flex-1 truncate min-w-0 leading-snug ${
                    isSelf
                      ? 'text-yellow-200 font-black'
                      : isFirst
                        ? 'text-amber-300 font-bold'
                        : 'text-white/80 font-semibold'
                  }`}
                >
                  {entry.username}
                </span>

                {/* Fire score-streak badge */}
                {isOnFire && (
                  <span
                    className="flex-shrink-0 text-[10px] leading-none"
                    title={`Score ${entry.score}`}
                  >
                    🔥
                  </span>
                )}

                {/* Active power-up badge */}
                <AnimatePresence>
                  {puEmoji && (
                    <motion.span
                      key={`pu-${entry.userId}-${pu?.activatedAt}`}
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                      className="flex-shrink-0 text-[11px]"
                      title={pu?.type}
                    >
                      {puEmoji}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Score — gold-flash on change via key */}
                <motion.span
                  key={`${entry.userId}-sc-${entry.score}`}
                  initial={{ color: '#ffd700', scale: 1.4 }}
                  animate={{
                    color: isSelf ? '#fde68a' : 'rgba(255,255,255,0.48)',
                    scale: 1,
                  }}
                  transition={{ duration: 0.38 }}
                  className="flex-shrink-0 tabular-nums text-[11px] font-semibold"
                >
                  {entry.score}
                </motion.span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
