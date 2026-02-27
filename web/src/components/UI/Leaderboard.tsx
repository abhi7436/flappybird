import React, { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { LeaderboardEntry } from '../../types';

interface Props {
  visible: boolean;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ── Smooth score counter ─────────────────────────────────────
const AnimatedScore: React.FC<{ value: number }> = ({ value }) => {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef  = useRef<number>(0);

  useEffect(() => {
    const start = prevRef.current;
    const end   = value;
    cancelAnimationFrame(rafRef.current);
    if (start === end) return;

    const duration  = 250;
    const startTime = performance.now();

    const update = (t: number) => {
      const p     = Math.min((t - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(start + (end - start) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(update);
      else prevRef.current = end;
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <>{display}</>;
};

// ── Rank-movement indicator (↑N / ↓N / —) ───────────────────
const RankBadge: React.FC<{ prev: number | null; curr: number }> = ({ prev, curr }) => {
  if (prev === null) return <span className="w-6 flex-shrink-0" />;
  const diff = prev - curr; // positive = improved (lower number is better rank)

  if (diff === 0) {
    return <span className="w-6 text-center text-white/20 text-xs flex-shrink-0">─</span>;
  }

  return (
    <motion.span
      key={`${prev}->${curr}`}
      initial={{ opacity: 0, y: diff > 0 ? 5 : -5 }}
      animate={{ opacity: 1, y: 0 }}
      className={[
        'w-6 text-center text-xs font-bold flex-shrink-0',
        diff > 0 ? 'text-emerald-400' : 'text-red-400',
      ].join(' ')}
    >
      {diff > 0 ? `↑${diff}` : `↓${Math.abs(diff)}`}
    </motion.span>
  );
};

// ── Single leaderboard row ───────────────────────────────────
const EntryRow: React.FC<{
  entry:           LeaderboardEntry;
  isCurrentPlayer: boolean;
}> = memo(({ entry, isCurrentPlayer }) => {
  const medal = MEDAL[entry.rank];

  return (
    <motion.li
      layoutId={`lb-${entry.userId}`}
      layout="position"
      initial={{ opacity: 0, x: 24 }}
      animate={{
        opacity: entry.isAlive ? 1 : 0.4,
        x: 0,
        transition: { type: 'spring', stiffness: 400, damping: 32 },
      }}
      exit={{ opacity: 0, x: -18, transition: { duration: 0.15 } }}
      className={[
        'flex items-center gap-2 px-3 py-1.5 rounded-xl',
        isCurrentPlayer
          ? 'bg-gradient-to-r from-yellow-400/25 to-amber-400/10 ring-1 ring-yellow-400/50'
          : entry.rank <= 3
          ? 'bg-white/8'
          : 'bg-white/4',
      ].join(' ')}
    >
      {/* Rank number */}
      <span className="w-5 text-center text-xs font-bold text-white/50 flex-shrink-0">
        {medal ?? entry.rank}
      </span>

      {/* Movement badge */}
      <RankBadge prev={entry.previousRank} curr={entry.rank} />

      {/* Avatar initial */}
      <div
        className={[
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow flex-shrink-0',
          isCurrentPlayer
            ? 'bg-gradient-to-br from-yellow-400 to-amber-600'
            : 'bg-gradient-to-br from-sky-500 to-indigo-600',
        ].join(' ')}
      >
        {entry.username[0].toUpperCase()}
      </div>

      {/* Username */}
      <span
        className={[
          'flex-1 min-w-0 truncate text-xs font-medium',
          isCurrentPlayer ? 'text-yellow-200' : 'text-white',
        ].join(' ')}
      >
        {entry.username}
        {isCurrentPlayer && <span className="text-yellow-400/60 ml-1 text-[10px]">(you)</span>}
      </span>

      {/* Alive dot */}
      <span
        className={[
          'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-500',
          entry.isAlive
            ? 'bg-emerald-400 shadow-[0_0_5px_#10b981]'
            : 'bg-white/15',
        ].join(' ')}
      />

      {/* Animated score */}
      <span
        className={[
          'w-9 text-right text-xs font-mono font-bold flex-shrink-0',
          isCurrentPlayer ? 'text-yellow-100' : 'text-white',
        ].join(' ')}
      >
        <AnimatedScore value={entry.score} />
      </span>
    </motion.li>
  );
});
EntryRow.displayName = 'EntryRow';

// ── Public component ─────────────────────────────────────────
export const Leaderboard: React.FC<Props> = ({ visible }) => {
  const leaderboard = useGameStore((s) => s.leaderboard);
  const userId      = useGameStore((s) => s.user?.id);
  const top10       = leaderboard.slice(0, 10);

  // If current player is ranked beyond 10, pin them at the bottom
  const myEntry    = leaderboard.find((e) => e.userId === userId);
  const pinMyEntry = myEntry && myEntry.rank > 10;

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          key="leaderboard"
          initial={{ opacity: 0, x: 40, scale: 0.97 }}
          animate={{ opacity: 1, x: 0,  scale: 1 }}
          exit={{ opacity: 0, x: 40 }}
          className="glass w-60 rounded-2xl p-3 flex flex-col gap-1"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-1 mb-0.5">
            <h2 className="text-white font-bold text-sm tracking-wide">Live Rankings</h2>
            <span className="text-white/30 text-xs">{leaderboard.length}p</span>
          </div>

          {top10.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-4">No players yet</p>
          ) : (
            <LayoutGroup id="leaderboard">
              <ul className="flex flex-col gap-0.5">
                <AnimatePresence initial={false}>
                  {top10.map((entry) => (
                    <EntryRow
                      key={entry.userId}
                      entry={entry}
                      isCurrentPlayer={entry.userId === userId}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </LayoutGroup>
          )}

          {/* Pinned row when player is outside top 10 */}
          {pinMyEntry && (
            <>
              <div className="h-px bg-white/10 mx-2 my-0.5" />
              <EntryRow entry={myEntry} isCurrentPlayer />
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
