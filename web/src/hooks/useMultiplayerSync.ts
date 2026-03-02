/**
 * useMultiplayerSync — React hook that owns the multiplayer broadcast layer.
 *
 * Wraps WebSocketManager + ScoreBroadcaster in stable refs so callers get
 * stable callback references that never invalidate memoised child trees.
 *
 * Usage:
 *   const { broadcastScore, broadcastGameOver, broadcastPowerUp, broadcastJump }
 *     = useMultiplayerSync(socket, roomId);
 */

import { useCallback, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { WebSocketManager, ScoreBroadcaster, GameOverPayload } from '../sync';
import type { PowerUpType } from '@engine/PowerUp';

export interface MultiplayerSyncCallbacks {
  /** Rate-limited score broadcast (coalesced to ≤1 emit per 150 ms). */
  broadcastScore:    (score: number) => void;
  /** Flush pending score, then emit game_over. */
  broadcastGameOver: (payload: Omit<GameOverPayload, 'roomId'>) => void;
  /** Emit powerup_activated. */
  broadcastPowerUp:  (type: PowerUpType) => void;
  /** Emit jump (for spectators). */
  broadcastJump:     () => void;
}

const NOOP = () => { /* no socket */ };

export function useMultiplayerSync(
  socket: Socket | null,
  roomId: string | null,
): MultiplayerSyncCallbacks {
  const wsmRef         = useRef<WebSocketManager>(new WebSocketManager(socket));
  const broadcasterRef = useRef<ScoreBroadcaster | null>(null);

  // Keep wsm in sync with latest socket / roomId
  useEffect(() => {
    wsmRef.current.setSocket(socket);

    // Rebuild broadcaster when roomId changes
    broadcasterRef.current?.destroy();
    if (roomId) {
      broadcasterRef.current = new ScoreBroadcaster(wsmRef.current, roomId);
    } else {
      broadcasterRef.current = null;
    }

    return () => {
      broadcasterRef.current?.destroy();
    };
  }, [socket, roomId]);

  const broadcastScore = useCallback((score: number) => {
    broadcasterRef.current?.update(score);
  }, []);

  const broadcastGameOver = useCallback(
    (payload: Omit<GameOverPayload, 'roomId'>) => {
      if (!roomId) return;
      broadcasterRef.current?.flush();
      wsmRef.current.emitGameOver({ ...payload, roomId });
    },
    [roomId],
  );

  const broadcastPowerUp = useCallback((type: PowerUpType) => {
    if (!roomId) return;
    wsmRef.current.emitPowerUp(roomId, type);
  }, [roomId]);

  const broadcastJump = useCallback(() => {
    if (!roomId) return;
    wsmRef.current.emitJump(roomId);
  }, [roomId]);

  // When there's no socket/roomId, return safe no-ops
  if (!socket || !roomId) {
    return {
      broadcastScore:    NOOP,
      broadcastGameOver: NOOP,
      broadcastPowerUp:  NOOP,
      broadcastJump:     NOOP,
    };
  }

  return { broadcastScore, broadcastGameOver, broadcastPowerUp, broadcastJump };
}
