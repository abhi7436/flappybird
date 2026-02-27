/**
 * Mobile guest session — persists guestId + solo high score via AsyncStorage.
 * AsyncStorage is loaded once at startup; all writes are fire-and-forget.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_ID_KEY    = '@fb_guest_id';
const GUEST_SCORE_KEY = '@fb_guest_high_score';

/** Load the persisted guest session. Returns null values if never saved. */
export async function loadGuestSession(): Promise<{ id: string | null; highScore: number }> {
  try {
    const [id, scoreStr] = await AsyncStorage.multiGet([GUEST_ID_KEY, GUEST_SCORE_KEY]);
    return {
      id:        id[1] ?? null,
      highScore: parseInt(scoreStr[1] ?? '0', 10) || 0,
    };
  } catch {
    return { id: null, highScore: 0 };
  }
}

/** Persist a guest ID (call once when creating a new guest session). */
export async function saveGuestId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_ID_KEY, id);
  } catch { /* ignore */ }
}

/**
 * Saves a new high score only if it beats the existing record.
 * Returns the new all-time best.
 */
export async function saveGuestHighScore(score: number): Promise<number> {
  try {
    const str  = await AsyncStorage.getItem(GUEST_SCORE_KEY);
    const prev = parseInt(str ?? '0', 10) || 0;
    const best = Math.max(prev, score);
    if (best > prev) await AsyncStorage.setItem(GUEST_SCORE_KEY, String(best));
    return best;
  } catch {
    return score;
  }
}

/** Generate a simple guest display name from a UUID. */
export function guestUsername(id: string): string {
  return `Guest_${id.slice(-6)}`;
}
