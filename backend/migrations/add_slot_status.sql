-- Migration: Add status column to slots for reserved/confirmed workflow

ALTER TABLE slots 
ADD COLUMN IF NOT EXISTS status VARCHAR(20);

DO $$ BEGIN
  ALTER TABLE slots ADD CONSTRAINT check_slot_status
  CHECK (status IS NULL OR status IN ('reserved','confirmed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Optional: backfill existing booked=true to confirmed
UPDATE slots SET status = 'confirmed' WHERE booked = true AND status IS NULL;