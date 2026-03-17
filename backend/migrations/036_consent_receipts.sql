-- Migration 036: Consent Receipts (DSGVO Art. 7 Abs. 1 – Nachweispflicht)
--
-- Append-only table. Records are never updated or deleted.
-- Each booking creates exactly one consent receipt.

CREATE TABLE IF NOT EXISTS consent_receipts (
  id              SERIAL PRIMARY KEY,
  module          VARCHAR(50) NOT NULL,           -- 'elternsprechtag', 'schulsozialarbeit', 'beratungslehrer'
  appointment_id  INTEGER,                        -- FK loose (cross-table)
  consent_version VARCHAR(20) NOT NULL,           -- e.g. 'ssw-v1', 'est-v1'
  consent_purpose TEXT NOT NULL,                  -- Verarbeitungszweck (kurz)
  ip_address      VARCHAR(45),                    -- IPv4/IPv6
  user_agent      TEXT,
  consented_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookup by module + appointment
CREATE INDEX IF NOT EXISTS idx_consent_receipts_module_appt
  ON consent_receipts (module, appointment_id);
