-- Migration: Security hardening
--
-- Addresses Supabase security warnings:
-- - Enable RLS on public tables that should not be directly accessible
-- - Fix SECURITY DEFINER functions with a fixed search_path

-- 1) Enable RLS on feedback (admin-only via backend/service role)
ALTER TABLE IF EXISTS public.feedback ENABLE ROW LEVEL SECURITY;

-- 2) Enable RLS on events (served via backend)
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;

-- Note:
-- We intentionally do NOT add permissive RLS policies here.
-- This keeps the tables inaccessible to anon/authenticated clients by default.
-- The backend should use the Supabase service role key for DB access.

-- 3) Fix RPC functions: set a fixed search_path to avoid role-mutable search_path warnings
CREATE OR REPLACE FUNCTION public.reset_teacher_sequence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  EXECUTE 'ALTER SEQUENCE IF EXISTS public.teachers_id_seq RESTART WITH 1';
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_slot_sequence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  EXECUTE 'ALTER SEQUENCE IF EXISTS public.slots_id_seq RESTART WITH 1';
END;
$$;
