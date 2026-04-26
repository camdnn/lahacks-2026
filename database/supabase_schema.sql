-- ============================================================
-- Bloom — Supabase schema
-- Run this once in the Supabase SQL editor:
--   supabase.com → your project → SQL Editor → New query → paste → Run
-- ============================================================

-- User profiles (mirrors auth.users; auto-populated by trigger below)
CREATE TABLE IF NOT EXISTS profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email        TEXT,
    username     TEXT,
    coin_balance INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create a profile row whenever a new Supabase auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'username'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Focus sessions
CREATE TABLE IF NOT EXISTS sessions (
    session_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_type        VARCHAR(20)  NOT NULL DEFAULT 'general',
    started_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMPTZ,
    focus_duration_mins INTEGER,
    allowed_tabs        TEXT[],
    focus_score         NUMERIC(5,2),
    coins_earned        INTEGER,
    top_distractors     JSONB,
    improvement_tips    JSONB
);

-- Discrete distraction / focus events logged per session
CREATE TABLE IF NOT EXISTS focus_events (
    event_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER,
    metadata    JSONB
);

-- Daily streaks
CREATE TABLE IF NOT EXISTS streaks (
    user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak    INTEGER NOT NULL DEFAULT 0,
    longest_streak    INTEGER NOT NULL DEFAULT 0,
    last_session_date DATE
);

-- Periodic eye / head-pose snapshots (one row per 30s during a session)
CREATE TABLE IF NOT EXISTS eye_data (
    eye_data_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id            UUID        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    eyelid_openness       NUMERIC(4,3),
    blink_rate_per_min    NUMERIC(5,2),
    avg_blink_duration_ms INTEGER,
    is_looking_at_screen  BOOLEAN,
    head_tilt_degrees     NUMERIC(5,2)
);

CREATE TABLE IF NOT EXISTS screen_data (
    screen_data_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    typing_speed_wpm NUMERIC(6,2),
    mistype_rate     NUMERIC(5,4),
    scroll_velocity  NUMERIC(8,2),
    active_tab_url   TEXT
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_user_id          ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_started     ON sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_focus_events_session      ON focus_events(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_events_user_time    ON focus_events(user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_focus_events_type         ON focus_events(event_type);
CREATE INDEX IF NOT EXISTS idx_eye_data_session          ON eye_data(session_id);
CREATE INDEX IF NOT EXISTS idx_eye_data_user_time        ON eye_data(user_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_screen_data_session       ON screen_data(session_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Express uses the service role key which bypasses RLS entirely.
-- RLS here protects direct frontend queries (anon key).
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE eye_data      ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own row" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "sessions: own rows" ON sessions
  FOR ALL USING (auth.uid() = user_id);

-- Direct user_id check — no subquery needed now that user_id is on the table
CREATE POLICY "focus_events: own rows" ON focus_events
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "eye_data: own rows" ON eye_data
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "streaks: own row" ON streaks
  FOR ALL USING (auth.uid() = user_id);

-- ── Analytics views ───────────────────────────────────────────────────────────
-- Daily session roll-up: total focus time, avg score, coins earned per day
CREATE OR REPLACE VIEW daily_stats AS
SELECT
    user_id,
    date_trunc('day', started_at)::date      AS day,
    COUNT(*)                                  AS sessions_count,
    COALESCE(SUM(focus_duration_mins), 0)     AS total_focus_mins,
    ROUND(AVG(focus_score)::numeric, 1)       AS avg_focus_score,
    COALESCE(SUM(coins_earned), 0)            AS coins_earned
FROM sessions
WHERE ended_at IS NOT NULL
GROUP BY user_id, date_trunc('day', started_at);

-- Event breakdown by type per user per day
CREATE OR REPLACE VIEW daily_event_counts AS
SELECT
    user_id,
    date_trunc('day', occurred_at)::date  AS day,
    event_type,
    COUNT(*)                               AS count
FROM focus_events
GROUP BY user_id, date_trunc('day', occurred_at), event_type;
