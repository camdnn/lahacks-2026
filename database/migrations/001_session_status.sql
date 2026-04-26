-- Migration 001: Add status and ended_reason to sessions
-- Run once against your Supabase/Postgres instance.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS ended_reason VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
