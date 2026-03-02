// Shared UI types (separate from server types, no pg/redis deps)

export type Screen = 'auth' | 'menu' | 'lobby' | 'game' | 'results' | 'solo';

export interface GuestUser {
  id:        string;
  username:  string;
  highScore: number; // persisted in localStorage
}

export type DayPhase = 'day' | 'dusk' | 'night' | 'dawn';

export interface LeaderboardEntry {
  userId:       string;
  username:     string;
  score:        number;
  isAlive:      boolean;
  rank:         number;        // 1-based, server-assigned
  previousRank: number | null; // null = first time we see this player
}

export interface RankMovement {
  userId:     string;
  oldRank:    number;
  newRank:    number;
  scoreDelta: number;
}

/** Payload of the leaderboard_update WS event */
export interface LeaderboardUpdate {
  roomId:    string;
  entries:   Array<Omit<LeaderboardEntry, 'previousRank'>>;
  movements: RankMovement[];
  isFinal:   boolean;
}

/** Emitted by a player when they collect a power-up */
export interface PowerUpActivatedPayload {
  userId:   string;
  username: string;
  type:     string;
}

/** Payload of the final_ranking WS event (per-player) */
export interface FinalRankingPayload {
  rank:         number;
  totalPlayers: number;
  finalScore:   number;
}

export interface RoomPlayer {
  userId:    string;
  username:  string;
  avatar:    string | null;
  ready:     boolean;
  highScore: number;
}

export interface AuthUser {
  id:        string;
  username:  string;
  avatar:    string | null;
  highScore: number;
  token:     string;
}

export interface RoomInfo {
  /** Canonical room identifier */
  id:          string;
  hostId:      string;
  joinUrl:     string;
  joinToken:   string;
  playerCount: number;
  status:      'waiting' | 'active' | 'closed';
}

export type BirdSkinId =
  | 'classic'
  | 'blue'
  | 'red'
  | 'gold'
  | 'neon'
  | 'galaxy'
  | 'inferno'
  | 'aqua'
  | 'thunder'
  | 'shadow'
  | 'rainbow';

export interface BirdSkin {
  id:          BirdSkinId;
  name:        string;
  emoji:       string;
  bodyColor:   string;
  wingColor:   string;
  eyeColor:    string;
  beakColor:   string;
  unlockScore: number;
  glowColor?:  string;
  rarity?:     'common' | 'rare' | 'epic' | 'legendary';
}
