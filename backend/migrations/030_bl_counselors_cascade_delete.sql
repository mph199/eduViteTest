-- Migration 030: bl_counselors.user_id ON DELETE SET NULL → ON DELETE CASCADE
-- Prevents ghost counselor profiles when the linked user is deleted.
-- Also cleans up any remaining orphaned bl_counselors entries.

BEGIN;

-- 1) Clean up existing ghosts (same as migration 029, in case new ones appeared)
DELETE FROM bl_counselors WHERE user_id IS NULL;

-- 2) Replace the FK constraint: SET NULL → CASCADE
ALTER TABLE bl_counselors
  DROP CONSTRAINT IF EXISTS bl_counselors_user_id_fkey;

ALTER TABLE bl_counselors
  ADD CONSTRAINT bl_counselors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMIT;
