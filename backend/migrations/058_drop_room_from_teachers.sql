-- Remove room column from teachers table (feature removed from Elternsprechtag)
ALTER TABLE teachers DROP COLUMN IF EXISTS room;
