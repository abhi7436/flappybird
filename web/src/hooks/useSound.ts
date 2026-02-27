import { useCallback, useEffect } from 'react';
import soundManager, { SoundType } from '../services/SoundManager';
import { useGameStore } from '../store/gameStore';

export function useSound() {
  const soundEnabled = useGameStore((s) => s.soundEnabled);

  // Sync singleton state with Zustand store
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const play = useCallback((type: SoundType) => {
    soundManager.play(type);
  }, []);

  return { play };
}
