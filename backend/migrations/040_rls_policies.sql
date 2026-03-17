-- Migration 040: Row-Level Security (RLS) auf sensiblen Tabellen
-- Bezug: dsgvo-saas-todo 1.2.5, TOM-005
--
-- HINWEIS: RLS wird nur wirksam fuer DB-Rollen die NICHT superuser/table-owner sind.
-- Da die Applikation ueber einen einzigen Pool-User zugreift, dient diese Migration
-- primaer der Defense-in-Depth-Strategie und bereitet Multi-Tenancy vor.
-- Die eigentliche Zugriffsbeschraenkung erfolgt weiterhin ueber die Express-Middleware.

-- 1. RLS aktivieren
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssw_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 2. Default-Policy: Applikations-User darf alles (single-pool-user Architektur)
-- Beim Wechsel zu Multi-Tenancy werden diese durch tenant_id-basierte Policies ersetzt.
DO $$
BEGIN
  -- users
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'app_full_access_users') THEN
    EXECUTE 'CREATE POLICY app_full_access_users ON users FOR ALL USING (true) WITH CHECK (true)';
  END IF;

  -- ssw_appointments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ssw_appointments' AND policyname = 'app_full_access_ssw') THEN
    EXECUTE 'CREATE POLICY app_full_access_ssw ON ssw_appointments FOR ALL USING (true) WITH CHECK (true)';
  END IF;

  -- bl_appointments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bl_appointments' AND policyname = 'app_full_access_bl') THEN
    EXECUTE 'CREATE POLICY app_full_access_bl ON bl_appointments FOR ALL USING (true) WITH CHECK (true)';
  END IF;

  -- audit_log: voller Zugriff fuer Pool-User (append-only Enforcement via App-Layer)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'app_full_access_audit') THEN
    EXECUTE 'CREATE POLICY app_full_access_audit ON audit_log FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

COMMENT ON TABLE users IS 'RLS aktiviert – Defense-in-Depth (Migration 040)';
COMMENT ON TABLE ssw_appointments IS 'RLS aktiviert – Defense-in-Depth (Migration 040)';
COMMENT ON TABLE bl_appointments IS 'RLS aktiviert – Defense-in-Depth (Migration 040)';
