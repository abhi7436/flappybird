import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import {
  FinalRankingPayload,
  LeaderboardEntry,
  LeaderboardUpdate,
  PowerUpActivatedPayload,
} from '../types';
import { loadToken, clearAuthStorage } from '../services/authStorage';
import { LeaderboardSync } from '../sync';

type RoomJoinedPayload  = { roomId: string; playerId: string; hostId: string };
type PlayerJoinedPayload = { playerId: string; userId: string; username: string };
type PlayerLeftPayload   = { userId: string };
type RoomClosedPayload   = { reason: string };
type ErrorPayload        = { message: string; code?: string };

const WS_URL = import.meta.env.VITE_WS_URL ?? '';

export function useWebSocket(): Socket | null {
  const socketRef = useRef<Socket | null>(null);
  const {
    user,
    leaderboard: currentLb,
    setScreen,
    setUser,
    setRoom,
    setRoomPlayers,
    setLeaderboard,
    setFinalRanking,
    setScore,
    setIsAlive,
    resetGameState,
    addRoomPlayer,
    removeRoomPlayer,
    setWsError,
    setPlayerPowerUp,
    setCountdown,
  } = useGameStore((s) => ({
    user:             s.user,
    leaderboard:      s.leaderboard,
    setScreen:        s.setScreen,
    setUser:          s.setUser,
    setRoom:          s.setRoom,
    setRoomPlayers:   s.setRoomPlayers,
    setLeaderboard:   s.setLeaderboard,
    setFinalRanking:  s.setFinalRanking,
    setScore:         s.setScore,
    setIsAlive:       s.setIsAlive,
    resetGameState:   s.resetGameState,
    addRoomPlayer:    s.addRoomPlayer,
    removeRoomPlayer: s.removeRoomPlayer,
    setWsError:       s.setWsError,
    setPlayerPowerUp: s.setPlayerPowerUp,
    setCountdown:     s.setCountdown,
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
    socket.on('room_joined', ({ roomId, hostId }: RoomJoinedPayload) => {
      // Don't yank the user out of an in-progress game just because the socket
      // reconnected and the server re-acknowledged the room join.
      const currentScreen = useGameStore.getState().screen;
      if (currentScreen === 'game') return;
      setRoom({ id: roomId, hostId, joinUrl: '', joinToken: '', playerCount: 1, status: 'waiting' });
      setScreen('lobby');
    });
    // ── room_state ────────────────────────────────────────
    // Server sends the complete player list to a newly joined client.
    socket.on('room_state', ({ players }: { players: { userId: string; username: string; avatar: null; ready: boolean; highScore: number }[] }) => {
      setRoomPlayers(players);
    });
    // ── leaderboard_update ──────────────────────────────
    socket.on('leaderboard_update', (update: LeaderboardUpdate) => {
      setLeaderboard(LeaderboardSync.process(update, lbRef.current));
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
      setCountdown(null);
      setScreen('game');
    });

    // ── game_countdown (server-driven — shown on ALL clients) ───────
    socket.on('game_countdown', ({ n }: { n: number }) => {
      setCountdown(n);
    });

    // ── powerup_activated (other players' power-up broadcast) ───────

    socket.on('powerup_activated', ({ userId, type }: PowerUpActivatedPayload) => {
      setPlayerPowerUp(userId, type);
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

    socket.on('error', ({ message, code }: ErrorPayload) => {
      console.error('[WS] server error:', code, message);
      // ALREADY_STARTED / NOT_HOST are non-fatal races — the UI already guards
      // against them; surfacing them as a full-screen error is too disruptive.
      // GAME_ACTIVE fires when a reconnect races the active-room guard — also silent.
      const silent = code === 'ALREADY_STARTED' || code === 'NOT_HOST' || code === 'GAME_ACTIVE';
      if (!silent) setWsError(message);
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
