import http from 'http';
import { Server, Socket } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { RoomManager } from './RoomManager';
import { AntiCheatService } from './services/AntiCheatService';
import { LeaderboardService } from './services/LeaderboardService';
import { RoomService } from './services/RoomService';
import { EloService } from './services/EloService';
import { GameHistoryRepository } from './repositories/GameHistoryRepository';
import { UserRepository } from './repositories/UserRepository';
import { ReplayRepository } from './repositories/ReplayRepository';
import { SkinRepository } from './repositories/SkinRepository';
import { verifyToken } from './middleware/authMiddleware';
import { LeaderboardEntry, LeaderboardUpdate, PlayerState } from './types';
import { config, allowedOrigins } from './config/env';
import type { ReplayData } from '../game-engine/ReplayRecorder';

const roomManager = new RoomManager();

// ── Socket-to-room tracking (for cleanup on disconnect) ───────
const socketRoomMap = new Map<string, { roomId: string; userId: string }>();
/** Rooms currently in the 3-2-1 countdown — prevents double-start races */
const countingDownRooms = new Set<string>();

// ── Spectator tracking: socketId → roomId ─────────────────────
const spectatorRoomMap = new Map<string, string>();

// ── Per-room replay accumulation: userId → ReplayData ─────────
// Clients send their final replay once; server persists it.
const pendingReplays = new Map<string, ReplayData>();
const leaderboardSnapshots = new Map<string, LeaderboardEntry[]>();
const pendingBroadcasts = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Schedule a leaderboard broadcast for `roomId`.
 * At most one broadcast fires per 100ms per room.
 * The first call schedules a 100ms timer; subsequent calls within that window
 * are de-duped. After the timer fires the map entry is removed so the next
 * call schedules a fresh timer.
 */
function scheduleBroadcast(
  io: Server,
  roomId: string,
  isFinal = false
): void {
  // If a broadcast is already pending and this isn't a final event, skip.
  if (pendingBroadcasts.has(roomId) && !isFinal) return;

  // Cancel any pending timer so a final broadcast fires immediately.
  const existing = pendingBroadcasts.get(roomId);
  if (existing) clearTimeout(existing);

  const delay = isFinal ? 0 : 100;
  const timer = setTimeout(async () => {
    pendingBroadcasts.delete(roomId);

    const curr = await roomManager.getLeaderboard(roomId);
    const prev = leaderboardSnapshots.get(roomId) ?? [];
    const movements = LeaderboardService.computeMovements(prev, curr);
    leaderboardSnapshots.set(roomId, curr);

    // Only broadcast if something actually changed (delta > 0 or first time)
    if (movements.length === 0 && prev.length > 0 && !isFinal) return;

    const update: LeaderboardUpdate = {
      roomId,
      entries:   curr,
      movements,
      isFinal,
    };

    io.to(roomId).emit('leaderboard_update', update);
    await LeaderboardService.publishLeaderboardUpdate(update);
  }, delay);

  pendingBroadcasts.set(roomId, timer);
}

