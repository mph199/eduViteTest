-- Migration: Add salutation (Anrede) column to teachers table
-- Allowed: Herr | Frau | Divers

ALTER TABLE teachers
ADD COLUMN IF NOT EXISTS salutation VARCHAR(10);

ALTER TABLE teachers
DROP CONSTRAINT IF EXISTS teachers_salutation_check;

ALTER TABLE teachers
ADD CONSTRAINT teachers_salutation_check
CHECK (
  salutation IS NULL OR
  salutation IN ('Herr', 'Frau', 'Divers')
);

COMMENT ON COLUMN teachers.salutation IS 'Teacher salutation (Anrede): Herr | Frau | Divers';
