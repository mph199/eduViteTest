-- Migration: Replace system column with available_from / available_until
-- Allows per-teacher time ranges instead of hardcoded dual/vollzeit windows

-- Add new time columns with sensible defaults
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS available_from TIME NOT NULL DEFAULT '16:00';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS available_until TIME NOT NULL DEFAULT '19:00';

-- Drop the old system constraint and column
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_system_check;
ALTER TABLE teachers DROP COLUMN IF EXISTS system;

-- Drop bksb-specific email domain constraint (now accepts any valid email)
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_email_domain_check;

COMMENT ON COLUMN teachers.available_from IS 'Start time for consultation hours (e.g. 16:00)';
COMMENT ON COLUMN teachers.available_until IS 'End time for consultation hours (e.g. 19:00)';
