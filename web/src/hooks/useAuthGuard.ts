/**
 * useAuthGuard — wraps any multiplayer action behind an auth check.
 *
 * Usage:
 *   const { requireAuth } = useAuthGuard();
 *   <button onClick={() => requireAuth(() => createRoom())}>Create Room</button>
 *
 * If the user is logged in, fn() fires immediately.
 * If not, the AuthModal opens and fn() fires automatically after a successful login.
 */
import { useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { isSoloModeEnabled } from '../config/appMode';

export function useAuthGuard() {
  const user         = useGameStore((s) => s.user);
  const openAuthModal = useGameStore((s) => s.openAuthModal);

  const requireAuth = useCallback(
    (fn: () => void) => {
      if (user) {
        fn();
      } else if (isSoloModeEnabled()) {
        return;
      } else {
        openAuthModal(fn);
      }
    },
    [user, openAuthModal]
  );

  return { requireAuth, isAuthenticated: !!user };
}
