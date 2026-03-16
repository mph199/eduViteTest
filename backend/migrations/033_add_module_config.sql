-- Migration 033: Module-Konfiguration (Superadmin kann Module aktivieren/deaktivieren)
CREATE TABLE IF NOT EXISTS module_config (
  module_id   VARCHAR(64) PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed mit den bekannten Modulen
INSERT INTO module_config (module_id, enabled)
VALUES
  ('elternsprechtag', TRUE),
  ('schulsozialarbeit', TRUE),
  ('beratungslehrer', TRUE)
ON CONFLICT (module_id) DO NOTHING;
