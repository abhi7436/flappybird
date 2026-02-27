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

// Mirrors the server-side ENABLE_AUTH flag.
// Set VITE_ENABLE_AUTH=false (web/.env) to disable auth for V1.
// Set VITE_ENABLE_AUTH=true to restore the full JWT gate.
const ENABLE_AUTH = import.meta.env.VITE_ENABLE_AUTH !== 'false';

export function useAuthGuard() {
  const user          = useGameStore((s) => s.user);
  const openAuthModal = useGameStore((s) => s.openAuthModal);

  const requireAuth = useCallback(
    (fn: () => void) => {
      // V1 passthrough: skip auth gate entirely when auth is disabled
      if (!ENABLE_AUTH || user) {
        fn();
      } else {
        openAuthModal(fn);
      }
    },
    [user, openAuthModal]
  );

  return { requireAuth, isAuthenticated: !ENABLE_AUTH || !!user };
}