export async function initializeWebSocketServer(
  httpServer: http.Server
): Promise<{ io: Server }> {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    // Require auth on connection — reject anonymous handshakes early
    connectTimeout: 10_000,
  });

  // ── Socket.IO Redis adapter (horizontal scaling) ───────────
  // Each app instance shares room/socket state via Redis so that
  // io.to(roomId).emit() fans out across all replicas.
  const pubClient = createClient({ url: config.REDIS_URL });
  const subClient = pubClient.duplicate();
  pubClient.on('error', (err) => console.error('[WS] Adapter pub error', err));
  subClient.on('error', (err) => console.error('[WS] Adapter sub error', err));
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  console.log('[WS] Redis adapter attached');

  // ── Auth middleware on handshake ───────────────────────────
  io.use((socket, next) => {
    // 1. Prefer explicit auth.token (passed by client JS)
    // 2. Fall back to Authorization header
    // 3. Fall back to flappy_auth HTTP-only cookie (sent automatically by browser)
    let token: string | undefined =
      socket.handshake.auth?.token ??
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      const cookieHeader = socket.handshake.headers?.cookie ?? '';
      const match = cookieHeader.match(/(?:^|;\s*)flappy_auth=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = verifyToken(token);
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Redis Pub/Sub subscriber (for multi-instance scaling) ──
  const subscriber = createClient({ url: config.REDIS_URL });
  await subscriber.connect();

  // ── Inactivity watcher ────────────────────────────────────
  RoomService.startInactivityWatcher(io);

  // ── Connection handler ────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user as { userId: string; username: string };
    console.log(`[WS] Connected: ${socket.id} (${user.username})`);

    UserRepository.setOnlineStatus(user.userId, true).catch(() => {});

    // ── join_room ────────────────────────────────────────
    socket.on(
      'join_room',
      async ({ roomId, joinToken }: { roomId: string; joinToken?: string }) => {
        // 1. Room must exist and be open
        const roomMeta0 = await RoomService.getMeta(roomId);
        if (!roomMeta0) {
          socket.emit('error', { message: 'Room has expired or does not exist', code: 'ROOM_EXPIRED' });
          return;
        }
        if (roomMeta0.status === 'closed') {
          socket.emit('error', { message: 'Room is already closed', code: 'ROOM_CLOSED' });
          return;
        }
        // Block late joiners from entering an already-active game.
        // Exception: if this userId is already registered (reconnect), let them through.
        const isReconnect = !!roomManager.findSocketIdForUser(roomId, user.userId);
        if (roomMeta0.status === 'active' && !isReconnect) {
          socket.emit('error', { message: 'Game is already in progress', code: 'GAME_ACTIVE' });
          return;
        }

        // 2. Duplicate / reconnect guard
        // If this userId is already registered in the room (e.g. reconnecting
        // after a network blip), evict the stale entry and re-add with the new
        // socket.id so the player re-joins cleanly without doubling up.
        const existingSocketId = roomManager.findSocketIdForUser(roomId, user.userId);
        if (existingSocketId) {
          if (existingSocketId === socket.id) {
            // Exact duplicate — already in room, just re-ack
            const meta = await RoomService.getMeta(roomId);
            socket.emit('room_joined', {
              roomId,
              playerId: socket.id,
              hostId:   meta?.createdBy ?? user.userId,
            });
            return;
          }
          // Stale socket from previous connection — replace it
          roomManager.removePlayer(roomId, existingSocketId);
          socketRoomMap.delete(existingSocketId);
        }

        // 3. Optional join token validation
        if (joinToken) {
          try {
            const payload = RoomService.verifyJoinToken(joinToken);
            if (payload.type !== 'room_join' || payload.roomId !== roomId) {
              socket.emit('error', { message: 'Invalid join token for this room', code: 'BAD_TOKEN' });
              return;
            }
          } catch {
            socket.emit('error', { message: 'Expired or invalid join token', code: 'TOKEN_EXPIRED' });
            return;
          }
        }

        // 4. Capacity check
        if (!roomManager.canJoin(roomId)) {
          socket.emit('error', { message: 'Room is full (max 50 players)', code: 'ROOM_FULL' });
          return;
        }

        const player: PlayerState = {
          id: socket.id,
          userId: user.userId,
          username: user.username,
          score: 0,
          alive: true,
          lastScoreAt: Date.now(),
        };

        roomManager.addPlayer(roomId, player);
        socket.join(roomId);
        socketRoomMap.set(socket.id, { roomId, userId: user.userId });

        // Subscribe this instance to leaderboard pub/sub channel
        await subscriber.subscribe(`leaderboard:${roomId}`, (message) => {
          const update: LeaderboardUpdate = JSON.parse(message);
          io.to(roomId).emit('leaderboard_update', update);
        });

        await roomManager.syncToRedis(roomId, player);
        await RoomService.touchActivity(roomId);

        const roomMeta = await RoomService.getMeta(roomId);
        socket.emit('room_joined', {
          roomId,
          playerId: socket.id,
          hostId:   roomMeta?.createdBy ?? user.userId,
        });

        // Send the full current player list to the joining socket so its lobby is populated
        const existingRoom = roomManager.getRoom(roomId);
        const roomStatePlayers = existingRoom
          ? Array.from(existingRoom.values()).map((p) => ({
              userId:    p.userId,
              username:  p.username,
              avatar:    null,
              ready:     false,
              highScore: 0,
            }))
          : [];
        socket.emit('room_state', { players: roomStatePlayers });

        io.to(roomId).emit('player_joined', {
          playerId: socket.id,
          userId:   user.userId,
          username: user.username,
        });

        scheduleBroadcast(io, roomId);
      }
    );

    // ── leave_room ───────────────────────────────────────
    socket.on('leave_room', async ({ roomId }: { roomId: string }) => {
      await handleLeave(socket, io, roomId, user.userId);
    });

    // ── score_update ─────────────────────────────────────
    socket.on(
      'score_update',
      async ({ roomId, score }: { roomId: string; score: number }) => {
        // Type-guard: reject malformed or weaponised payloads before any DB work
        if (typeof score !== 'number' || !isFinite(score) || score < 0 || score > 100_000) {
          socket.emit('error', { message: 'Invalid score payload', code: 'BAD_SCORE' });
          return;
        }

        const player = roomManager.getPlayer(roomId, socket.id);
        if (!player) return;

        // Silently ignore updates from dead players (prevents post-death spam)
        if (!player.alive) return;

        const check = AntiCheatService.validateScoreUpdate(player, score);
        if (!check.valid) {
          console.warn(
            `[AntiCheat] Rejected score_update from ${user.username}: ${check.reason}`
          );
          socket.emit('error', { message: `Anti-cheat: ${check.reason}` });
          return;
        }

        const updated = roomManager.updateScore(roomId, socket.id, score);
        if (!updated) return;

        await roomManager.syncToRedis(roomId, updated);
        scheduleBroadcast(io, roomId);
      }
    );
    // ── powerup_activated ───────────────────────────────────────
    socket.on(
      'powerup_activated',
      ({ roomId, type }: { roomId: string; type: string }) => {
        if (typeof type !== 'string' || type.length > 40) return;
        const player = roomManager.getPlayer(roomId, socket.id);
        if (!player || !player.alive) return;
        // Fan out to everyone else in the room
        socket.to(roomId).emit('powerup_activated', {
          userId:   user.userId,
          username: user.username,
          type,
        });
      }
    );
    // ── game_over ────────────────────────────────────────
    socket.on(
      'game_over',
      async ({
        roomId, finalScore, replayData, powerupsCollected, durationMs,
      }: {
        roomId: string;
        finalScore: number;
        replayData?: ReplayData;
        powerupsCollected?: Record<string, number>;
        durationMs?: number;
      }) => {
        const player = roomManager.markDead(roomId, socket.id);
        if (!player) return;

        const leaderboard = await roomManager.getLeaderboard(roomId);
        const rank = leaderboard.findIndex((e) => e.userId === user.userId) + 1;
        const totalPlayers = leaderboard.length;

        // Fetch ELO before update
        const { elo_rating: eloBefore } = await UserRepository
          .findById(user.userId)
          .then((u) => u ?? { elo_rating: 1000 });

        // Persist game history + high-score update in parallel
        await Promise.all([
          GameHistoryRepository.save(user.userId, roomId, finalScore, rank),
          UserRepository.updateHighScore(user.userId, finalScore),
          roomManager.syncToRedis(roomId, player),
        ]);

        // Save replay if client submitted one
        if (replayData) {
          ReplayRepository.save({
            roomId,
            userId: user.userId,
            finalRank: rank || null,
            replay: replayData,
          }).catch((e) => console.error('[WS] Replay save error', e));
        }

        // Store for batch ELO processing when all players are done
        pendingReplays.set(user.userId, replayData ?? ({} as ReplayData));

        // Tell this player their personal final rank
        socket.emit('final_ranking', {
          rank:         rank === 0 ? totalPlayers : rank,
          totalPlayers,
          finalScore,
          eloBefore,
        });

        // Broadcast to spectators
        io.to(`spectate:${roomId}`).emit('player_dead', {
          userId: user.userId,
          username: user.username,
          finalScore,
          rank,
        });

        const { total, dead } = roomManager.getDeadStats(roomId);
        const allDead = total > 0 && dead >= total;
        scheduleBroadcast(io, roomId, allDead);

        if (allDead) {
          // Process ELO for full room
          const finalBoard = await roomManager.getLeaderboard(roomId);
          const eloResults = await EloService.processGameResults(
            finalBoard.map((e) => ({
              userId: e.userId,
              score:  e.score,
              rank:   e.rank,
              total:  finalBoard.length,
            }))
          );
          // Broadcast ELO changes
          for (const r of eloResults) {
            io.to(roomId).emit('elo_update', r);
            // Check if any new skins were unlocked
            const unlocked = await SkinRepository.checkEloUnlocks(r.userId, r.newElo);
            if (unlocked.length > 0) {
              io.to(roomId).emit('skins_unlocked', { userId: r.userId, skinIds: unlocked });
            }
          }
        }

        await RoomService.maybeCloseAllDead(roomId, io, total, dead);
      }
    );

    // ── start_game ───────────────────────────────────────
    socket.on('start_game', async ({ roomId }: { roomId: string }) => {
      // Authoritative host check: compare against the createdBy field stored in Redis
      const meta = await RoomService.getMeta(roomId);
      if (!meta) {
        socket.emit('error', { message: 'Room not found', code: 'ROOM_NOT_FOUND' });
        return;
      }
      if (meta.createdBy !== user.userId) {
        socket.emit('error', { message: 'Only the room host can start the game', code: 'NOT_HOST' });
        return;
      }

      // Guard: refuse to start with no players in memory (e.g. post-crash state)
      const room = roomManager.getRoom(roomId);
      if (!room || room.size === 0) {
        socket.emit('error', { message: 'Cannot start — no players in room', code: 'NO_PLAYERS' });
        return;
      }

      // Guard: room must still be in waiting state
      if (meta.status !== 'waiting') {
        socket.emit('error', { message: 'Game has already started or room is closed', code: 'ALREADY_STARTED' });
        return;
      }

      // Guard: already counting down (prevents double-tap / duplicate socket events)
      if (countingDownRooms.has(roomId)) {
        socket.emit('error', { message: 'Game is already starting', code: 'ALREADY_STARTED' });
        return;
      }

      // Server-driven countdown: 3 → 2 → 1 → game_started
      // Status stays 'waiting' until the countdown completes so late-joining clients
      // still see the room as joinable during the 3s window.
      countingDownRooms.add(roomId);
      let n = 3;
      const tick = () => {
        io.to(roomId).emit('game_countdown', { n });
        if (n === 0) {
          countingDownRooms.delete(roomId);
          RoomService.setStatus(roomId, 'active')
            .then(() => io.to(roomId).emit('game_started', { startedAt: Date.now() }))
            .catch((err) => console.error('[WS] Failed to activate room:', err));
          return;
        }
        n--;
        setTimeout(tick, 1000);
      };
      tick(); // emit n=3 immediately, then 2, 1, 0+start
    });

    // ── spectate_room ────────────────────────────────────
    // Spectators join a read-only channel and receive live state without
    // participating. They cannot send score updates.
    socket.on('spectate_room', async ({ roomId }: { roomId: string }) => {
      const roomOpen = await RoomService.isOpen(roomId);
      if (!roomOpen) {
        socket.emit('error', { message: 'Room not available for spectating' });
        return;
      }

      spectatorRoomMap.set(socket.id, roomId);
      socket.join(`spectate:${roomId}`);

      const currentLeaderboard = await roomManager.getLeaderboard(roomId);
      socket.emit('spectate_joined', {
        roomId,
        players: currentLeaderboard,
        spectatorCount: spectatorRoomMap.size,
      });
    });

    socket.on('leave_spectate', ({ roomId }: { roomId: string }) => {
      spectatorRoomMap.delete(socket.id);
      socket.leave(`spectate:${roomId}`);
    });

    // ── power_up_collected ───────────────────────────────
    // Client reports a power-up collection; server rebroadcasts to room
    // and spectators for visual effects (no server-side game state here —
    // game physics run client-side for low-latency).
    socket.on(
      'power_up_collected',
      ({ roomId, type }: { roomId: string; type: string }) => {
        const playerInfo = socketRoomMap.get(socket.id);
        if (!playerInfo || playerInfo.roomId !== roomId) return;

        // Rebroadcast to all other players + spectators
        socket.to(roomId).emit('power_up_collected', {
          userId:   user.userId,
          username: user.username,
          type,
        });
        io.to(`spectate:${roomId}`).emit('power_up_collected', {
          userId:   user.userId,
          username: user.username,
          type,
        });
      }
    );

    // ── disconnect ───────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[WS] Disconnected: ${socket.id} (${user.username})`);
      const info = socketRoomMap.get(socket.id);
      if (info) {
        const meta = await RoomService.getMeta(info.roomId).catch(() => null);
        if (meta?.status === 'active') {
          // Mid-game disconnect: keep the player slot in roomManager so they
          // can rejoin via join_room on reconnect without hitting GAME_ACTIVE.
          // Only clean up the socket → room mapping.
          socketRoomMap.delete(socket.id);
          socket.leave(info.roomId);
        } else {
          await handleLeave(socket, io, info.roomId, info.userId);
        }
      }
      // Clean spectator state
      const specRoomId = spectatorRoomMap.get(socket.id);
      if (specRoomId) {
        spectatorRoomMap.delete(socket.id);
        socket.leave(`spectate:${specRoomId}`);
      }
      await UserRepository.setOnlineStatus(user.userId, false).catch(() => {});
    });
  });

  return { io };
}

