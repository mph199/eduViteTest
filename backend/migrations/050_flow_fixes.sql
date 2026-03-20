-- Migration 050: Flow-Modul Nachbesserungen
-- updated_at auf flow_tagung und flow_agenda_punkt
-- restricted-Flag auf PII-Tabellen (Art. 18 DSGVO)

BEGIN;

-- ══ Fehlende updated_at-Spalten ═════════════════════════════════════

ALTER TABLE flow_tagung
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE flow_agenda_punkt
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ══ DSGVO: restricted-Flag auf PII-Tabellen ═════════════════════════

ALTER TABLE flow_aufgabe
    ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE flow_aktivitaet
    ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE flow_bildungsgang_mitglied
    ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE flow_arbeitspaket_mitglied
    ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
