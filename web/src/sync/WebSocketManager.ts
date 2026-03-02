/**
 * WebSocketManager — typed wrapper over a Socket.IO socket.
 *
 * All socket.emit() calls for game events go through here, giving a
 * single seam to mock in tests and a clear inventory of outbound messages.
 */

import { Socket } from 'socket.io-client';
import type { ReplayData } from '@engine/ReplayRecorder';
import type { PowerUpType } from '@engine/PowerUp';

export interface GameOverPayload {
  roomId:              string;
  finalScore:          number;
  replayData?:         ReplayData;
  powerupsCollected?:  number;
  durationMs?:         number;
}

export class WebSocketManager {
  private socket: Socket | null;

  constructor(socket: Socket | null) {
    this.socket = socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** Broadcast the player's current score mid-game. */
  emitScore(roomId: string, score: number): void {
    this.socket?.emit('score_update', { roomId, score });
  }

  /** Notify the server the player has died. */
  emitGameOver(payload: GameOverPayload): void {
    this.socket?.emit('game_over', payload);
  }

  /** Tell opponents which power-up this player just activated. */
  emitPowerUp(roomId: string, type: PowerUpType): void {
    this.socket?.emit('powerup_activated', { roomId, type });
  }

  /** Broadcast a flap/jump for spectator and replay sync. */
  emitJump(roomId: string): void {
    this.socket?.emit('jump', { roomId });
  }

  /** Replace the underlying socket (e.g. reconnection). */
  setSocket(socket: Socket | null): void {
    this.socket = socket;
  }
}
