-- Migration 060: Kalender-Abo-Token für BL- und SSW-Counselors
--
-- Analog zu Migration 056 (teachers.calendar_token_hash) werden Token-Spalten
-- auf den Counselor-Tabellen ergänzt.
BEGIN;

ALTER TABLE bl_counselors
  ADD COLUMN IF NOT EXISTS calendar_token_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS calendar_token_created_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bl_counselors_calendar_token_hash
  ON bl_counselors (calendar_token_hash)
  WHERE calendar_token_hash IS NOT NULL;

ALTER TABLE ssw_counselors
  ADD COLUMN IF NOT EXISTS calendar_token_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS calendar_token_created_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ssw_counselors_calendar_token_hash
  ON ssw_counselors (calendar_token_hash)
  WHERE calendar_token_hash IS NOT NULL;

COMMIT;
