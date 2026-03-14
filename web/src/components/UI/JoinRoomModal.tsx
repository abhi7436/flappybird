/**
 * JoinRoomModal — slide-up modal for entering a Room ID / invite code.
 * Only rendered when the user is authenticated (guarded by useAuthGuard).
 */
import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useSound } from '../../hooks/useSound';
import { apiErrorMessage, apiUrl, parseJsonResponse } from '../../services/http';

interface Props {
  open:     boolean;
  onClose:  () => void;
  onJoined: (roomId: string) => void;
}

export const JoinRoomModal: React.FC<Props> = ({ open, onClose, onJoined }) => {
  const { play } = useSound();
  const user     = useGameStore((s) => s.user);

  const [roomId,  setRoomId]  = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = roomId.trim();
    if (!id) return;
    setError('');
    setLoading(true);
    play('menuClick');

    try {
      const res  = await fetch(apiUrl(`/api/rooms/${id}`), {
        headers: { Authorization: `Bearer ${user!.token}` },
      });
      const data = await parseJsonResponse<{ id?: string; error?: string; message?: string }>(res);
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Room not found or closed'));
      onJoined(data.id ?? id);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRoomId('');
    setError('');
    setLoading(false);
    onClose();
  };

  // Focus the input when modal opens
  const handlePresence = (present: boolean) => {
    if (present) setTimeout(() => inputRef.current?.focus(), 80);
  };

  return (
    <AnimatePresence onExitComplete={() => {}} mode="wait">
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="join-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* Panel — slides up from bottom */}
          <motion.div
            key="join-panel"
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            onAnimationStart={() => handlePresence(true)}
            className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pb-8"
          >
            <div
              className="glass-dark rounded-3xl p-7 w-full max-w-sm pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white text-xl font-black">Join Room</h2>
                  <p className="text-white/40 text-sm mt-0.5">
                    Enter a Room ID or paste an invite link
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="text-white/30 hover:text-white text-xl leading-none transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleJoin} className="flex flex-col gap-3">
                <input
                  ref={inputRef}
                  required
                  value={roomId}
                  onChange={(e) => { setRoomId(e.target.value); setError(''); }}
                  placeholder="Room ID (e.g. ABC-123)"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="bg-white/10 border border-white/20 rounded-xl px-4 py-3
                             text-white text-center text-lg font-mono tracking-widest
                             placeholder:text-white/20 placeholder:text-sm placeholder:tracking-normal
                             outline-none focus:border-sky-400"
                />

                {error && (
                  <p className="text-red-400 text-sm text-center">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !roomId.trim()}
                  className="btn-primary py-3 font-bold disabled:opacity-50"
                >
                  {loading ? 'Joining…' : 'Join Game →'}
                </button>
              </form>

              <p className="text-white/25 text-xs text-center mt-4">
                Got an invite link? Paste the full URL — we'll extract the Room ID.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
