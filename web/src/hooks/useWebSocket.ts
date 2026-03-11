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
    setTimerRemaining,
    setTimerTotal,
    setIsTimerMode,
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
    setTimerRemaining: s.setTimerRemaining,
    setTimerTotal:    s.setTimerTotal,
    setIsTimerMode:   s.setIsTimerMode,
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

    socket.on('game_started', ({ startedAt: _t, timerConfig }: { startedAt: number; timerConfig?: { enabled: boolean; durationSeconds: number } | null }) => {
      // Reset per-game state so the canvas boots fresh for every round
      setScore(0);
      useGameStore.getState().setBestScore(0);
      setIsAlive(true);
      setFinalRanking(null);
      setCountdown(null);
      // Set up timer mode if configured
      if (timerConfig?.enabled && timerConfig.durationSeconds > 0) {
        setIsTimerMode(true);
        setTimerTotal(timerConfig.durationSeconds);
        setTimerRemaining(timerConfig.durationSeconds);
      } else {
        setIsTimerMode(false);
        setTimerTotal(null);
        setTimerRemaining(null);
      }
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

    // ── timer_tick (timer mode countdown from server) ──────────────
    socket.on('timer_tick', ({ remaining, total }: { remaining: number; total: number }) => {
      setTimerRemaining(remaining);
      setTimerTotal(total);
    });

    // ── game_finished (timer expired — game over for all) ──────────
    socket.on('game_finished', ({ leaderboard: finalLb, winner }: {
      roomId: string;
      reason: string;
      winner: { userId: string; username: string; score: number } | null;
      leaderboard: LeaderboardEntry[];
    }) => {
      // Update leaderboard with final data, normalising alive → isAlive
      if (finalLb) {
        const normalized = finalLb.map((e: any) => ({
          ...e,
          isAlive:      e.isAlive ?? e.alive ?? true,
          previousRank: null,
        }));
        setLeaderboard(normalized);
      }
      // Show final ranking for the current user
      const currentUser = useGameStore.getState().user;
      const currentGuest = useGameStore.getState().guest;
      const myId = currentUser?.id ?? currentGuest?.id;
      const myEntry = finalLb?.find((e: LeaderboardEntry) => e.userId === myId);
      if (myEntry) {
        setFinalRanking({
          rank: myEntry.rank,
          totalPlayers: finalLb.length,
          finalScore: myEntry.score,
        });
      } else {
        // Fallback: show rank 0
        setFinalRanking({
          rank: 0,
          totalPlayers: finalLb?.length ?? 0,
          finalScore: useGameStore.getState().score,
        });
      }
      // Clear timer state
      setTimerRemaining(null);
      setTimerTotal(null);
      setIsTimerMode(false);
    });

    // ── player_respawn (timer mode — death is temporary) ───────────
    socket.on('player_respawn', () => {
      // Reset alive so the game engine detects the transition and
      // resets to 'waiting' ("Tap to Start") for the respawned player.
      setFinalRanking(null);
      setIsAlive(true);
      setScore(0);
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

    // Server emits host_updated (e.g. on transfer_host or disconnect reassignment)
    socket.on('host_updated', ({ newHostId }: { newHostId: string }) => {
      const current = useGameStore.getState().room;
      if (current) setRoom({ ...current, hostId: newHostId });
    });

    // ── round_ended / round_reset (persistent session lifecycle) ─────
    // Server emits round_ended when all players die, then round_reset
    // after the grace period to return to lobby for the next round.
    socket.on('round_ended', () => {
      // No action needed — FinalRanking overlay handles per-player UI
    });

    socket.on('round_reset', () => {
      // Server has reset the room to 'waiting' — send all players back to lobby
      setScore(0);
      setIsAlive(true);
      setFinalRanking(null);
      setCountdown(null);
      useGameStore.getState().setLeaderboard([]);
      setScreen('lobby');
    });

    // ── session_closed (host closed the persistent session) ──────────
    socket.on('session_closed', () => {
      resetGameState();
      setScreen('menu');
    });

    socket.on('error', ({ message, code }: ErrorPayload) => {
      console.error('[WS] server error:', code, message);
      // ALREADY_STARTED / NOT_HOST are non-fatal races — the UI already guards
      // against them; surfacing them as a full-screen error is too disruptive.
      // GAME_ACTIVE fires when a reconnect races the active-room guard — also silent.
      // ROOM_NOT_ACTIVE fires when player_restart races a round reset — harmless.
      const silent = code === 'ALREADY_STARTED' || code === 'NOT_HOST' || code === 'GAME_ACTIVE' || code === 'ROOM_NOT_ACTIVE';
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
