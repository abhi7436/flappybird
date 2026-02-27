# Multiplayer Flappy Bird

Production-ready multiplayer Flappy Bird supporting up to **50 concurrent players per room**, real-time leaderboards, user accounts, and a friend system — playable on **Web (React)** and **Mobile (React Native)**.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Clients                          │
│  React (Web / Canvas)   React Native (Skia/Reanimated)│
│           │                        │                 │
│        REST API              WebSocket (Socket.IO)   │
└──────────────────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │         Node.js Server        │
         │  Express REST + Socket.IO WS  │
         │  RoomManager  AntiCheat       │
         └───────────┬───────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
     PostgreSQL               Redis
   (persistent storage)  (leaderboard cache
                          + pub/sub for
                          horizontal scaling)
```

## Folder Structure

```
src/
├── game-engine/          # Shared physics engine (Web + Mobile)
│   ├── Bird.ts
│   ├── Pipe.ts
│   ├── GameEngine.ts     # Game loop, difficulty scaling, scoring
│   ├── Collision.ts
│   ├── Physics.ts
│   └── tests/
└── server/
    ├── index.ts          # Entry point
    ├── RoomManager.ts    # In-memory room state
    ├── WebSocketServer.ts# Socket.IO + anti-cheat + pub/sub
    ├── database/
    │   ├── schema.sql    # PostgreSQL schema
    │   ├── connection.ts # pg Pool
    │   └── redisClient.ts
    ├── middleware/
    │   ├── authMiddleware.ts  # JWT sign/verify + Express guard
    │   └── rateLimiter.ts
    ├── repositories/
    │   ├── UserRepository.ts
    │   ├── FriendRepository.ts
    │   ├── GameHistoryRepository.ts
    │   └── InviteRepository.ts
    ├── routes/
    │   ├── authRoutes.ts    # POST /api/auth/register|login|logout
    │   ├── profileRoutes.ts # GET /api/profile/me, /:username
    │   ├── friendRoutes.ts  # CRUD /api/friends
    │   └── inviteRoutes.ts  # POST/GET /api/invites
    ├── services/
    │   ├── LeaderboardService.ts  # Redis sorted set
    │   └── AntiCheatService.ts
    └── types/
        └── index.ts
```

## WebSocket Event Contract

### Client → Server

| Event          | Payload                              |
|----------------|--------------------------------------|
| `join_room`    | `{ roomId }`                         |
| `leave_room`   | `{ roomId }`                         |
| `score_update` | `{ roomId, score }`                  |
| `game_over`    | `{ roomId, finalScore }`             |
| `start_game`   | `{ roomId }`                         |

### Server → Client

| Event               | Payload                                    |
|---------------------|--------------------------------------------|
| `room_joined`       | `{ roomId, playerId }`                     |
| `player_joined`     | `{ playerId, username }`                   |
| `player_left`       | `{ playerId }`                             |
| `leaderboard_update`| `{ leaderboard: LeaderboardEntry[] }`      |
| `game_started`      | `{ startedAt }`                            |
| `error`             | `{ message }`                              |

## REST API Reference

### Auth
| Method | Path                     | Auth | Description        |
|--------|--------------------------|------|--------------------|
| POST   | `/api/auth/register`     | No   | Create account     |
| POST   | `/api/auth/login`        | No   | Get JWT token      |
| POST   | `/api/auth/logout`       | No   | Clear online flag  |

### Profile
| Method | Path                       | Auth | Description            |
|--------|----------------------------|------|------------------------|
| GET    | `/api/profile/me`          | Yes  | Own full profile       |
| PATCH  | `/api/profile/avatar`      | Yes  | Update avatar URL      |
| GET    | `/api/profile/:username`   | No   | Public profile + games |
| GET    | `/api/profile/me/history`  | Yes  | Game history           |

### Friends
| Method | Path                      | Auth | Description              |
|--------|---------------------------|------|--------------------------|
| POST   | `/api/friends/request`    | Yes  | Send friend request      |
| POST   | `/api/friends/accept`     | Yes  | Accept pending request   |
| DELETE | `/api/friends/:userId`    | Yes  | Remove / reject friend   |
| POST   | `/api/friends/block`      | Yes  | Block a user             |
| GET    | `/api/friends`            | Yes  | List friends + online    |
| GET    | `/api/friends/pending`    | Yes  | Pending incoming requests|

### Invites
| Method | Path                       | Auth | Description              |
|--------|----------------------------|------|--------------------------|
| POST   | `/api/invites/:roomId`     | Yes  | Generate invite link     |
| GET    | `/api/invites/:code/resolve` | No | Resolve code → roomId   |

## Database Schema

See [src/server/database/schema.sql](src/server/database/schema.sql) for the full PostgreSQL schema.

**Tables:** `users`, `friends`, `game_history`, `room_invites`

## Redis Schema

| Key Pattern                        | Type        | Purpose                    |
|------------------------------------|-------------|----------------------------|
| `room:{roomId}:leaderboard`        | Sorted Set  | userId → score ranking     |
| `room:{roomId}:player:{userId}`    | Hash        | username, alive, score     |
| `leaderboard:{roomId}` (pub/sub)   | Channel     | Cross-instance broadcast   |

## Difficulty Scaling

| Score Range | Tier | Pipe Speed | Gap Height | Gravity | Oscillating |
|-------------|------|------------|------------|---------|-------------|
| 0–24        | 0    | 3          | 150        | 0.45    | No          |
| 25–34       | 1    | +20%       | -15%       | +0.05   | Yes         |
| 35–44       | 2    | +40%       | -30%       | +0.10   | Yes         |
| 45+         | 3+   | +20%/tier  | -15%/tier  | +0.05/t | Yes         |

## Quick Start

```bash
# 1. Copy env
cp .env.example .env

# 2. Start all services
docker compose up -d

# 3. Development (without Docker)
npm install
npm run db:migrate   # requires local Postgres + Redis
npm run dev
```

## Testing

```bash
npm test            # run all unit tests
npm test -- --coverage
```
