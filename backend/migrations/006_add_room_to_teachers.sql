-- Migration: Add room field to teachers table

-- Add room column
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS room VARCHAR(100);

COMMENT ON COLUMN teachers.room IS 'Room number or location for teacher consultations';

-- Update existing teachers with example rooms (optional)
-- You can remove or modify these updates based on your needs
UPDATE teachers SET room = 'Raum 101' WHERE id = 1 AND room IS NULL;
UPDATE teachers SET room = 'Raum 102' WHERE id = 2 AND room IS NULL;
UPDATE teachers SET room = 'Raum 103' WHERE id = 3 AND room IS NULL;
UPDATE teachers SET room = 'Raum 104' WHERE id = 4 AND room IS NULL;
UPDATE teachers SET room = 'Raum 105' WHERE id = 5 AND room IS NULL;
