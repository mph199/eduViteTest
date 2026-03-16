-- Migration 031: ssw_counselors.user_id ON DELETE SET NULL → ON DELETE CASCADE
-- Prevents ghost counselor profiles when the linked user is deleted.
-- Mirrors migration 030 which fixed the same issue for bl_counselors.

BEGIN;

-- 1) Clean up existing ghosts (ssw_counselors without linked user)
DELETE FROM ssw_counselors WHERE user_id IS NULL;

-- 2) Replace the FK constraint: SET NULL → CASCADE
ALTER TABLE ssw_counselors
  DROP CONSTRAINT IF EXISTS ssw_counselors_user_id_fkey;

ALTER TABLE ssw_counselors
  ADD CONSTRAINT ssw_counselors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

COMMIT;
