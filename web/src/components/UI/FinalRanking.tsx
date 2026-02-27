import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';

interface Props {
  onDismiss: () => void;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function rankMessage(rank: number, total: number): string {
  if (rank === 1)                                  return 'You won the room! 🎉';
  if (rank <= 3)                                   return 'Top 3 finish — incredible!';
  if (rank <= Math.ceil(total * 0.1))              return `Top 10% — well played!`;
  if (rank <= Math.ceil(total * 0.25))             return `Top 25% — solid run!`;
  return 'Better luck next time!';
}

const RowVariants = {
  hidden:  { opacity: 0, x: 20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.18 + i * 0.07, type: 'spring' as const, stiffness: 320, damping: 28 },
  }),
};

export const FinalRankingOverlay: React.FC<Props> = ({ onDismiss }) => {
  const { finalRanking, leaderboard, user } = useGameStore((s) => ({
    finalRanking: s.finalRanking,
    leaderboard:  s.leaderboard,
    user:         s.user,
  }));

  return (
    <AnimatePresence>
      {finalRanking && (
        <motion.div
          key="final-ranking-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={onDismiss}
        >
          <motion.div
            key="final-ranking-card"
            initial={{ scale: 0.88, y: 32, opacity: 0 }}
            animate={{ scale: 1,    y: 0,  opacity: 1 }}
            exit={{    scale: 0.88, y: 32, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="glass-dark w-full max-w-sm rounded-3xl p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Rank badge ── */}
            <div className="flex flex-col items-center gap-2">
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.1 }}
                className={[
                  'w-24 h-24 rounded-full flex items-center justify-center',
                  'text-5xl font-black shadow-2xl',
                  finalRanking.rank === 1
                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-yellow-500/40'
                    : finalRanking.rank <= 3
                    ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white'
                    : 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white',
                ].join(' ')}
              >
                {MEDAL[finalRanking.rank] ?? `#${finalRanking.rank}`}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <p className="text-white text-2xl font-black">
                  #{finalRanking.rank}
                  <span className="text-white/40 text-base font-normal ml-1">
                    of {finalRanking.totalPlayers}
                  </span>
                </p>
                <p className="text-white/55 text-sm mt-0.5">
                  {rankMessage(finalRanking.rank, finalRanking.totalPlayers)}
                </p>
              </motion.div>
            </div>

            {/* ── Your score ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.22 }}
              className="flex items-center justify-center gap-6 bg-white/5 rounded-2xl py-4"
            >
              <div className="text-center">
                <p className="text-white/35 text-xs uppercase tracking-widest mb-1">Your Score</p>
                <p className="text-white text-4xl font-black">{finalRanking.finalScore}</p>
              </div>
            </motion.div>

            {/* ── Final standings (top 5) ── */}
            {leaderboard.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-white/35 text-xs uppercase tracking-widest">Final Standings</p>
                <ul className="flex flex-col gap-1">
                  {leaderboard.slice(0, 5).map((entry, i) => {
                    const isSelf = entry.userId === user?.id;
                    return (
                      <motion.li
                        key={entry.userId}
                        custom={i}
                        variants={RowVariants}
                        initial="hidden"
                        animate="visible"
                        className={[
                          'flex items-center gap-3 px-3 py-2 rounded-xl',
                          isSelf
                            ? 'bg-gradient-to-r from-yellow-400/25 to-amber-400/10 ring-1 ring-yellow-400/40'
                            : 'bg-white/5',
                        ].join(' ')}
                      >
                        <span className="w-5 text-center text-sm">
                          {MEDAL[entry.rank] ?? entry.rank}
                        </span>
                        <span
                          className={[
                            'flex-1 truncate text-sm font-medium',
                            isSelf ? 'text-yellow-200' : 'text-white',
                          ].join(' ')}
                        >
                          {entry.username}
                          {isSelf && <span className="text-yellow-400/60 ml-1 text-xs">(you)</span>}
                        </span>
                        <span className="text-sm font-mono font-bold text-white">
                          {entry.score}
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>

                {/* Show how many more players there are */}
                {leaderboard.length > 5 && (
                  <p className="text-white/25 text-xs text-center">
                    +{leaderboard.length - 5} more players
                  </p>
                )}
              </div>
            )}

            {/* ── CTA ── */}
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              whileTap={{ scale: 0.97 }}
              onClick={onDismiss}
              className="btn-primary py-3 text-base font-bold rounded-2xl"
            >
              Continue
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
