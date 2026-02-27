/**
 * authStorage — localStorage fallback for JWT token.
 *
 * The server sets an HTTP-only cookie (preferred), but:
 *  - Localhost dev environments sometimes lose cookies on restart
 *  - Some embedded WebViews don't persist cookies
 *
 * We therefore ALSO persist the token in localStorage so the
 * client can pass it as auth.token on the Socket.IO handshake
 * and in Authorization headers when the cookie isn't available.
 *
 * Security note: localStorage tokens are accessible by JS (XSS risk).
 * In production, the HTTP-only cookie is the primary mechanism.
 * localStorage is a convenience fallback for non-browser envs.
 */

const TOKEN_KEY = 'flappy_auth_token';
const USER_KEY  = 'flappy_auth_user';

export interface StoredUser {
  id:        string;
  username:  string;
  avatar:    string | null;
  highScore: number;
}

// ── Token ─────────────────────────────────────────────────────

export function saveToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* SSR / private mode */ }
}

export function loadToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function clearToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

// ── User profile cache ────────────────────────────────────────

export function saveUser(user: StoredUser): void {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* ignore */ }
}

export function loadUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch { return null; }
}

export function clearUser(): void {
  try { localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
}

// ── Clear everything ──────────────────────────────────────────

export function clearAuthStorage(): void {
  clearToken();
  clearUser();
}
