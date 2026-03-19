-- Migration 046: DB-Audit Restbefunde (2026-03-19, DB-Analyst Gegenpruefung)
--
-- 1. FORCE RLS auf slots (PII-Tabelle, wurde in Mig 045 vergessen)
-- 2. feedback: RLS deaktivieren (keine PII, keine Policy vorhanden)
-- 3. booking_requests: NOT NULL auf email/class_name entfernen (Anonymisierung setzt NULL)
-- 4. slots in Retention-Cleanup vorbereiten (kein Schema-Change noetig, nur Indizes)
-- 5. Fehlende Indizes

-- 1. FORCE RLS auf slots
ALTER TABLE slots FORCE ROW LEVEL SECURITY;
COMMENT ON TABLE slots IS 'RLS aktiviert + FORCE – Defense-in-Depth (Migration 046)';

-- 2. feedback: RLS deaktivieren (enabled ohne Policy blockiert bei FORCE)
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;
COMMENT ON TABLE feedback IS 'RLS deaktiviert – keine PII, anonymer Freitext (Migration 046)';

-- 3. booking_requests: NOT NULL entfernen fuer Anonymisierung
ALTER TABLE booking_requests ALTER COLUMN email DROP NOT NULL;
ALTER TABLE booking_requests ALTER COLUMN class_name DROP NOT NULL;

-- 4. Indizes fuer Retention-Queries und chronologische Abfragen
CREATE INDEX IF NOT EXISTS idx_consent_receipts_consented_at ON consent_receipts (consented_at);
CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at ON booking_requests (created_at);
