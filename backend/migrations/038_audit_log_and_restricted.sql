-- Migration 038: Audit-Log-Tabelle + Restricted-Flag fuer Betroffenenrechte
-- DSGVO Art. 15-21: Audit-Trail fuer PII-Zugriffe + Verarbeitungseinschraenkung (Art. 18)

-- 1. Audit-Log (append-only)
CREATE TABLE IF NOT EXISTS audit_log (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(32) NOT NULL,          -- READ, WRITE, DELETE, EXPORT, RESTRICT, LOGIN_FAIL, ACCESS_DENIED, RATE_LIMITED
    table_name      VARCHAR(64),
    record_id       INTEGER,
    details         JSONB DEFAULT '{}',
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indizes fuer effiziente Abfragen
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log(action);

-- 2. Restricted-Flag: Verarbeitungseinschraenkung (Art. 18 DSGVO)
ALTER TABLE booking_requests
    ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE ssw_appointments
    ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE bl_appointments
    ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;

-- Kommentar zur Dokumentation
COMMENT ON TABLE audit_log IS 'Append-only Audit-Trail fuer PII-Zugriffe (DSGVO Art. 5 Abs. 2, Rechenschaftspflicht)';
COMMENT ON COLUMN booking_requests.restricted IS 'Art. 18 DSGVO: Verarbeitungseinschraenkung – Daten gespeichert aber nicht verarbeitet';
COMMENT ON COLUMN ssw_appointments.restricted IS 'Art. 18 DSGVO: Verarbeitungseinschraenkung';
COMMENT ON COLUMN bl_appointments.restricted IS 'Art. 18 DSGVO: Verarbeitungseinschraenkung';
