import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { BIRD_SKINS } from '../../game/BirdSkins';
import { BirdSkinId } from '../../types';
import { useSound } from '../../hooks/useSound';

interface Props {
  score:     number;
  highScore: number;
}

export const HUD: React.FC<Props> = ({ score, highScore }) => {
  const { soundEnabled, toggleSound, selectedSkin, setSkin } = useGameStore((s) => ({
    soundEnabled: s.soundEnabled,
    toggleSound:  s.toggleSound,
    selectedSkin: s.selectedSkin,
    setSkin:      s.setSkin,
  }));

  const { play } = useSound();
  const scoreRef = useRef<HTMLSpanElement>(null);
  const prevScoreRef = useRef(score);

  // Trigger CSS pop animation on score change
  useEffect(() => {
    if (score !== prevScoreRef.current && scoreRef.current) {
      const el = scoreRef.current;
      el.classList.remove('pop');
      // Force reflow to restart animation
      void el.offsetWidth;
      el.classList.add('pop');
      prevScoreRef.current = score;
    }
  }, [score]);

  const handleToggleSound = () => {
    toggleSound();
    play('menuClick');
  };

  const isNewBest = score > 0 && score >= highScore;

  return (
    <div className="w-full flex items-center justify-between px-3 py-2">

      {/* Left: Score block */}
      <div className="flex flex-col items-start min-w-[88px]">
        <span className="text-white/40 text-[10px] uppercase tracking-[0.18em] font-semibold">
          Score
        </span>
        <span
          ref={scoreRef}
          className="score-display"
        >
          {score}
        </span>
        <div className="flex items-center gap-1 mt-0.5">
          {isNewBest && score > 0 ? (
            <motion.span
              key="new-best"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-[10px] font-black text-brand-yellow"
              style={{ textShadow: '0 0 8px rgba(255,215,0,0.8)' }}
            >
              ✨ NEW BEST!
            </motion.span>
          ) : (
            <span className="text-white/35 text-[10px] font-semibold">
              Best&nbsp;
              <span className="text-white/55">{highScore}</span>
            </span>
          )}
        </div>

        {/* Coins + bugs mini-row */}
        {score > 0 && (
          <div className="flex gap-1.5 mt-1.5">
            <motion.span
              key={`coins-${score}`}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.35, 1] }}
              transition={{ duration: 0.28 }}
              className="counter-pill"
              style={{ fontSize: '0.70rem', padding: '2px 8px 2px 6px' }}
            >
              🪙&nbsp;{score * 3}
            </motion.span>
            <span
              className="counter-pill"
              style={{ fontSize: '0.70rem', padding: '2px 8px 2px 6px' }}
            >
              🐛&nbsp;{Math.floor(score / 5)}
            </span>
          </div>
        )}
      </div>

      {/* Centre: Skin selector (compact dots) */}
      <div className="flex gap-1.5 items-center">
        {(Object.keys(BIRD_SKINS) as BirdSkinId[]).filter((id) => {
          // Show only unlocked skins inside HUD to keep it compact
          return true;
        }).map((id) => {
          const s      = BIRD_SKINS[id];
          const active = id === selectedSkin;
          return (
            <motion.button
              key={id}
              title={s.name}
              onClick={() => { setSkin(id); play('menuClick'); }}
              whileTap={{ scale: 0.85 }}
              className={[
                'rounded-full border-2 transition-all duration-150 flex items-center justify-center text-xs',
                active
                  ? 'border-white scale-125 shadow-lg'
                  : 'border-white/25 opacity-55 hover:opacity-80 hover:border-white/50',
              ].join(' ')}
              style={{
                width: active ? 28 : 22,
                height: active ? 28 : 22,
                backgroundColor: s.bodyColor,
                boxShadow: active && s.glowColor ? `0 0 10px ${s.glowColor}` : undefined,
              }}
            >
              {active && <span style={{ fontSize: 10 }}>{s.emoji}</span>}
            </motion.button>
          );
        })}
      </div>

      {/* Right: Sound toggle */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={handleToggleSound}
        title={soundEnabled ? 'Mute' : 'Unmute'}
        className={[
          'w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all duration-200',
          soundEnabled
            ? 'glass opacity-80 hover:opacity-100'
            : 'glass opacity-45 hover:opacity-70',
        ].join(' ')}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </motion.button>

    </div>
  );
};
