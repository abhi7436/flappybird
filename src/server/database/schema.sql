-- ============================================================
-- Flappy Birds Multiplayer - PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- USERS
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username    VARCHAR(32)  NOT NULL UNIQUE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT       NOT NULL,
  avatar      TEXT         DEFAULT NULL,
  high_score  INTEGER      NOT NULL DEFAULT 0,
  is_online   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email    ON users (email);

-- ================================================================
-- FRIENDS
-- ================================================================
CREATE TYPE friend_status AS ENUM ('pending', 'accepted', 'blocked');

CREATE TABLE IF NOT EXISTS friends (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       friend_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (requester_id, receiver_id),
  CHECK (requester_id <> receiver_id)
);

CREATE INDEX idx_friends_requester ON friends (requester_id);
CREATE INDEX idx_friends_receiver  ON friends (receiver_id);

-- ================================================================
-- GAME HISTORY
-- ================================================================
CREATE TABLE IF NOT EXISTS game_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id    VARCHAR(64) NOT NULL,
  score      INTEGER NOT NULL DEFAULT 0,
  rank       INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_game_history_user_id ON game_history (user_id);
CREATE INDEX idx_game_history_room_id ON game_history (room_id);

-- ================================================================
-- ROOM INVITES
-- ================================================================
CREATE TABLE IF NOT EXISTS room_invites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id    VARCHAR(64)  NOT NULL,
  invite_code VARCHAR(16) NOT NULL UNIQUE,
  created_by  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_room_invites_code ON room_invites (invite_code);

-- ================================================================
-- TRIGGER: auto-update updated_at
-- ================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER friends_updated_at
  BEFORE UPDATE ON friends
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
