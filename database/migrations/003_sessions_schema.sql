-- Migration 003: Full schema for a fresh Supabase project
-- Use this instead of database/schema.sql when starting from scratch.
-- profiles + auth.users replace the old users table.
-- Run AFTER 001 and 002.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.sessions (
    session_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_type        VARCHAR(20) NOT NULL DEFAULT 'general',
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMPTZ,
    focus_duration_mins INTEGER,
    allowed_tabs        TEXT[],
    focus_score         NUMERIC(5,2),
    coins_earned        INTEGER,
    peak_focus_start    TIMESTAMPTZ,
    peak_focus_end      TIMESTAMPTZ,
    top_distractors     JSONB,
    improvement_tips    JSONB
);

CREATE TABLE IF NOT EXISTS public.eye_data (
    eye_data_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
    recorded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    eyelid_openness         NUMERIC(4,3),
    blink_rate_per_min      NUMERIC(5,2),
    avg_blink_duration_ms   INTEGER,
    is_looking_at_screen    BOOLEAN,
    head_tilt_degrees       NUMERIC(5,2)
);

CREATE TABLE IF NOT EXISTS public.screen_data (
    screen_data_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
    recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    typing_speed_wpm    NUMERIC(6,2),
    mistype_rate        NUMERIC(5,4),
    scroll_velocity     NUMERIC(8,2),
    active_tab_url      TEXT
);

CREATE TABLE IF NOT EXISTS public.focus_events (
    event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES public.sessions(session_id) ON DELETE CASCADE,
    event_type      VARCHAR(50) NOT NULL,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms     INTEGER,
    metadata        JSONB
);

CREATE TABLE IF NOT EXISTS public.streaks (
    user_id             UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_streak      INTEGER NOT NULL DEFAULT 0,
    longest_streak      INTEGER NOT NULL DEFAULT 0,
    last_session_date   DATE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id       ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_eye_data_session_id    ON public.eye_data(session_id);
CREATE INDEX IF NOT EXISTS idx_eye_data_recorded_at   ON public.eye_data(recorded_at);
CREATE INDEX IF NOT EXISTS idx_screen_data_session_id ON public.screen_data(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_events_session   ON public.focus_events(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_events_type      ON public.focus_events(event_type);
CREATE INDEX IF NOT EXISTS idx_focus_events_occurred  ON public.focus_events(occurred_at);

-- Enable RLS on all tables created in this migration
ALTER TABLE public.sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eye_data     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_data  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks      ENABLE ROW LEVEL SECURITY;

-- sessions: full CRUD scoped to the owning user
CREATE POLICY "sessions_all_own" ON public.sessions
    FOR ALL USING (auth.uid() = user_id);

-- child tables: access only through sessions the user owns
CREATE POLICY "eye_data_own" ON public.eye_data
    FOR ALL USING (
        session_id IN (SELECT session_id FROM public.sessions WHERE user_id = auth.uid())
    );
CREATE POLICY "screen_data_own" ON public.screen_data
    FOR ALL USING (
        session_id IN (SELECT session_id FROM public.sessions WHERE user_id = auth.uid())
    );
CREATE POLICY "focus_events_own" ON public.focus_events
    FOR ALL USING (
        session_id IN (SELECT session_id FROM public.sessions WHERE user_id = auth.uid())
    );

-- streaks: full CRUD scoped to the owning user
CREATE POLICY "streaks_all_own" ON public.streaks
    FOR ALL USING (auth.uid() = user_id);
