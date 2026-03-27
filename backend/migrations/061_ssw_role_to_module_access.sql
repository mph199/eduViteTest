-- Migration 061: SSW-Rolle in user_module_access überführen
--
-- SSW-Berater werden wie BL-Berater behandelt: role=teacher + module_access.
-- Das vereinheitlicht die Benutzerverwaltung und ermöglicht OAuth wie bei Lehrkräften.
--
-- WICHTIG: Vor dem Einspielen DB-Backup erstellen!
BEGIN;

-- 1) Bestehende SSW-Sessions invalidieren (JWT-Claims enthalten noch role=ssw)
UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE role = 'ssw';

-- 2) Bestehende SSW-User migrieren: module_access 'schulsozialarbeit' eintragen
INSERT INTO user_module_access (user_id, module_key)
SELECT id, 'schulsozialarbeit' FROM users WHERE role = 'ssw'
ON CONFLICT DO NOTHING;

-- 3) SSW-User auf 'teacher' umstellen
UPDATE users SET role = 'teacher' WHERE role = 'ssw';

-- 4) Role-Constraint aktualisieren: 'ssw' entfernen
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'teacher', 'superadmin'));

COMMIT;
