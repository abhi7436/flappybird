/**
 * Mobile guest session — persists guestId + solo high score via AsyncStorage.
 * AsyncStorage is loaded once at startup; all writes are fire-and-forget.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const GUEST_ID_KEY    = '@fb_guest_id';
const GUEST_SCORE_KEY = '@fb_guest_high_score';

/**
 * Generate a UUID v4 string without relying on crypto.randomUUID()
 * (which is unavailable in React Native's Hermes engine).
 */
export function generateUUID(): string {
  // Use crypto.getRandomValues (available in Hermes via Expo polyfill)
  // to produce a proper RFC-4122 v4 UUID.
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    // Set version 4 and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return (
      hex.slice(0, 8) + '-' +
      hex.slice(8, 12) + '-' +
      hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' +
      hex.slice(20)
    );
  }
  // Fallback using Math.random (less random but functional)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

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
