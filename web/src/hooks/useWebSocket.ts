import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import {
  FinalRankingPayload,
  LeaderboardEntry,
  LeaderboardUpdate,
} from '../types';
import { loadToken, clearAuthStorage } from '../services/authStorage';

type RoomJoinedPayload  = {
  roomId: string;
  playerId: string;
  hostId: string;
  players?: Array<{ playerId: string; userId: string; username: string }>;
};
type PlayerJoinedPayload = { playerId: string; userId: string; username: string };
type PlayerLeftPayload   = { userId: string };
type RoomClosedPayload   = { reason: string };
type ErrorPayload        = { message: string };

const WS_URL = import.meta.env.VITE_WS_URL ?? '';

export function useWebSocket(): Socket | null {
  const socketRef = useRef<Socket | null>(null);
  const {
    user,
    leaderboard: currentLb,
    setScreen,
    setUser,
    setRoom,
    setLeaderboard,
    setFinalRanking,
    setScore,
    setIsAlive,
    resetGameState,
    addRoomPlayer,
    removeRoomPlayer,
    setWsError,
    setGameCountdown,
  } = useGameStore((s) => ({
    user:             s.user,
    leaderboard:      s.leaderboard,
    setScreen:        s.setScreen,
    setUser:          s.setUser,
    setRoom:          s.setRoom,
    setLeaderboard:   s.setLeaderboard,
    setFinalRanking:  s.setFinalRanking,
    setScore:         s.setScore,
    setIsAlive:       s.setIsAlive,
    resetGameState:   s.resetGameState,
    addRoomPlayer:    s.addRoomPlayer,
    removeRoomPlayer: s.removeRoomPlayer,
    setWsError:       s.setWsError,
    setGameCountdown: s.setGameCountdown,
  }));

  // Keep a ref to the current leaderboard so the event handler closure is fresh
  const lbRef = useRef<LeaderboardEntry[]>(currentLb);
  lbRef.current = currentLb;

  useEffect(() => {
    if (!user?.token) return;

    // Prefer in-memory token; localStorage is a reliable fallback after page reload
    const token = user.token || loadToken() || '';
    if (!token) return;

    const socket = io(WS_URL, {
      auth:                { token },
      transports:          ['websocket'],
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.info('[WS] connected', socket.id);
      // After a reconnect, re-join the room the user was in so the server
      // re-adds them to the socket.io room and sends a fresh room_joined.
      const currentRoom = useGameStore.getState().room;
      if (currentRoom?.id) {
        socket.emit('join_room', { roomId: currentRoom.id });
      }
    });

    // ── Auth failures ───────────────────────────────────
    // Socket.IO fires `connect_error` when the server's io.use() middleware
    // calls next(new Error(...)). We detect auth-specific messages and force
    // the user back to the login screen.
    socket.on('connect_error', (err: Error) => {
      const msg = err.message.toLowerCase();
      const isAuthError = msg.includes('authentication') ||
                          msg.includes('invalid') ||
                          msg.includes('expired') ||
                          msg.includes('token');
      if (isAuthError) {
        console.warn('[WS] auth error — redirecting to login:', err.message);
        clearAuthStorage();
        setUser(null);
        setScreen('auth');
        socket.disconnect();
      } else {
        console.warn('[WS] connect_error:', err.message);
      }
    });

    // ── room_joined ─────────────────────────────────────
    socket.on('room_joined', ({ roomId, hostId, players }: RoomJoinedPayload) => {
      setRoom({ id: roomId, hostId, joinUrl: '', joinToken: '', playerCount: 1, status: 'waiting' });
      // Seed the lobby player list with everyone already in the room when we join.
      // Their individual player_joined events fired before we arrived so we
      // would have missed them otherwise.
      if (players?.length) {
        for (const p of players) {
          addRoomPlayer({ userId: p.userId, username: p.username, avatar: null, ready: false, highScore: 0 });
        }
      }
      setScreen('lobby');
    });

    // ── leaderboard_update ──────────────────────────────
    socket.on('leaderboard_update', (update: LeaderboardUpdate) => {
      // Build a previousRank map from the current state
      const prevRankMap = new Map<string, number>(
        lbRef.current.map((e) => [e.userId, e.rank])
      );

      // Merge server entries with previousRank for client-side animations
      const merged: LeaderboardEntry[] = update.entries.map((e) => ({
        ...e,
        isAlive:      e.isAlive ?? (e as any).alive ?? true,
        previousRank: prevRankMap.get(e.userId) ?? null,
      }));

      setLeaderboard(merged);
    });

    // ── final_ranking (per-player) ──────────────────────
    socket.on('final_ranking', (payload: FinalRankingPayload) => {
      setFinalRanking(payload);
    });

    socket.on('player_joined', ({ userId, username }: PlayerJoinedPayload) => {
      addRoomPlayer({ userId, username, avatar: null, ready: false, highScore: 0 });
    });

    socket.on('player_left', ({ userId }: PlayerLeftPayload) => {
      removeRoomPlayer(userId);
    });

    socket.on('game_started', ({ startedAt: _t }: { startedAt: number }) => {
      // Reset per-game state so the canvas boots fresh for every round
      setScore(0);
      setIsAlive(true);
      setFinalRanking(null);
      setGameCountdown(null);
      setScreen('game');
    });

    // ── game_starting (server-driven 3-s countdown shown to all players) ─
    socket.on('game_starting', ({ countdown }: { countdown: number }) => {
      setGameCountdown(countdown);
      let n = countdown - 1;
      const iv = setInterval(() => {
        if (n <= 0) {
          clearInterval(iv);
          setGameCountdown(0);
        } else {
          setGameCountdown(n);
          n--;
        }
      }, 1000);
    });

    socket.on('room_closed', (_: RoomClosedPayload) => {
      resetGameState();
      setScreen('menu');
    });

    // ── host_changed ─────────────────────────────────────
    // Server fires this when the current host leaves a waiting room and a
    // new player is promoted. Update the store so Lobby re-renders the
    // correct "Start" button visibility.
    socket.on('host_changed', ({ newHostId }: { newHostId: string }) => {
      const current = useGameStore.getState().room;
      if (current) setRoom({ ...current, hostId: newHostId });
    });

    socket.on('error', ({ message }: ErrorPayload) => {
      console.error('[WS] server error:', message);
      setWsError(message);
    });

    socket.on('disconnect', (reason: string) => {
      console.warn('[WS] disconnected:', reason);
      const screen = useGameStore.getState().screen;
      if (screen === 'game' || screen === 'lobby') {
        setWsError('Connection lost. Attempting to reconnect…');
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  return socketRef.current;
}
