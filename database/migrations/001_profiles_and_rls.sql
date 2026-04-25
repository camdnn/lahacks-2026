-- Migration 001: Create profiles table + enable RLS on profiles
-- Run in Supabase SQL Editor BEFORE 002 and 003

CREATE TABLE IF NOT EXISTS public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT,
    username        TEXT,
    coin_balance    INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles only (sessions/child tables are handled in 003 after they are created)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- profiles: users can read and update only their own row
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
