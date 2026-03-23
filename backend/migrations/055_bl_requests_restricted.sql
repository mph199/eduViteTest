-- 055: Add restricted flag to bl_requests for DSGVO Art. 18 (Einschraenkung der Verarbeitung)
-- Idempotent: only runs if bl_requests exists (was dropped in migration 027)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bl_requests') THEN
    ALTER TABLE bl_requests ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- Rollback:
-- ALTER TABLE bl_requests DROP COLUMN IF EXISTS restricted;
