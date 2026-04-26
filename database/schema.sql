CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    coin_balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    session_type VARCHAR(20) NOT NULL DEFAULT 'general',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    focus_duration_mins INTEGER,
    allowed_tabs TEXT[],
    focus_score NUMERIC(5,2),
    coins_earned INTEGER,
    peak_focus_start TIMESTAMPTZ,
    peak_focus_end TIMESTAMPTZ,
    top_distractors JSONB,
    improvement_tips JSONB
);

-- EYE DATA SNAPSHOTS
CREATE TABLE IF NOT EXISTS eye_data (
    eye_data_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    eyelid_openness NUMERIC(4,3),
    blink_rate_per_min NUMERIC(5,2),
    avg_blink_duration_ms INTEGER,
    is_looking_at_screen BOOLEAN,
    head_tilt_degrees NUMERIC(5,2)
);

-- SCREEN DATA SNAPSHOTS
CREATE TABLE IF NOT EXISTS screen_data (
    screen_data_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    typing_speed_wpm NUMERIC(6,2),
    mistype_rate NUMERIC(5,4),
    scroll_velocity NUMERIC(8,2),
    active_tab_url TEXT
);

-- DISCRETE FOCUS EVENTS
CREATE TABLE IF NOT EXISTS focus_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER,
    metadata JSONB
);

-- STREAKS
CREATE TABLE IF NOT EXISTS streaks (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_session_date DATE
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_eye_data_session_id ON eye_data(session_id);
CREATE INDEX IF NOT EXISTS idx_eye_data_recorded_at ON eye_data(recorded_at);
CREATE INDEX IF NOT EXISTS idx_screen_data_session_id ON screen_data(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_events_session ON focus_events(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_events_type ON focus_events(event_type);
CREATE INDEX IF NOT EXISTS idx_focus_events_time ON focus_events(occurred_at);
