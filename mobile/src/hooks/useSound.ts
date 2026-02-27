import { useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

type SoundName = 'flap' | 'score' | 'hit' | 'swoosh' | 'die';

// Add audio files to assets/sounds/ before building.
// See assets/sounds/README.md for instructions.
// When files are present, uncomment the SOUND_ASSETS map below and remove the stub.
const SOUND_ASSETS: Partial<Record<SoundName, number>> = {
  // flap:   require('../../assets/sounds/flap.mp3'),
  // score:  require('../../assets/sounds/score.mp3'),
  // hit:    require('../../assets/sounds/hit.mp3'),
  // swoosh: require('../../assets/sounds/swoosh.mp3'),
  // die:    require('../../assets/sounds/die.mp3'),
};

export function useSound() {
  const loadedRef  = useRef<Partial<Record<SoundName, Audio.Sound>>>({});
  const enabledRef = useRef(true);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    }).catch(() => {});

    // Preload all sounds that have assets registered
    (async () => {
      for (const [name, asset] of Object.entries(SOUND_ASSETS) as [SoundName, number][]) {
        if (!asset) continue;
        const { sound } = await Audio.Sound.createAsync(asset, { volume: 0.6 });
        loadedRef.current[name] = sound;
      }
    })();

    return () => {
      Object.values(loadedRef.current).forEach((s) => s?.unloadAsync().catch(() => {}));
    };
  }, []);

  const play = useCallback(async (name: SoundName) => {
    if (!enabledRef.current) return;
    const sound = loadedRef.current[name];
    if (!sound) return;
    try {
      await sound.replayAsync();
    } catch {
      // Silently ignore — sound is best-effort
    }
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    enabledRef.current = v;
  }, []);

  return { play, setEnabled };
}
