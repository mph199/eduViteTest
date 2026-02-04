-- Danger: Deletes ALL users and resets the ID sequence to 1
-- Run this in Supabase SQL editor (or psql) with appropriate privileges.

BEGIN;

DELETE FROM users;

-- Try common sequence names; adjust if your sequence differs
DO $$
DECLARE
  seq_name text;
BEGIN
  -- Attempt standard name
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'users_id_seq') THEN
    seq_name := 'users_id_seq';
  ELSE
    -- Attempt schema-qualified
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'users_id_seq') THEN
      seq_name := 'public.users_id_seq';
    ELSE
      -- Fallback: discover sequence attached to users.id
      SELECT pg_get_serial_sequence('users','id') INTO seq_name;
    END IF;
  END IF;

  IF seq_name IS NULL THEN
    RAISE NOTICE 'Could not find sequence for users.id, skipping reset';
  ELSE
    EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1', seq_name);
  END IF;
END$$;

COMMIT;
