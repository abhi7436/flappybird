import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  roomId: string;
}

function buildInviteUrl(roomId: string): string {
  return `${window.location.origin}/join/${roomId}`;
}

export const InviteLink: React.FC<Props> = ({ roomId }) => {
  const url = buildInviteUrl(roomId);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [url]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-white/40 text-xs uppercase tracking-widest">
        Share Link
      </p>

      <div className="flex gap-2 items-stretch">
        {/* URL display */}
        <div
          className="flex-1 glass rounded-xl px-3 py-2.5 text-sm text-white/60
                     font-mono truncate flex items-center min-w-0 select-all"
          title={url}
        >
          <span className="truncate">{url}</span>
        </div>

        {/* Copy button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleCopy}
          aria-label="Copy invite link"
          className={[
            'flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300',
            copied
              ? 'bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.5)]'
              : 'btn-primary',
          ].join(' ')}
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="check"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex items-center gap-1"
              >
                ✓ Copied!
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Copy
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Helper hint */}
      <p className="text-white/30 text-xs">
        Anyone with this link can join the room
      </p>
    </div>
  );
};
