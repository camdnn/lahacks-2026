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

-- Optional: raw eye / screen snapshots (not required by current app)
CREATE TABLE IF NOT EXISTS eye_data (
    eye_data_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id            UUID        NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_sessions_user_id        ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_events_session    ON focus_events(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_events_type       ON focus_events(event_type);
CREATE INDEX IF NOT EXISTS idx_focus_events_time       ON focus_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_eye_data_session        ON eye_data(session_id);
CREATE INDEX IF NOT EXISTS idx_screen_data_session     ON screen_data(session_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enable RLS on all user-data tables (Express uses service key which bypasses RLS)
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks        ENABLE ROW LEVEL SECURITY;

-- Allow users to read/write their own rows via the Supabase anon key (frontend)
CREATE POLICY "profiles: own row" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "sessions: own rows" ON sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "focus_events: own session events" ON focus_events
  FOR ALL USING (
    session_id IN (SELECT session_id FROM sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "streaks: own row" ON streaks
  FOR ALL USING (auth.uid() = user_id);
