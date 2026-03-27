-- Migration 062: Granulares Modul-Admin-Rechtesystem
--
-- Separate Tabelle für modulspezifische Admin-Rechte.
-- Ermöglicht z.B. einen "EST-Admin" der nur Elternsprechtag verwalten darf,
-- ohne vollen Admin-Zugang zu haben.
--
-- Gültige module_keys: 'elternsprechtag', 'schulsozialarbeit', 'beratungslehrer', 'flow'
-- Validierung im Backend (nicht per DB-Constraint, damit neue Module ohne Migration ergänzbar).
BEGIN;

CREATE TABLE IF NOT EXISTS user_admin_access (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_key  VARCHAR(50) NOT NULL,
  access_level VARCHAR(20) NOT NULL DEFAULT 'full',
  granted_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_user_admin_access_user_id
  ON user_admin_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_admin_access_module_key
  ON user_admin_access(module_key);

COMMIT;