async function handleLeave(
  socket: Socket,
  io: Server,
  roomId: string,
  userId: string
): Promise<void> {
  roomManager.removePlayer(roomId, socket.id);
  await LeaderboardService.removePlayer(roomId, userId);
  socket.leave(roomId);
  socketRoomMap.delete(socket.id);

  io.to(roomId).emit('player_left', { playerId: socket.id, userId });
  scheduleBroadcast(io, roomId);

  // ── Host reassignment (lobby phase only) ─────────────────────
  // If the departing player was the host and the room is still in 'waiting'
  // status, promote the next connected player to host so the lobby stays
  // functional. If the room is now empty, close it immediately.
  const meta = await RoomService.getMeta(roomId);
  if (meta && meta.status === 'waiting' && meta.createdBy === userId) {
    const nextPlayer = roomManager.getFirstPlayer(roomId);
    if (nextPlayer) {
      // Persist new host in Redis so the authoritative check in start_game passes
      await RoomService.setHost(roomId, nextPlayer.userId);
      io.to(roomId).emit('host_changed', { newHostId: nextPlayer.userId });
      console.log(`[WS] Host reassigned in room ${roomId}: ${userId} → ${nextPlayer.userId}`);
    } else {
      // No one left — close immediately so we don’t leave a ghost room
      await RoomService.closeRoom(roomId, 'manual', io);
      return;
    }
  }

  // If all remaining players are dead, close the room
  const { total, dead } = roomManager.getDeadStats(roomId);
  await RoomService.maybeCloseAllDead(roomId, io, total, dead);
}