-- Migration 059: Datenschutz-Minimierung BL/SSW
--
-- Entfernt topic_id, category_id, is_urgent aus Appointment-Tabellen.
-- Spaltet student_name in first_name + last_name auf.
-- HINWEIS: concern, notes (Migration 035) und is_anonymous (Migration 027) wurden bereits entfernt.
BEGIN;

-- BL: Verbleibende sensible Spalten entfernen
ALTER TABLE bl_appointments
  DROP COLUMN IF EXISTS topic_id,
  DROP COLUMN IF EXISTS is_urgent;

-- SSW: Verbleibende sensible Spalten entfernen
ALTER TABLE ssw_appointments
  DROP COLUMN IF EXISTS category_id,
  DROP COLUMN IF EXISTS is_urgent;

-- BL: student_name aufteilen in first_name + last_name
ALTER TABLE bl_appointments
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

UPDATE bl_appointments
  SET first_name = split_part(student_name, ' ', 1),
      last_name  = CASE
        WHEN position(' ' IN student_name) > 0
        THEN substring(student_name FROM position(' ' IN student_name) + 1)
        ELSE ''
      END
  WHERE student_name IS NOT NULL AND first_name IS NULL;

ALTER TABLE bl_appointments DROP COLUMN IF EXISTS student_name;

-- SSW: student_name aufteilen in first_name + last_name
ALTER TABLE ssw_appointments
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);

UPDATE ssw_appointments
  SET first_name = split_part(student_name, ' ', 1),
      last_name  = CASE
        WHEN position(' ' IN student_name) > 0
        THEN substring(student_name FROM position(' ' IN student_name) + 1)
        ELSE ''
      END
  WHERE student_name IS NOT NULL AND first_name IS NULL;

ALTER TABLE ssw_appointments DROP COLUMN IF EXISTS student_name;

-- Referenz-Tabellen deaktivieren (nicht droppen wegen bl_requests FK)
UPDATE bl_topics SET active = FALSE;
UPDATE ssw_categories SET active = FALSE;

COMMIT;
