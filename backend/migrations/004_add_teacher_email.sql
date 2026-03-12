-- Migration: Add email column to teachers table
-- Requirement: teacher email must end with @bksb.nrw

ALTER TABLE teachers
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Recreate constraint to ensure correct regex (and to recover from older/broken versions)
ALTER TABLE teachers
DROP CONSTRAINT IF EXISTS teachers_email_domain_check;

ALTER TABLE teachers
ADD CONSTRAINT teachers_email_domain_check
CHECK (
  email IS NULL OR
  email ~* '^[A-Z0-9._%+-]+@bksb\.nrw$'
);

COMMENT ON COLUMN teachers.email IS 'Teacher email address (must end with @bksb.nrw)';
