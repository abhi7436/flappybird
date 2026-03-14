/**
 * useAuth — centralised authentication hook.
 *
 * Provides:
 *   login(email, password)  → AuthUser
 *   register(username, email, password) → AuthUser
 *   logout()
 *   restoreSession()        → AuthUser | null  (call once on app mount)
 *
 * Token storage strategy (dual mode):
 *   1. HTTP-only cookie — set by the server on every login/register/me call.
 *      The browser attaches it automatically; JS cannot read it (XSS-safe).
 *   2. localStorage — mirrors the token so it can be passed explicitly on the
 *      Socket.IO handshake (socket.io doesn't forward cookies by default) and
 *      on non-browser runtimes.
 *
 * All actions update the Zustand store so components react immediately.
 */

import { useCallback, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { AuthUser } from '../types';
import {
  saveToken,
  saveUser,
  loadToken,
  loadUser,
  clearAuthStorage,
} from '../services/authStorage';
import { apiErrorMessage, apiUrl, parseJsonResponse } from '../services/http';

interface AuthResponse {
  token: string;
  user: {
    id:         string;
    username:   string;
    avatar:     string | null;
    high_score: number;
  };
}

function toAuthUser(data: AuthResponse): AuthUser {
  return {
    id:        data.user.id,
    username:  data.user.username,
    avatar:    data.user.avatar ?? null,
    highScore: data.user.high_score ?? 0,
    token:     data.token,
  };
}

export function useAuth() {
  const { user, setUser, setScreen } = useGameStore((s) => ({
    user:      s.user,
    setUser:   s.setUser,
    setScreen: s.setScreen,
  }));

  // Prevent concurrent restoreSession calls
  const restoringRef = useRef(false);

  // ── Persist user to store + storage ──────────────────────
  const _persist = useCallback((authUser: AuthUser) => {
    setUser(authUser);
    saveToken(authUser.token);
    saveUser({
      id:        authUser.id,
      username:  authUser.username,
      avatar:    authUser.avatar,
      highScore: authUser.highScore,
    });
  }, [setUser]);

  // ── login ─────────────────────────────────────────────────
  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include', // send/receive HTTP-only cookie
        body:        JSON.stringify({ email, password }),
      });
      const data = await parseJsonResponse<AuthResponse>(res);
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Login failed'));
      const authUser = toAuthUser(data);
      _persist(authUser);
      return authUser;
    },
    [_persist]
  );

  // ── register ──────────────────────────────────────────────
  const register = useCallback(
    async (username: string, email: string, password: string): Promise<AuthUser> => {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ username, email, password }),
      });
      const data = await parseJsonResponse<AuthResponse>(res);
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Registration failed'));
      const authUser = toAuthUser(data);
      _persist(authUser);
      return authUser;
    },
    [_persist]
  );

  // ── logout ────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const userId = user?.id;
    // Fire-and-forget — clears the HTTP-only cookie server-side
    fetch(apiUrl('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    }).catch(() => {});
    clearAuthStorage();
    setUser(null);
    setScreen('auth');
  }, [user, setUser, setScreen]);

  // ── restoreSession ────────────────────────────────────────
  /**
   * Call once on app mount. Tries GET /auth/me with:
   *   1. HTTP-only cookie (automatic via `credentials: 'include'`)
   *   2. localStorage token in Authorization header (fallback)
   *
   * On success: populates store so the user doesn't need to log in again.
   * On failure: silently clears stale storage.
   */
  const restoreSession = useCallback(async (): Promise<AuthUser | null> => {
    if (restoringRef.current) return null;
    restoringRef.current = true;

    const storedToken = loadToken();

    // Quick hydration from cache while the network call is in flight
    const cachedUser = loadUser();
    if (cachedUser && storedToken && !user) {
      setUser({
        id:        cachedUser.id,
        username:  cachedUser.username,
        avatar:    cachedUser.avatar,
        highScore: cachedUser.highScore,
        token:     storedToken,
      });
    }

    try {
      const headers: HeadersInit = {};
      if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

      const res = await fetch(apiUrl('/api/auth/me'), {
        credentials: 'include', // send cookie if present
        headers,
      });

      if (!res.ok) {
        clearAuthStorage();
        setUser(null);
        restoringRef.current = false;
        return null;
      }

      const data = await parseJsonResponse<AuthResponse>(res);
      // /me may return the same token or a refreshed one
      const effectiveToken = data.token ?? storedToken ?? '';
      const authUser = toAuthUser({ ...data, token: effectiveToken });
      _persist(authUser);
      restoringRef.current = false;
      return authUser;
    } catch {
      // Network error — keep cached user if we have one, so offline is graceful
      restoringRef.current = false;
      return user;
    }
  }, [user, setUser, _persist]);

  return {
    user,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    restoreSession,
  };
}
