import { create } from 'zustand';
import { AuthUser, FinalRankingPayload, LeaderboardEntry } from '../types';
import type { EloChangeResult } from '../../../src/server/types';

interface GameStore {
  // ── Auth ────────────────────────────────────────────────────
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  // ── Guest / solo mode ───────────────────────────
  guestId: string | null;
  guestUsername: string | null;
  soloHighScore: number;
  setGuest: (id: string, username: string, highScore: number) => void;
  clearGuest: () => void;
  setSoloHighScore: (score: number) => void;
  // ── Room ────────────────────────────────────────────────────
  currentRoomId: string | null;
  setCurrentRoomId: (roomId: string | null) => void;

  // ── In-game state ───────────────────────────────────────────
  score: number;
  setScore: (score: number) => void;

  leaderboard: LeaderboardEntry[];
  setLeaderboard: (entries: LeaderboardEntry[]) => void;

  finalRanking: FinalRankingPayload | null;
  setFinalRanking: (payload: FinalRankingPayload | null) => void;

  // ── ELO ─────────────────────────────────────────────────────
  eloChange: EloChangeResult | null;
  setEloChange: (r: EloChangeResult | null) => void;

  // ── Skin ─────────────────────────────────────────────────────
  equippedSkinId: string;
  setEquippedSkinId: (id: string) => void;

  // ── Newly unlocked skins (banner) ─────────────────────────
  newlyUnlockedSkins: string[];
  addUnlockedSkins: (ids: string[]) => void;
  clearUnlockedSkins: () => void;

  // ── Spectator ───────────────────────────────────────────────
  spectatingRoomId: string | null;
  setSpectatingRoomId: (id: string | null) => void;

  // ── Players in lobby ────────────────────────────────────────
  lobbyPlayers: Array<{ playerId: string; userId: string; username: string }>;
  addLobbyPlayer: (p: { playerId: string; userId: string; username: string }) => void;
  removeLobbyPlayer: (playerId: string) => void;
  clearLobby: () => void;

  // ── Room host ────────────────────────────────────────────────
  roomHostId: string | null;
  setRoomHostId: (id: string | null) => void;

  // ── Lobby countdown (server-driven) ─────────────────────────────
  gameCountdown: number | null;
  setGameCountdown: (n: number | null) => void;

  // ── Game lifecycle ──────────────────────────────────────────
  gameStarted: boolean;
  setGameStarted: (v: boolean) => void;

  // ── Notifications ────────────────────────────────────────────
  pendingInviteRoomId: string | null;
  pendingInviteToken: string | null;
  setPendingInvite: (roomId: string, token: string) => void;
  clearPendingInvite: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => set({ user, token }),
  clearAuth: () => set({ user: null, token: null }),

  guestId: null,
  guestUsername: null,
  soloHighScore: 0,
  setGuest: (guestId, guestUsername, soloHighScore) =>
    set({ guestId, guestUsername, soloHighScore }),
  clearGuest: () => set({ guestId: null, guestUsername: null }),
  setSoloHighScore: (soloHighScore) => set({ soloHighScore }),

  currentRoomId: null,
  setCurrentRoomId: (roomId) => set({ currentRoomId: roomId }),

  score: 0,
  setScore: (score) => set({ score }),

  leaderboard: [],
  setLeaderboard: (entries) => set({ leaderboard: entries }),

  finalRanking: null,
  setFinalRanking: (payload) => set({ finalRanking: payload }),

  eloChange: null,
  setEloChange: (r) => set({ eloChange: r }),

  equippedSkinId: 'classic',
  setEquippedSkinId: (id) => set({ equippedSkinId: id }),

  newlyUnlockedSkins: [],
  addUnlockedSkins: (ids) =>
    set((s) => ({ newlyUnlockedSkins: [...s.newlyUnlockedSkins, ...ids] })),
  clearUnlockedSkins: () => set({ newlyUnlockedSkins: [] }),

  spectatingRoomId: null,
  setSpectatingRoomId: (id) => set({ spectatingRoomId: id }),

  lobbyPlayers: [],
  addLobbyPlayer: (p) =>
    set((s) => {
      if (s.lobbyPlayers.some((x) => x.playerId === p.playerId)) return s;
      return { lobbyPlayers: [...s.lobbyPlayers, { playerId: p.playerId, userId: p.userId, username: p.username }] };
    }),
  removeLobbyPlayer: (playerId) =>
    set((s) => ({
      lobbyPlayers: s.lobbyPlayers.filter((x) => x.playerId !== playerId),
    })),
  clearLobby: () => set({ lobbyPlayers: [] }),

  roomHostId: null,
  setRoomHostId: (id) => set({ roomHostId: id }),

  gameCountdown: null,
  setGameCountdown: (gameCountdown) => set({ gameCountdown }),

  gameStarted: false,
  setGameStarted: (v) => set({ gameStarted: v }),

  pendingInviteRoomId: null,
  pendingInviteToken: null,
  setPendingInvite: (roomId, token) =>
    set({ pendingInviteRoomId: roomId, pendingInviteToken: token }),
  clearPendingInvite: () =>
    set({ pendingInviteRoomId: null, pendingInviteToken: null }),
}));
