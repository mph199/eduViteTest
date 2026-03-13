-- Migration 024: Add 'ssw' role for Schulsozialarbeit users
-- These users only have access to the Schulsozialarbeit admin area.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'teacher', 'superadmin', 'ssw'));
