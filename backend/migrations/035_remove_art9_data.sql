-- Migration 035: Remove Art. 9 data (concern/notes) from SSW/BL appointments
--
-- Decision: No psychosocial data (Art. 9 DSGVO) will be collected going forward.
-- This migration anonymizes all existing concern/notes data and drops the columns.

-- Step 1: Anonymize existing data (idempotent – skips if columns already dropped)
DO $$
BEGIN
  UPDATE ssw_appointments SET concern = NULL, notes = NULL
    WHERE concern IS NOT NULL OR notes IS NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$
BEGIN
  UPDATE bl_appointments SET concern = NULL, notes = NULL
    WHERE concern IS NOT NULL OR notes IS NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- Step 2: Drop the columns
ALTER TABLE ssw_appointments DROP COLUMN IF EXISTS concern;
ALTER TABLE ssw_appointments DROP COLUMN IF EXISTS notes;

ALTER TABLE bl_appointments DROP COLUMN IF EXISTS concern;
ALTER TABLE bl_appointments DROP COLUMN IF EXISTS notes;
