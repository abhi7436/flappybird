-- ============================================================
-- Migration 002: Advanced Game Features
-- Adds: ELO ratings, skins, tournaments, replays, analytics
-- ============================================================

-- ================================================================
-- ELO + extended user stats
-- ================================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS elo_rating   INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS games_played INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_elo ON users (elo_rating DESC);

-- ================================================================
-- SKINS
-- ================================================================
CREATE TABLE IF NOT EXISTS skins (
  id                VARCHAR(48)  PRIMARY KEY,
  name              VARCHAR(64)  NOT NULL,
  description       TEXT,
  season            VARCHAR(16)  DEFAULT NULL,  -- spring|summer|autumn|winter
  rarity            VARCHAR(16)  NOT NULL DEFAULT 'common',   -- common|rare|epic|legendary
  unlock_condition  VARCHAR(256) DEFAULT NULL,  -- human-readable hint
  color_body        VARCHAR(8)   NOT NULL DEFAULT '#FFD700',
  color_wing        VARCHAR(8)   NOT NULL DEFAULT '#FFA500',
  color_eye         VARCHAR(8)   NOT NULL DEFAULT '#FFFFFF',
  color_beak        VARCHAR(8)   NOT NULL DEFAULT '#FF8C00',
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  min_elo           INTEGER      NOT NULL DEFAULT 0,     -- ELO gate (0 = no gate)
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO skins (id, name, description, season, rarity, color_body, color_wing, color_eye, color_beak) VALUES
  ('classic',      'Classic',       'The original yellow bird',          NULL,     'common',    '#FFD700', '#FFA500', '#FFFFFF', '#FF8C00'),
  ('spring',       'Spring Blossom','Pink blooms for spring',            'spring',  'rare',     '#FFB6C1', '#FF69B4', '#FFFFFF', '#FF4500'),
  ('summer',       'Beach Bird',    'Cool shades for summer heat',       'summer',  'rare',     '#00CED1', '#20B2AA', '#FFFFFF', '#FF6347'),
  ('autumn',       'Harvest',       'Warm amber autumn plumage',         'autumn',  'rare',     '#D2691E', '#A0522D', '#FFFFFF', '#8B4513'),
  ('winter',       'Frosty',        'Icy blue winter feathers',          'winter',  'rare',     '#B0E0E6', '#87CEEB', '#FFFFFF', '#4169E1'),
  ('champion',     'Champion',      'Gold champion bird — top 1%',       NULL,     'legendary', '#FFD700', '#DAA520', '#FF0000', '#B8860B'),
  ('neon',         'Neon',          'Electric neon glow — rare find',    NULL,     'epic',      '#39FF14', '#00FF7F', '#FFFFFF', '#FF1493'),
  ('midnight',     'Midnight',      'Dark mysterious midnight bird',     NULL,     'epic',      '#191970', '#000080', '#AAAAFF', '#4169E1')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_skins (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skin_id      VARCHAR(48) NOT NULL REFERENCES skins(id),
  unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_equipped  BOOLEAN     NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, skin_id)
);

CREATE INDEX IF NOT EXISTS idx_user_skins_user ON user_skins (user_id);

-- Grant classic skin to all existing users
INSERT INTO user_skins (user_id, skin_id, is_equipped)
  SELECT id, 'classic', TRUE FROM users
ON CONFLICT (user_id, skin_id) DO NOTHING;

-- ================================================================
-- TOURNAMENTS
-- ================================================================
DO $$ BEGIN
  CREATE TYPE tournament_status AS ENUM ('registration', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bracket_type AS ENUM ('single_elimination', 'round_robin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tournaments (
  id               UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(128)       NOT NULL,
  description      TEXT,
  status           tournament_status  NOT NULL DEFAULT 'registration',
  bracket_type     bracket_type       NOT NULL DEFAULT 'single_elimination',
  max_participants INTEGER            NOT NULL DEFAULT 16,
  rounds_total     INTEGER            NOT NULL DEFAULT 4,
  current_round    INTEGER            NOT NULL DEFAULT 0,
  prize_info       TEXT               DEFAULT NULL,
  created_by       UUID               NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  starts_at        TIMESTAMPTZ        NOT NULL,
  ended_at         TIMESTAMPTZ        DEFAULT NULL,
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status    ON tournaments (status);
CREATE INDEX IF NOT EXISTS idx_tournaments_starts_at ON tournaments (starts_at);

CREATE TABLE IF NOT EXISTS tournament_participants (
  id                UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id     UUID  NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id           UUID  NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  elo_at_entry      INTEGER NOT NULL DEFAULT 1000,
  seed              INTEGER DEFAULT NULL,
  eliminated_round  INTEGER DEFAULT NULL,
  final_placement   INTEGER DEFAULT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants (tournament_id);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id  UUID        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number   INTEGER     NOT NULL,
  match_number   INTEGER     NOT NULL,
  room_id        VARCHAR(64) DEFAULT NULL,
  player1_id     UUID        REFERENCES users(id),
  player2_id     UUID        REFERENCES users(id),
  winner_id      UUID        REFERENCES users(id),
  player1_score  INTEGER     DEFAULT NULL,
  player2_score  INTEGER     DEFAULT NULL,
  status         VARCHAR(16) NOT NULL DEFAULT 'pending',  -- pending|active|completed|bye
  scheduled_at   TIMESTAMPTZ DEFAULT NULL,
  completed_at   TIMESTAMPTZ DEFAULT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches (tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_room       ON tournament_matches (room_id);

-- ================================================================
-- REPLAYS
-- ================================================================
CREATE TABLE IF NOT EXISTS replays (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id         VARCHAR(64) NOT NULL,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  final_score     INTEGER     NOT NULL,
  final_rank      INTEGER     DEFAULT NULL,
  duration_ms     INTEGER     NOT NULL,
  seed            BIGINT      NOT NULL,
  events          JSONB       NOT NULL DEFAULT '[]',
  canvas_width    INTEGER     NOT NULL DEFAULT 400,
  canvas_height   INTEGER     NOT NULL DEFAULT 600,
  engine_version  VARCHAR(8)  NOT NULL DEFAULT '2',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replays_user_id   ON replays (user_id);
CREATE INDEX IF NOT EXISTS idx_replays_room_id   ON replays (room_id);
CREATE INDEX IF NOT EXISTS idx_replays_score     ON replays (final_score DESC);

-- ================================================================
-- EXTENDED GAME HISTORY
-- ================================================================
ALTER TABLE game_history
  ADD COLUMN IF NOT EXISTS duration_ms         INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS elo_before          INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS elo_after           INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS elo_change          INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS powerups_collected  JSONB   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_players       INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tournament_match_id UUID    REFERENCES tournament_matches(id);

-- ================================================================
-- NOTIFICATION DEVICE TOKENS
-- ================================================================
CREATE TABLE IF NOT EXISTS device_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL,
  platform    VARCHAR(8)  NOT NULL DEFAULT 'expo',    -- expo|apns|fcm
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens (user_id);

-- ================================================================
-- TRIGGERS
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_tournaments'
  ) THEN
    CREATE TRIGGER set_updated_at_tournaments
    BEFORE UPDATE ON tournaments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
