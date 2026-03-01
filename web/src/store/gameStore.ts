import { create } from 'zustand';
import {
  AuthUser, BirdSkinId, DayPhase, FinalRankingPayload,
  GuestUser, LeaderboardEntry, RoomInfo, RoomPlayer, Screen,
} from '../types';

interface GameStore {
  // ── Navigation ──────────────────────────────
  screen: Screen;
  setScreen: (s: Screen) => void;

  // ── Auth ─────────────────────────────────────
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;

  // ── Guest / solo mode ─────────────────────────
  guest: GuestUser | null;
  setGuest: (g: GuestUser | null) => void;
  soloHighScore: number;
  setSoloHighScore: (s: number) => void;

  // ── Room ─────────────────────────────────────
  room: RoomInfo | null;
  setRoom: (r: RoomInfo | null) => void;
  roomPlayers: RoomPlayer[];
  setRoomPlayers: (p: RoomPlayer[]) => void;
  addRoomPlayer: (p: RoomPlayer) => void;
  removeRoomPlayer: (userId: string) => void;

  // ── Game state ────────────────────────────────
  score: number;
  setScore: (s: number) => void;
  isAlive: boolean;
  setIsAlive: (a: boolean) => void;
  finalScore: number;
  setFinalScore: (s: number) => void;

  // ── Leaderboard ───────────────────────────────
  leaderboard: LeaderboardEntry[];
  setLeaderboard: (l: LeaderboardEntry[]) => void;
  /** Personal final-ranking result received from server on game_over */
  finalRanking: FinalRankingPayload | null;
  setFinalRanking: (r: FinalRankingPayload | null) => void;
  // ── Appearance ────────────────────────────────
  selectedSkin: BirdSkinId;
  setSkin: (id: BirdSkinId) => void;
  dayPhase: DayPhase;
  setDayPhase: (d: DayPhase) => void;
  soundEnabled: boolean;
  toggleSound: () => void;

  // ── Invite modal ──────────────────────────────
  showInviteModal: boolean;
  setShowInviteModal: (v: boolean) => void;
  // ── Auth modal (guard for multiplayer actions) ────────
  showAuthModal: boolean;
  authModalPendingAction: (() => void) | null;
  openAuthModal: (onSuccess: () => void) => void;
  closeAuthModal: () => void;

  // ── Pending join (navigated to lobby before WS emits) ──
  pendingJoinRoomId: string | null;
  setPendingJoinRoomId: (id: string | null) => void;

  // ── Session restore flag ─────────────────────────────────
  /** True while the initial /auth/me call is in flight */
  isRestoring: boolean;
  setIsRestoring: (v: boolean) => void;

  // ── WebSocket / connection errors ────────────────────────
  /** Non-null when the WS layer has a displayable error for the lobby/game */
  wsError: string | null;
  setWsError: (msg: string | null) => void;

  // ── Lobby countdown (server-driven: fires on game_starting for all players) ─
  gameCountdown: number | null;
  setGameCountdown: (n: number | null) => void;

  // ── Game state reset ────────────────────────────────────────
  /** Clears all in-game state when leaving a game */
  resetGameState: () => void;}

export const useGameStore = create<GameStore>((set) => ({
  screen: 'auth',
  setScreen: (screen) => set({ screen }),

  user: null,
  setUser: (user) => set({ user }),

  guest: null,
  setGuest: (guest) => set({ guest }),
  soloHighScore: 0,
  setSoloHighScore: (soloHighScore) => set({ soloHighScore }),

  room: null,
  setRoom: (room) => set({ room }),
  roomPlayers: [],
  setRoomPlayers: (roomPlayers) => set({ roomPlayers }),
  addRoomPlayer: (p) =>
    set((s) => ({ roomPlayers: [...s.roomPlayers.filter((x) => x.userId !== p.userId), p] })),
  removeRoomPlayer: (userId) =>
    set((s) => ({ roomPlayers: s.roomPlayers.filter((x) => x.userId !== userId) })),

  score: 0,
  setScore: (score) => set({ score }),
  isAlive: true,
  setIsAlive: (isAlive) => set({ isAlive }),
  finalScore: 0,
  setFinalScore: (finalScore) => set({ finalScore }),

  leaderboard: [],
  setLeaderboard: (leaderboard) => set({ leaderboard }),

  finalRanking: null,
  setFinalRanking: (finalRanking) => set({ finalRanking }),

  selectedSkin: 'classic',
  setSkin: (selectedSkin) => set({ selectedSkin }),
  dayPhase: 'day',
  setDayPhase: (dayPhase) => set({ dayPhase }),
  soundEnabled: true,
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),

  showInviteModal: false,
  setShowInviteModal: (showInviteModal) => set({ showInviteModal }),

  showAuthModal: false,
  authModalPendingAction: null,
  openAuthModal: (onSuccess) =>
    set({ showAuthModal: true, authModalPendingAction: onSuccess }),
  closeAuthModal: () =>
    set({ showAuthModal: false, authModalPendingAction: null }),

  pendingJoinRoomId: null,
  setPendingJoinRoomId: (pendingJoinRoomId) => set({ pendingJoinRoomId }),

  isRestoring: true, // assume restoring until proven otherwise
  setIsRestoring: (isRestoring) => set({ isRestoring }),

  wsError: null,
  setWsError: (wsError) => set({ wsError }),

  gameCountdown: null,
  setGameCountdown: (gameCountdown) => set({ gameCountdown }),

  resetGameState: () => set({
    score:         0,
    isAlive:       true,
    finalScore:    0,
    leaderboard:   [],
    finalRanking:  null,
    room:          null,
    roomPlayers:   [],
    gameCountdown: null,
  }),
}));
