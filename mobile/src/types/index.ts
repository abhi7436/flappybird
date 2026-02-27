// Re-export relevant server types
import type { LeaderboardEntry as _LeaderboardEntry } from '../../../src/server/types/index';
export type { LeaderboardEntry as LeaderboardEntry } from '../../../src/server/types/index';
export type {
  LeaderboardUpdate,
  RankMovement,
  PlayerState,
  RoomMeta,
  CreateRoomResult,
  JwtPayload,
} from '../../../src/server/types/index';

// Local alias for use within this file
type LeaderboardEntry = _LeaderboardEntry;

// ── Mobile-specific auth types ─────────────────────────────────
export interface AuthUser {
  id: string;
  username: string;
  avatar: string | null;
  high_score: number;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// ── Friend types ───────────────────────────────────────────────
export type FriendStatus = 'pending' | 'accepted' | 'blocked';

export interface Friend {
  id: string;
  username: string;
  avatar: string | null;
  high_score: number;
  is_online: boolean;
  friendshipId: string;
  status: FriendStatus;
  requesterIsMe: boolean;
}

// ── Notification types ─────────────────────────────────────────
export interface NotificationData {
  type: 'friend_invite' | 'friend_request' | 'game_starting';
  roomId?: string;
  joinToken?: string;
  fromUsername?: string;
}

// ── Global leaderboard (REST) ──────────────────────────────────
export interface GlobalLeaderboardEntry {
  userId: string;
  username: string;
  avatar: string | null;
  high_score: number;
  rank: number;
}

// ── Game screen state ──────────────────────────────────────────
export type Screen = 'auth' | 'tabs' | 'game';

export interface FinalRankingPayload {
  rank: number;
  totalPlayers: number;
  finalScore: number;
  entries?: LeaderboardEntry[];
}
