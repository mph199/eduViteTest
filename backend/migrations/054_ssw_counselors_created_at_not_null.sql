-- 054: Add NOT NULL constraint to ssw_counselors.created_at and bl_counselors.created_at
-- Idempotent: UPDATE is a no-op if no NULLs exist, SET NOT NULL is idempotent.
-- Backfill any NULL values first, then add the constraint.

UPDATE ssw_counselors SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE ssw_counselors ALTER COLUMN created_at SET NOT NULL;

UPDATE bl_counselors SET created_at = NOW() WHERE created_at IS NULL;
ALTER TABLE bl_counselors ALTER COLUMN created_at SET NOT NULL;

-- Rollback:
-- ALTER TABLE ssw_counselors ALTER COLUMN created_at DROP NOT NULL;
-- ALTER TABLE bl_counselors ALTER COLUMN created_at DROP NOT NULL;
