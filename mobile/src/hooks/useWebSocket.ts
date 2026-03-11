import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import { scheduleLocalInvite } from '../services/notifications';
import { LeaderboardUpdate, FinalRankingPayload } from '../types';
import type { ReplayData } from '../../../src/game-engine/ReplayRecorder';
import type { EloChangeResult } from '../../../src/server/types/index';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);

  const token              = useGameStore((s) => s.token);
  const setLeaderboard     = useGameStore((s) => s.setLeaderboard);
  const setFinalRanking    = useGameStore((s) => s.setFinalRanking);
  const addLobbyPlayer     = useGameStore((s) => s.addLobbyPlayer);
  const removeLobbyPlayer  = useGameStore((s) => s.removeLobbyPlayer);
  const setGameStarted     = useGameStore((s) => s.setGameStarted);
  const setPendingInvite   = useGameStore((s) => s.setPendingInvite);
  const setEloChange       = useGameStore((s) => s.setEloChange);
  const addUnlockedSkins   = useGameStore((s) => s.addUnlockedSkins);
  const setSpectatingRoomId = useGameStore((s) => s.setSpectatingRoomId);
  const setScore             = useGameStore((s) => s.setScore);
  const setHostId            = useGameStore((s) => s.setHostId);

  // Previous leaderboard for rank delta tracking (client-side)
  const prevLeaderboardRef = useRef<LeaderboardUpdate['entries']>([]);

  useEffect(() => {
    if (!token) return;

    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[WS] Connection error:', err.message);
    });

    // ── Lobby events ──────────────────────────────────────
    socket.on('room_joined', ({ hostId }: { roomId: string; hostId: string }) => {
      setHostId(hostId);
    });

    socket.on('player_joined', (data: { playerId: string; username: string }) => {
      addLobbyPlayer(data);
    });

    socket.on('player_left', (data: { playerId: string }) => {
      removeLobbyPlayer(data.playerId);
    });

    socket.on('game_started', () => {
      // Reset per-game state so the engine boots fresh for every round
      setScore(0);
      setFinalRanking(null);
      setGameStarted(true);
    });

    // ── Leaderboard ───────────────────────────────────────
    socket.on('leaderboard_update', (update: LeaderboardUpdate) => {
      // Attach previousRank from local snapshot for animation
      const prev = prevLeaderboardRef.current;
      const enriched = update.entries.map((e) => {
        const old = prev.find((p) => p.userId === e.userId);
        return { ...e, previousRank: old?.rank };
      });
      prevLeaderboardRef.current = update.entries;
      setLeaderboard(enriched as any);

      if (update.isFinal) {
        // Handled by the per-player final_ranking event below
      }
    });

    // ── Game over ──────────────────────────────────────────
    socket.on(
      'final_ranking',
      (payload: { rank: number; totalPlayers: number; finalScore: number }) => {
        setFinalRanking({
          rank: payload.rank,
          totalPlayers: payload.totalPlayers,
          finalScore: payload.finalScore,
        });
      }
    );

    // ── Friend invite (server → socket) ──────────────────
    socket.on(
      'friend_invite',
      async (data: { fromUsername: string; roomId: string; joinToken: string }) => {
        setPendingInvite(data.roomId, data.joinToken);
        await scheduleLocalInvite(data.fromUsername, data.roomId, data.joinToken);
      }
    );

    // ── ELO + skin unlock events ──────────────────────────
    socket.on('elo_update', (data: { changes: EloChangeResult[] }) => {
      const myChange = data.changes[0];
      if (myChange) setEloChange(myChange);
    });

    socket.on('skins_unlocked', (data: { skinIds: string[] }) => {
      if (data.skinIds.length > 0) addUnlockedSkins(data.skinIds);
    });

    // ── Spectator events ──────────────────────────────────
    socket.on('spectate_joined', (data: { roomId: string; leaderboard: any[] }) => {
      setSpectatingRoomId(data.roomId);
      setLeaderboard(data.leaderboard as any);
    });

    socket.on('spectate_left', () => {
      setSpectatingRoomId(null);
    });

    // ── Round lifecycle (session rooms) ─────────────────────
    socket.on('round_ended', () => {
      console.log('[WS] round_ended');
    });

    socket.on('round_reset', () => {
      console.log('[WS] round_reset — ready for next round');
      setScore(0);
      setFinalRanking(null);
      setGameStarted(false);
      setLeaderboard([]);
    });

    // ── Host transfer ─────────────────────────────────────────
    socket.on('host_updated', ({ newHostId }: { newHostId: string }) => {
      console.log('[WS] host_updated:', newHostId);
      setHostId(newHostId);
    });

    socket.on('host_changed', ({ newHostId }: { newHostId: string }) => {
      console.log('[WS] host_changed:', newHostId);
      setHostId(newHostId);
    });

    // ── Error handler ──────────────────────────────────────
    socket.on('error', ({ message, code }: { message: string; code?: string }) => {
      console.error('[WS] server error:', code, message);
      // ROOM_NOT_ACTIVE fires when player_restart races a round reset — harmless.
      const silent = code === 'ALREADY_STARTED' || code === 'NOT_HOST'
        || code === 'GAME_ACTIVE' || code === 'ROOM_NOT_ACTIVE';
      if (!silent) console.warn('[WS] non-silent error:', message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // ── Emit helpers ──────────────────────────────────────────
  const joinRoom = useCallback(
    (roomId: string, joinToken?: string) => {
      socketRef.current?.emit('join_room', { roomId, joinToken });
    },
    []
  );

  const leaveRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('leave_room', { roomId });
  }, []);

  const sendScore = useCallback((roomId: string, score: number) => {
    socketRef.current?.emit('score_update', { roomId, score });
  }, []);

  const sendGameOver = useCallback((
    roomId: string,
    finalScore: number,
    extras?: { replayData?: ReplayData; powerupsCollected?: Record<string, number>; durationMs?: number }
  ) => {
    socketRef.current?.emit('game_over', { roomId, finalScore, ...extras });
  }, []);

  const startGame = useCallback((roomId: string) => {
    socketRef.current?.emit('start_game', { roomId });
  }, []);

  const spectateRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('spectate_room', { roomId });
  }, []);

  const leaveSpectate = useCallback((roomId: string) => {
    socketRef.current?.emit('leave_spectate', { roomId });
  }, []);

  const reportPowerUpCollected = useCallback((roomId: string, type: string) => {
    socketRef.current?.emit('power_up_collected', { roomId, type });
  }, []);

  const playerRestart = useCallback((roomId: string) => {
    socketRef.current?.emit('player_restart', { roomId });
  }, []);

  return {
    socket: socketRef,
    joinRoom,
    leaveRoom,
    sendScore,
    sendGameOver,
    startGame,
    spectateRoom,
    leaveSpectate,
    reportPowerUpCollected,
    playerRestart,
  };
}
