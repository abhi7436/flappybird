import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';

interface Props {
  onDismiss: () => void;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ── Rank messages (funny + expressive) ────────────────────────
function rankMessage(rank: number, total: number): { msg: string; sub: string } {
  if (rank === 1) return {
    msg: '🏆 CHAMPION!',
    sub: 'You absolute legend. The pipes feared you.',
  };
  if (rank === 2) return {
    msg: '🥈 So close…',
    sub: 'One pixel. ONE pixel. We believe in you.',
  };
  if (rank === 3) return {
    msg: '🥉 Top 3 Finish!',
    sub: 'Bronze never looked so good. Mostly.',
  };
  if (rank <= Math.ceil(total * 0.10)) return {
    msg: `🔥 Top 10% — Elite!`,
    sub: 'Your ancestors are proud. Probably.',
  };
  if (rank <= Math.ceil(total * 0.25)) return {
    msg: `⚡ Top 25% — Not Bad!`,
    sub: 'You showed up and that counts. Kind of.',
  };
  if (rank <= Math.ceil(total * 0.50)) return {
    msg: `👀 Exactly Average`,
    sub: 'You are the very definition of median.',
  };
  if (rank <= Math.ceil(total * 0.75)) return {
    msg: `💀 Tough Day`,
    sub: 'The pipes had a vendetta. We get it.',
  };
  return {
    msg: `😬 Dead Last? Respect.`,
    sub: 'Takes true courage to finish this poorly.',
  };
}

// ── XP formula (fun fake progression) ─────────────────────────
function calcXP(rank: number, total: number, score: number): number {
  const placementBonus = Math.max(0, total - rank + 1) * 10;
  const scoreBonus     = Math.floor(score * 2.5);
  return placementBonus + scoreBonus;
}

// ── CSS confetti (DOM divs + pure CSS keyframes) ───────────────
const Confetti: React.FC = () => (
  <div className="confetti-wrap" aria-hidden>
    {Array.from({ length: 15 }, (_, i) => (
      <div key={i} className="confetti-piece" />
    ))}
  </div>
);

const RowVariants = {
  hidden:  { opacity: 0, x: 20 },
  visible: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: 0.22 + i * 0.07, type: 'spring' as const, stiffness: 320, damping: 28 },
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
        <>
          {/* Confetti for champion */}
          {finalRanking.rank === 1 && <Confetti />}

