import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { BIRD_SKINS } from '../../game/BirdSkins';
import { BirdSkinId } from '../../types';
import { useSound } from '../../hooks/useSound';

interface Props {
  score:       number;
  highScore:   number;
}

export const HUD: React.FC<Props> = ({ score, highScore }) => {
  const { soundEnabled, toggleSound, selectedSkin, setSkin } = useGameStore((s) => ({
    soundEnabled: s.soundEnabled,
    toggleSound:  s.toggleSound,
    selectedSkin: s.selectedSkin,
    setSkin:      s.setSkin,
  }));

  const { play } = useSound();

  const handleToggleSound = () => {
    toggleSound();
    play('menuClick');
  };

  return (
    <div className="w-full flex items-center justify-between px-4 py-2">
      {/* Left: score display */}
      <div className="flex flex-col items-start min-w-[80px]">
        <span className="text-white/50 text-xs uppercase tracking-widest">Score</span>
        <motion.span
          key={score}
          initial={{ scale: 1.4, color: '#fbbf24' }}
          animate={{ scale: 1,   color: '#ffffff' }}
          transition={{ duration: 0.2 }}
          className="text-white text-2xl font-black"
        >
          {score}
        </motion.span>
        <span className="text-white/40 text-xs">Best {highScore}</span>
      </div>

      {/* Centre: Skin selector */}
      <div className="flex gap-2">
        {(Object.keys(BIRD_SKINS) as BirdSkinId[]).map((id) => {
          const s = BIRD_SKINS[id];
          const active = id === selectedSkin;
          return (
            <button
              key={id}
              title={s.name}
              onClick={() => {
                setSkin(id);
                play('menuClick');
              }}
              className={[
                'w-7 h-7 rounded-full border-2 transition-transform',
                active ? 'border-white scale-125 shadow-lg' : 'border-white/30 opacity-60',
              ].join(' ')}
              style={{ backgroundColor: s.bodyColor, boxShadow: active && s.glowColor ? `0 0 8px ${s.glowColor}` : undefined }}
            />
          );
        })}
      </div>

      {/* Right: sound toggle */}
      <button
        onClick={handleToggleSound}
        className="text-2xl opacity-70 hover:opacity-100 transition-opacity"
        title={soundEnabled ? 'Mute' : 'Unmute'}
      >
        {soundEnabled ? '🔊' : '🔇'}
      </button>
    </div>
  );
};
