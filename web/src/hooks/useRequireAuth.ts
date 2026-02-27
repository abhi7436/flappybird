/**
 * useRequireAuth — redirect to the auth screen if the user is not logged in.
 *
 * Usage (in a component or page that requires auth):
 *
 *   useRequireAuth();                         // just redirect
 *   const { isReady } = useRequireAuth();     // gate renders until auth confirmed
 *
 * The hook checks:
 *   1. Zustand store for a live user (covers normal session lifetime)
 *   2. `isRestoring` flag: while session restore is running, withhold redirect
 *      so the app doesn't flash the auth screen on hard reload
 *
 * Call `useAuth().restoreSession()` in App.tsx before this hook is relevant,
 * so `isRestoring` is correctly set.
 */

import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { Screen } from '../types';

interface Options {
  /** Screen to navigate to when unauthenticated (default: 'auth') */
  redirectTo?: Screen;
  /** If true, don't auto-redirect — just expose `isAuthenticated` */
  passive?: boolean;
}

export function useRequireAuth(options: Options = {}) {
  const { redirectTo = 'auth', passive = false } = options;

  const { user, screen, setScreen, isRestoring } = useGameStore((s) => ({
    user:        s.user,
    screen:      s.screen,
    setScreen:   s.setScreen,
    isRestoring: s.isRestoring,
  }));

  const isAuthenticated = !!user;

  useEffect(() => {
    if (passive) return;
    if (isRestoring) return;   // wait for session restore to finish
    if (!isAuthenticated) {
      setScreen(redirectTo);
    }
  }, [isAuthenticated, isRestoring, passive, redirectTo, setScreen]);

  return {
    /** True once session state is resolved */
    isReady:         !isRestoring,
    isAuthenticated,
    user,
    /** Current screen — useful for conditional renders */
    screen,
  };
}
