-- SQL Script to reset ID sequences for teachers and slots tables
-- Execute this in Supabase SQL Editor

-- Reset teachers sequence
ALTER SEQUENCE teachers_id_seq RESTART WITH 1;

-- Reset slots sequence  
ALTER SEQUENCE slots_id_seq RESTART WITH 1;

-- Create RPC functions for future resets (optional)
CREATE OR REPLACE FUNCTION reset_teacher_sequence()
RETURNS void AS $$
BEGIN
  EXECUTE 'ALTER SEQUENCE IF EXISTS public.teachers_id_seq RESTART WITH 1';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION reset_slot_sequence()
RETURNS void AS $$
BEGIN
  EXECUTE 'ALTER SEQUENCE IF EXISTS public.slots_id_seq RESTART WITH 1';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;