          <motion.div
            key="final-ranking-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center
                       bg-black/75 backdrop-blur-md p-4"
            onClick={onDismiss}
          >
            <motion.div
              key="final-ranking-card"
              initial={{ scale: 0.82, y: 40, opacity: 0 }}
              animate={{ scale: 1,    y: 0,  opacity: 1 }}
              exit={{    scale: 0.82, y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              className={[
                'w-full max-w-sm rounded-3xl p-6 flex flex-col gap-5',
                finalRanking.rank === 1
                  ? 'glass-gold champion-card'
                  : 'glass-dark',
              ].join(' ')}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Rank badge ── */}
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  initial={{ scale: 0, rotate: -25 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.08 }}
                  className={[
                    'w-28 h-28 rounded-full flex items-center justify-center',
                    'text-6xl font-black shadow-2xl rank-pop',
                    finalRanking.rank === 1
                      ? 'bg-gradient-to-br from-yellow-300 to-amber-600 shadow-champion'
                      : finalRanking.rank === 2
                      ? 'bg-gradient-to-br from-slate-200 to-slate-500'
                      : finalRanking.rank === 3
                      ? 'bg-gradient-to-br from-amber-600 to-amber-800'
                      : 'bg-gradient-to-br from-sky-500 to-indigo-700',
                  ].join(' ')}
                  style={
                    finalRanking.rank === 1
                      ? { boxShadow: '0 0 40px rgba(255,215,0,0.7), 0 0 80px rgba(255,165,0,0.4)' }
                      : undefined
                  }
                >
                  {MEDAL[finalRanking.rank] ?? `#${finalRanking.rank}`}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 }}
                  className="text-center"
                >
                  {/* Champion crown animation */}
                  {finalRanking.rank === 1 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.35, type: 'spring', stiffness: 400, damping: 14 }}
                      className="text-3xl mb-1 crown-bounce"
                    >
                      👑
                    </motion.div>
                  )}

                  {/* Primary rank message */}
                  <p
                    className={[
                      'text-2xl font-black',
                      finalRanking.rank === 1 ? 'arcade-title text-3xl' : 'text-white',
                    ].join(' ')}
                  >
                    {rankMessage(finalRanking.rank, finalRanking.totalPlayers).msg}
                  </p>

                  {/* Sub-message (humorous) */}
                  <p className="text-white/50 text-xs mt-1 italic">
                    {rankMessage(finalRanking.rank, finalRanking.totalPlayers).sub}
                  </p>

                  <p className="text-white/35 text-xs mt-1.5">
                    <span className="text-white/65 font-bold">#{finalRanking.rank}</span>
                    {' of '}
                    <span className="text-white/65">{finalRanking.totalPlayers}</span>
                    {' players'}
                  </p>
                </motion.div>
              </div>

              {/* ── Score + XP ── */}
              <motion.div
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 }}
                className="glass rounded-2xl py-4 px-5 flex items-stretch gap-0 divide-x divide-white/10"
              >
                <div className="flex-1 text-center pr-4">
                  <p className="text-white/35 text-[10px] uppercase tracking-widest mb-0.5 font-semibold">
                    Final Score
                  </p>
                  <p
                    className="score-display text-4xl"
                    style={{ textShadow: '0 0 14px rgba(255,215,0,0.4)' }}
                  >
                    {finalRanking.finalScore}
                  </p>
                </div>
                <div className="flex-1 text-center pl-4 flex flex-col justify-center">
                  <p className="text-white/35 text-[10px] uppercase tracking-widest mb-1.5 font-semibold">
                    XP Gained
                  </p>
                  <p className="text-neon-yellow font-black text-2xl"
                     style={{ textShadow: '0 0 10px rgba(255,224,0,0.6)' }}>
                    +{calcXP(finalRanking.rank, finalRanking.totalPlayers, finalRanking.finalScore)}
                  </p>
                  {/* XP bar */}
                  <div className="xp-bar-track mt-2"
                       style={{ '--xp-target': `${Math.min(95, (finalRanking.finalScore / 3))}%` } as React.CSSProperties}>
                    <div className="xp-bar-fill xp-bar-track" />
                  </div>
                </div>
              </motion.div>

              {/* ── Final standings (top 5) ── */}
              {leaderboard.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-white/35 text-[10px] uppercase tracking-widest font-semibold">
                    Final Standings
                  </p>
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
                              ? 'bg-gradient-to-r from-yellow-400/22 to-amber-400/8 ring-1 ring-yellow-400/40'
                              : entry.rank === 1
                              ? 'bg-gradient-to-r from-yellow-500/12 to-orange-500/8'
                              : 'bg-white/5',
                          ].join(' ')}
                        >
                          <span className="w-5 text-center text-sm flex-shrink-0">
                            {MEDAL[entry.rank] ?? entry.rank}
                          </span>
                          <div
                            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center
                                       text-xs font-bold text-white"
                            style={{
                              background: isSelf
                                ? 'linear-gradient(135deg, #FFD700, #FF9500)'
                                : 'linear-gradient(135deg, #4FC3F7, #0288D1)',
                            }}
                          >
                            {entry.username[0].toUpperCase()}
                          </div>
                          <span
                            className={[
                              'flex-1 truncate text-sm font-semibold',
                              isSelf ? 'text-yellow-100' : 'text-white',
                            ].join(' ')}
                          >
                            {entry.username}
                            {isSelf && (
                              <span className="text-yellow-400/60 ml-1 text-xs font-normal">(you)</span>
                            )}
                          </span>
                          {!entry.isAlive && (
                            <span className="eliminated-badge">💀</span>
                          )}
                          <span className="text-sm font-mono font-black text-white">
                            {entry.score}
                          </span>
                        </motion.li>
                      );
                    })}
                  </ul>
                  {leaderboard.length > 5 && (
                    <p className="text-white/20 text-xs text-center">
                      +{leaderboard.length - 5} more players
                    </p>
                  )}
                </div>
              )}

              {/* ── CTA ── */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.48 }}
                whileTap={{ scale: 0.97 }}
                onClick={onDismiss}
                className="btn-arcade py-3 text-base"
              >
                {finalRanking.rank === 1 ? '🏆 Claim Victory!' : '🔄 Play Again?'}
              </motion.button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
