-- Migration 028: Generisches Multi-Rollen-System
-- Neue Tabelle user_module_access fuer zusaetzliche Modul-Berechtigungen
-- Ermoeglicht z.B. Lehrkraeften den Zugang zum Beratungslehrer-Modul

-- 1) Tabelle fuer Modul-Berechtigungen
CREATE TABLE IF NOT EXISTS user_module_access (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_key VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_uma_user_id ON user_module_access(user_id);
CREATE INDEX IF NOT EXISTS idx_uma_module_key ON user_module_access(module_key);

-- 2) Bestehende beratungslehrer-User migrieren
-- Modul-Zugang eintragen
INSERT INTO user_module_access (user_id, module_key)
SELECT id, 'beratungslehrer' FROM users WHERE role = 'beratungslehrer'
ON CONFLICT DO NOTHING;

-- User mit teacher_id: Rolle auf 'teacher' setzen (behalten Teacher-Funktionalitaet)
UPDATE users SET role = 'teacher' WHERE role = 'beratungslehrer' AND teacher_id IS NOT NULL;

-- 3) Role-Constraint aktualisieren: 'beratungslehrer' als Rolle entfernen
DO $$
DECLARE
  _cname TEXT;
BEGIN
  FOR _cname IN
    SELECT con.conname FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'users' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', _cname);
  END LOOP;
END $$;

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'teacher', 'superadmin', 'ssw'));
