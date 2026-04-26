-- Drop everything and start fresh.
-- Run in Supabase SQL editor BEFORE running supabase_schema.sql.

DROP VIEW  IF EXISTS daily_event_counts;
DROP VIEW  IF EXISTS daily_stats;

DROP TABLE IF EXISTS screen_data   CASCADE;
DROP TABLE IF EXISTS eye_data      CASCADE;
DROP TABLE IF EXISTS focus_events  CASCADE;
DROP TABLE IF EXISTS streaks       CASCADE;
DROP TABLE IF EXISTS sessions      CASCADE;
DROP TABLE IF EXISTS profiles      CASCADE;

DROP TRIGGER   IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION  IF EXISTS handle_new_user();
