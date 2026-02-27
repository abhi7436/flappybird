// ============================================================
// Shared domain types across server
// ============================================================

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  avatar: string | null;
  high_score: number;
  elo_rating: number;
  games_played: number;
  is_online: boolean;
  created_at: Date;
  updated_at: Date;
}

export type PublicUser = Omit<UserRecord, 'password_hash' | 'email'>;

export interface FriendRecord {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: Date;
  updated_at: Date;
}

export interface FriendWithUser extends FriendRecord {
  friend: PublicUser;
}

export interface GameHistoryRecord {
  id: string;
  user_id: string;
  room_id: string;
  score: number;
  rank: number | null;
  duration_ms: number | null;
  elo_before: number | null;
  elo_after: number | null;
  elo_change: number | null;
  powerups_collected: Record<string, number>;
  total_players: number | null;
  tournament_match_id: string | null;
  created_at: Date;
}

export interface RoomInviteRecord {
  id: string;
  room_id: string;
  invite_code: string;
  created_by: string;
  expires_at: Date;
  created_at: Date;
}

// ── Skins ───────────────────────────────────────────────────────
export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type SkinSeason = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SkinRecord {
  id: string;
  name: string;
  description: string | null;
  season: SkinSeason | null;
  rarity: SkinRarity;
  unlock_condition: string | null;
  color_body: string;
  color_wing: string;
  color_eye: string;
  color_beak: string;
  is_active: boolean;
  min_elo: number;
  created_at: Date;
}

export interface UserSkinRecord {
  id: string;
  user_id: string;
  skin_id: string;
  unlocked_at: Date;
  is_equipped: boolean;
}

export interface SkinWithOwnership extends SkinRecord {
  owned: boolean;
  equipped: boolean;
}

// ── ELO ────────────────────────────────────────────────────────
export interface EloChangeResult {
  userId: string;
  oldElo: number;
  newElo: number;
  delta: number;
}

// ── Tournaments ────────────────────────────────────────────────
export type TournamentStatus = 'registration' | 'active' | 'completed' | 'cancelled';
export type BracketType      = 'single_elimination' | 'round_robin';
export type MatchStatus      = 'pending' | 'active' | 'completed' | 'bye';

export interface TournamentRecord {
  id: string;
  name: string;
  description: string | null;
  status: TournamentStatus;
  bracket_type: BracketType;
  max_participants: number;
  rounds_total: number;
  current_round: number;
  prize_info: string | null;
  created_by: string;
  starts_at: Date;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  username: string;
  avatar: string | null;
  elo_at_entry: number;
  seed: number | null;
  eliminated_round: number | null;
  final_placement: number | null;
  created_at: Date;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round_number: number;
  match_number: number;
  room_id: string | null;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  status: MatchStatus;
  scheduled_at: Date | null;
  completed_at: Date | null;
  player1?: { username: string; avatar: string | null };
  player2?: { username: string; avatar: string | null };
}

export interface TournamentDetail extends TournamentRecord {
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  participant_count: number;
}

// ── Replays ────────────────────────────────────────────────────
export interface ReplayRecord {
  id: string;
  room_id: string;
  user_id: string;
  final_score: number;
  final_rank: number | null;
  duration_ms: number;
  seed: number;
  events: Array<{ t: number; type: string }>;
  canvas_width: number;
  canvas_height: number;
  engine_version: string;
  created_at: Date;
}

// ── Analytics ─────────────────────────────────────────────────
export interface PlayerAnalytics {
  userId: string;
  username: string;
  totalGames: number;
  avgScore: number;
  bestScore: number;
  avgRank: number;
  winRate: number;          // % games finishing rank 1
  avgDurationMs: number;
  currentElo: number;
  eloHistory: Array<{ date: string; elo: number }>;
  scoreHistory: Array<{ date: string; score: number }>;
  powerupFrequency: Record<string, number>;
}

// ── WebSocket types ────────────────────────────────────────────
export interface PlayerState {
  id: string;        // socket.id
  userId: string;
  username: string;
  score: number;
  alive: boolean;
  lastScoreAt: number;
  equippedSkin?: string;
}

export interface SpectatorState {
  roomId: string;
  players: LeaderboardEntry[];
  gameStartedAt: number;
}

export interface LeaderboardEntry {
  userId:   string;
  username: string;
  score:    number;
  alive:    boolean;
  rank:     number;
  equippedSkin?: string;
}

export interface RankMovement {
  userId:     string;
  oldRank:    number;
  newRank:    number;
  scoreDelta: number;
}

export interface LeaderboardUpdate {
  roomId:    string;
  entries:   LeaderboardEntry[];
  movements: RankMovement[];
  isFinal:   boolean;
}

// ── Room types ─────────────────────────────────────────────────
export type RoomStatus = 'waiting' | 'active' | 'closed';

export interface RoomMeta {
  roomId: string;
  status: RoomStatus;
  createdBy: string;
  createdAt: number;
  lastActivityAt: number;
  playerCount: number;
  spectatorCount: number;
  tournamentMatchId?: string;
}

export interface CreateRoomResult {
  roomId: string;
  joinToken: string;
  joinUrl: string;
  expiresAt: Date;
}

// ── JWT payloads ───────────────────────────────────────────────
export interface RoomJoinPayload {
  roomId: string;
  type: 'room_join';
  iat?: number;
  exp?: number;
}

export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

// ── Notification ───────────────────────────────────────────────
export interface DeviceTokenRecord {
  id: string;
  user_id: string;
  token: string;
  platform: 'expo' | 'apns' | 'fcm';
  created_at: Date;
  updated_at: Date;
}
