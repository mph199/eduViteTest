-- Migration 027: Anonyme Features entfernen
-- Entfernt bl_requests-Tabelle und is_anonymous-Spalte aus bl_appointments

-- 1) bl_requests-Tabelle mit Indizes droppen
DROP TABLE IF EXISTS bl_requests;

-- 2) is_anonymous-Spalte aus bl_appointments entfernen
ALTER TABLE bl_appointments DROP COLUMN IF EXISTS is_anonymous;
