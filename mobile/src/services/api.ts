import { getToken } from './storage';
import { AuthResponse, Friend, GlobalLeaderboardEntry } from '../types';
import {
  CreateRoomResult, RoomMeta, SkinWithOwnership,
  TournamentRecord, TournamentDetail, ReplayRecord,
} from '../../../src/server/types/index';

const RAW_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const BASE = RAW_BASE.replace(/\/+$/, '');

// ── HTTP helpers ──────────────────────────────────────────────

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  authenticated = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authenticated) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const res = await fetch(`${BASE}${normalizedPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  const text = await res.text();
  const isJson = contentType.includes('application/json');

  if (!isJson) {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 120);
    throw new Error(`Expected JSON, got ${contentType || 'non-JSON'} (HTTP ${res.status}). ${snippet}`);
  }

  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server returned invalid JSON (HTTP ${res.status})`);
  }

  if (!res.ok) throw new Error(json?.error ?? json?.message ?? `HTTP ${res.status}`);
  return json as T;
}

const get  = <T>(path: string, auth = true) => req<T>('GET', path, undefined, auth);
const post = <T>(path: string, body: unknown, auth = true) => req<T>('POST', path, body, auth);
const del  = <T>(path: string, auth = true) => req<T>('DELETE', path, undefined, auth);

// ── Auth endpoints ────────────────────────────────────────────

export const Auth = {
  register: (username: string, email: string, password: string) =>
    post<AuthResponse>('/api/auth/register', { username, email, password }, false),

  login: (email: string, password: string) =>
    post<AuthResponse>('/api/auth/login', { email, password }, false),
};

// ── Profile endpoints ─────────────────────────────────────────

export const Profile = {
  me: () => get<{ id: string; username: string; avatar: string | null; high_score: number; is_online: boolean }>('/api/profile/me'),

  history: (limit = 20, offset = 0) =>
    get<Array<{ id: string; room_id: string; score: number; rank: number | null; created_at: string }>>(
      `/api/profile/me/history?limit=${limit}&offset=${offset}`
    ),

  public: (username: string) =>
    get<{ profile: object; recentGames: object[] }>(`/api/profile/${username}`, false),
};

// ── Friends endpoints ─────────────────────────────────────────

export const Friends = {
  list: () => get<Friend[]>('/api/friends'),

  sendRequest: (toUserId: string) =>
    post<{ message: string }>('/api/friends/request', { toUserId }),

  accept: (friendshipId: string) =>
    post<{ message: string }>(`/api/friends/${friendshipId}/accept`, {}),

  block: (friendshipId: string) =>
    post<{ message: string }>(`/api/friends/${friendshipId}/block`, {}),

  remove: (friendshipId: string) =>
    del<{ message: string }>(`/api/friends/${friendshipId}`),
};

// ── Rooms endpoints ───────────────────────────────────────────

export const Rooms = {
  create: () => post<CreateRoomResult>('/api/rooms', {}),

  getMeta: (roomId: string) => get<RoomMeta>(`/api/rooms/${roomId}`, false),

  validateJoin: (roomId: string, joinToken?: string) => {
    const qs = joinToken ? `?t=${joinToken}` : '';
    return get<{ ok: boolean }>(`/api/rooms/${roomId}/validate-join${qs}`);
  },

  close: (roomId: string) => del<{ message: string }>(`/api/rooms/${roomId}`),
};

// ── Invites endpoints ──────────────────────────────────────────

export const Invites = {
  create: (roomId: string, toUserId: string) =>
    post<{ inviteCode: string }>('/api/invites', { roomId, toUserId }),
};

// ── Leaderboard (global) ──────────────────────────────────────

export const Leaderboard = {
  global: (limit = 50) =>
    get<GlobalLeaderboardEntry[]>(`/api/leaderboard?limit=${limit}`, false),
};

// ── Push notification token registration ─────────────────────
export const Notifications = {
  registerToken: (token: string, platform = 'expo') =>
    post<{ success: boolean }>('/api/notifications/register-token', { token, platform }),
  removeToken: (token: string) =>
    req<void>('DELETE', '/api/notifications/token', { token }),
};

// ── Skins ─────────────────────────────────────────────────────
export const Skins = {
  all:     () => get<{ skins: SkinWithOwnership[] }>('/api/skins'),
  equip:   (skinId: string) => post<{ success: boolean }>(`/api/skins/${skinId}/equip`, {}),
  equipped: () => get<{ skin: SkinWithOwnership }>('/api/skins/equipped'),
};

// ── Tournaments ────────────────────────────────────────────────
export const Tournaments = {
  list:     (status?: string) =>
    get<{ tournaments: TournamentRecord[] }>(`/api/tournaments${status ? `?status=${status}` : ''}`),
  detail:   (id: string) => get<{ tournament: TournamentDetail }>(`/api/tournaments/${id}`),
  create:   (body: {
    name: string; description?: string; bracketType?: string;
    maxParticipants?: number; startsAt: string; prizeInfo?: string;
  }) => post<{ tournament: TournamentRecord }>('/api/tournaments', body),
  register: (id: string) => post<{ success: boolean }>(`/api/tournaments/${id}/register`, {}),
  start:    (id: string) => post<{ success: boolean }>(`/api/tournaments/${id}/start`, {}),
};

// ── Replays ────────────────────────────────────────────────────
export const Replays = {
  my:         (limit = 20, offset = 0) =>
    get<{ replays: ReplayRecord[] }>(`/api/replays/me?limit=${limit}&offset=${offset}`),
  top:        () => get<{ replays: ReplayRecord[] }>('/api/replays/top'),
  byId:       (id: string) => get<{ replay: ReplayRecord }>(`/api/replays/${id}`),
  byRoom:     (roomId: string) => get<{ replays: ReplayRecord[] }>(`/api/replays/room/${roomId}`),
  delete:     (id: string) => req<{ success: boolean }>('DELETE', `/api/replays/${id}`),
};

// ── Analytics ─────────────────────────────────────────────────
export const Analytics = {
  me:         () => get<{ analytics: object }>('/api/analytics/me'),
  user:       (userId: string) => get<{ analytics: object }>(`/api/analytics/users/${userId}`),
  leaderboard: (sort: 'high_score' | 'elo' = 'high_score', limit = 100) =>
    get<{ entries: object[] }>(`/api/analytics/leaderboard?sort=${sort}&limit=${limit}`),
  history:    (limit = 20, offset = 0) =>
    get<{ history: object[] }>(`/api/analytics/me/history?limit=${limit}&offset=${offset}`),
};
