/**
 * Guest session manager — no server interaction required.
 * Generates a stable UUID per browser, persists solo high score in localStorage.
 */

const GUEST_ID_KEY    = 'fb_guest_id';
const GUEST_SCORE_KEY = 'fb_guest_high_score';

/** Returns (or creates) a stable guest UUID for this browser. */
export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

/** Guest display name derived from the last 6 chars of their UUID. */
export function getGuestUsername(id: string): string {
  return `Guest_${id.slice(-6)}`;
}

/** Current solo personal best (0 if never played). */
export function getGuestHighScore(): number {
  return parseInt(localStorage.getItem(GUEST_SCORE_KEY) ?? '0', 10) || 0;
}

/**
 * Saves a new high score only if it beats the existing record.
 * Returns the new all-time best.
 */
export function saveGuestHighScore(score: number): number {
  const prev = getGuestHighScore();
  const best = Math.max(prev, score);
  if (best > prev) localStorage.setItem(GUEST_SCORE_KEY, String(best));
  return best;
}

/** Clear guest session (used in tests / manual reset). */
export function clearGuestSession(): void {
  localStorage.removeItem(GUEST_ID_KEY);
  localStorage.removeItem(GUEST_SCORE_KEY);
}
