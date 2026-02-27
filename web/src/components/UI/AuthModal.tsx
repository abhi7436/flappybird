/**
 * AuthModal — shown when a guest/unauthenticated user attempts a multiplayer action.
 * On successful login/register, fires the pending callback then closes.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useSound } from '../../hooks/useSound';
import { useAuth } from '../../hooks/useAuth';

export const AuthModal: React.FC = () => {
  const { play } = useSound();
  const { login, register } = useAuth();
  const { showAuthModal, authModalPendingAction, closeAuthModal, setScreen } =
    useGameStore((s) => ({
      showAuthModal:          s.showAuthModal,
      authModalPendingAction: s.authModalPendingAction,
      closeAuthModal:         s.closeAuthModal,
      setScreen:              s.setScreen,
    }));

  const [mode,     setMode]     = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    closeAuthModal();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    play('menuClick');

    try {
      // useAuth handles cookie + localStorage persistence
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(username, email, password);
      }

      // 1. Close modal + reset form
      closeAuthModal();
      resetForm();

      // 2. If we were on auth screen, advance to menu
      setScreen('menu');

      // 3. Fire the pending multiplayer action (after a brief tick so store settles)
      if (authModalPendingAction) {
        setTimeout(authModalPendingAction, 50);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {showAuthModal && (
        <>
          {/* Backdrop */}
          <motion.div
            key="auth-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* Modal panel */}
          <motion.div
            key="auth-modal"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="glass-dark rounded-3xl p-7 w-full max-w-sm flex flex-col gap-5 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl mb-1">🔒</p>
                  <h2 className="text-white text-xl font-black leading-tight">
                    Multiplayer requires<br />an account
                  </h2>
                  <p className="text-white/40 text-sm mt-1">
                    Free to create. Just an email + password.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="text-white/30 hover:text-white text-xl leading-none transition-colors mt-1"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* Tab toggle */}
              <div className="flex gap-1 p-1 bg-white/10 rounded-xl">
                {(['login', 'register'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(''); play('menuClick'); }}
                    className={[
                      'flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all',
                      mode === m ? 'bg-white/20 text-white' : 'text-white/40',
                    ].join(' ')}
                  >
                    {m === 'login' ? 'Log In' : 'Register'}
                  </button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={submit} className="flex flex-col gap-3">
                {/* Username — register only */}
                <AnimatePresence>
                  {mode === 'register' && (
                    <motion.input
                      key="username"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5
                                 text-white placeholder:text-white/30 outline-none focus:border-sky-400"
                    />
                  )}
                </AnimatePresence>

                {/* Email */}
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5
                             text-white placeholder:text-white/30 outline-none focus:border-sky-400"
                />

                {/* Password */}
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5
                             text-white placeholder:text-white/30 outline-none focus:border-sky-400"
                />

                {error && (
                  <p className="text-red-400 text-sm text-center -mt-1">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary py-3 font-bold disabled:opacity-60 mt-1"
                >
                  {loading
                    ? 'Please wait…'
                    : mode === 'login'
                      ? 'Sign In & Continue'
                      : 'Create Account & Continue'}
                </button>
              </form>

              {/* Footer note */}
              <p className="text-center text-white/25 text-xs -mt-2">
                Solo play is always available without an account 🎮
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
