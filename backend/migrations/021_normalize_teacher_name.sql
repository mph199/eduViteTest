-- Migration 021: Normalize teacher name into first_name + last_name
-- Splits the existing `name` column into two proper columns.
-- Keeps `name` as a generated column for backward compatibility with SELECT *.

-- 1. Add new columns
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS first_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS last_name  VARCHAR(255) NOT NULL DEFAULT '';

-- 2. Populate from existing `name` data
--    Handles "Vorname Nachname" and "Nachname, Vorname" formats.
--    Strips leading salutations (Herr/Frau/Divers).
UPDATE teachers SET
  first_name = CASE
    WHEN POSITION(',' IN name) > 0 THEN
      TRIM(SUBSTRING(
        REGEXP_REPLACE(name, '^\s*(Herr|Frau|Divers)\s+', '', 'i')
        FROM POSITION(',' IN REGEXP_REPLACE(name, '^\s*(Herr|Frau|Divers)\s+', '', 'i')) + 1
      ))
    WHEN ARRAY_LENGTH(STRING_TO_ARRAY(TRIM(REGEXP_REPLACE(name, '^\s*(Herr|Frau|Divers)\s+', '', 'i')), ' '), 1) > 1 THEN
      ARRAY_TO_STRING(
        (STRING_TO_ARRAY(TRIM(REGEXP_REPLACE(name, '^\s*(Herr|Frau|Divers)\s+', '', 'i')), ' '))[1:ARRAY_LENGTH(STRING_TO_ARRAY(TRIM(REGEXP_REPLACE(name, '^\s*(Herr|Frau|Divers)\s+', '', 'i')), ' '), 1) - 1],
        ' '
      )
    ELSE ''
  END,
  last_name = CASE
    WHEN POSITION(',' IN name) > 0 THEN
      TRIM(SUBSTRING(
        REGEXP_REPLACE(name, '^\s*(Herr|Frau|Divers)\s+', '', 'i')
        FROM 1 FOR POSITION(',' IN REGEXP_REPLACE(name, '^\s*(Herr|Frau|Divers)\s+', '', 'i')) - 1
      ))
    WHEN ARRAY_LENGTH(STRING_TO_ARRAY(TRIM(REGEXP_REPLACE(name, '^\s*(Herr|Frau|Divers)\s+', '', 'i')), ' '), 1) > 1 THEN
      (STRING_TO_ARRAY(TRIM(REGEXP_REPLACE(name, '^\s*(Herr|Frau|Divers)\s+', '', 'i')), ' '))[ARRAY_LENGTH(STRING_TO_ARRAY(TRIM(REGEXP_REPLACE(name, '^\s*(Herr|Frau|Divers)\s+', '', 'i')), ' '), 1)]
    ELSE TRIM(REGEXP_REPLACE(name, '^\s*(Herr|Frau|Divers)\s+', '', 'i'))
  END;

-- 3. Drop the old `name` column and recreate it as generated
ALTER TABLE teachers DROP COLUMN IF EXISTS name;
ALTER TABLE teachers ADD COLUMN name VARCHAR(511)
  GENERATED ALWAYS AS (TRIM(first_name || ' ' || last_name)) STORED;

COMMENT ON COLUMN teachers.first_name IS 'Vorname der Lehrkraft';
COMMENT ON COLUMN teachers.last_name  IS 'Nachname der Lehrkraft';
COMMENT ON COLUMN teachers.name       IS 'Generiert: first_name + last_name (Abwärtskompatibilität)';
