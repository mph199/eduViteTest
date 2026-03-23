-- 055: Add restricted flag to bl_requests for DSGVO Art. 18 (Einschraenkung der Verarbeitung)
-- Idempotent: ADD COLUMN IF NOT EXISTS

ALTER TABLE bl_requests ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;

-- Rollback:
-- ALTER TABLE bl_requests DROP COLUMN IF EXISTS restricted;
