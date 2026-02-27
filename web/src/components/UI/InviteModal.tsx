import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  roomId:  string;
  onClose: () => void;
}

function buildInviteUrl(roomId: string): string {
  const base = window.location.origin;
  return `${base}/join/${roomId}`;
}

export const InviteModal: React.FC<Props> = ({ roomId, onClose }) => {
  const url = buildInviteUrl(roomId);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Fallback for sandboxed environments */
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [url]);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-dark w-full max-w-sm mx-4 rounded-3xl p-6 flex flex-col gap-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-white text-lg font-bold gradient-text">Invite Friends</h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-2xl leading-none transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Room ID badge */}
        <div className="flex flex-col gap-1">
          <p className="text-white/50 text-xs uppercase tracking-widest">Room ID</p>
          <span className="font-mono text-white text-xl font-bold tracking-widest bg-white/10 rounded-xl px-4 py-2 text-center">
            {roomId}
          </span>
        </div>

        {/* Link */}
        <div className="flex flex-col gap-2">
          <p className="text-white/50 text-xs uppercase tracking-widest">Share Link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={url}
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2
                         text-sm text-white/80 font-mono truncate outline-none"
            />
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={handleCopy}
              className={[
                'btn-primary px-4 py-2 text-sm flex-shrink-0 transition-colors',
                copied ? 'bg-emerald-500 border-emerald-400' : '',
              ].join(' ')}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </motion.button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10" />

        {/* Share via */}
        <div className="flex flex-col gap-2">
          <p className="text-white/50 text-xs uppercase tracking-widest">Share via</p>
          <div className="flex gap-3 justify-center">
            {/* Web Share API */}
            {'share' in navigator && (
              <button
                onClick={() =>
                  navigator.share({ title: 'Join my Flappy Bird game!', url })
                }
                className="btn-secondary px-4 py-2 text-sm"
              >
                Share…
              </button>
            )}
            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Join my Flappy Bird game: ${url}`)}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary px-4 py-2 text-sm"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
