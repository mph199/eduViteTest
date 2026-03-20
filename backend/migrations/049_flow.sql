-- Migration 049: Flow-Modul
-- Kollaborationsformat fuer Bildungsgaenge

BEGIN;

-- ══ Bildungsgang ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flow_bildungsgang (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    erlaubt_mitgliedern_paket_erstellung BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_bildungsgang_mitglied (
    id SERIAL PRIMARY KEY,
    bildungsgang_id INTEGER NOT NULL REFERENCES flow_bildungsgang(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rolle VARCHAR(20) NOT NULL CHECK (rolle IN ('leitung', 'mitglied')),
    hinzugefuegt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(bildungsgang_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_flow_bg_mitglied_bg ON flow_bildungsgang_mitglied(bildungsgang_id);
CREATE INDEX IF NOT EXISTS idx_flow_bg_mitglied_user ON flow_bildungsgang_mitglied(user_id);

-- ══ Abteilungsleitung ═════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flow_abteilungsleitung (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_flow_abteilungsleitung_user ON flow_abteilungsleitung(user_id);

-- ══ Arbeitspaket ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flow_arbeitspaket (
    id SERIAL PRIMARY KEY,
    bildungsgang_id INTEGER NOT NULL REFERENCES flow_bildungsgang(id) ON DELETE CASCADE,
    titel VARCHAR(500) NOT NULL,
    ist_zustand TEXT NOT NULL,
    soll_zustand TEXT NOT NULL,
    beteiligte_beschreibung TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'entwurf'
        CHECK (status IN ('entwurf', 'geplant', 'aktiv', 'abgeschlossen')),
    deadline TIMESTAMPTZ,
    geplante_tagungen INTEGER,
    abgeschlossen_at TIMESTAMPTZ,
    abgeschlossen_von INTEGER REFERENCES users(id) ON DELETE SET NULL,
    abschluss_zusammenfassung TEXT,
    reflexion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_ap_bildungsgang ON flow_arbeitspaket(bildungsgang_id);
CREATE INDEX IF NOT EXISTS idx_flow_ap_status ON flow_arbeitspaket(status);
CREATE INDEX IF NOT EXISTS idx_flow_ap_deadline ON flow_arbeitspaket(deadline);

CREATE TABLE IF NOT EXISTS flow_arbeitspaket_mitglied (
    id SERIAL PRIMARY KEY,
    arbeitspaket_id INTEGER NOT NULL REFERENCES flow_arbeitspaket(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rolle VARCHAR(20) NOT NULL CHECK (rolle IN ('koordination', 'mitwirkende', 'lesezugriff')),
    hinzugefuegt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(arbeitspaket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_flow_ap_mitglied_ap ON flow_arbeitspaket_mitglied(arbeitspaket_id);
CREATE INDEX IF NOT EXISTS idx_flow_ap_mitglied_user ON flow_arbeitspaket_mitglied(user_id);

-- ══ Tagung (vor Aufgabe wegen FK-Referenz) ════════════════════════════

CREATE TABLE IF NOT EXISTS flow_tagung (
    id SERIAL PRIMARY KEY,
    arbeitspaket_id INTEGER NOT NULL REFERENCES flow_arbeitspaket(id) ON DELETE CASCADE,
    titel VARCHAR(500) NOT NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ,
    raum VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_tagung_ap ON flow_tagung(arbeitspaket_id);
CREATE INDEX IF NOT EXISTS idx_flow_tagung_start ON flow_tagung(start_at);

CREATE TABLE IF NOT EXISTS flow_tagung_teilnehmer (
    tagung_id INTEGER NOT NULL REFERENCES flow_tagung(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (tagung_id, user_id)
);

-- ══ Aufgabe ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flow_aufgabe (
    id SERIAL PRIMARY KEY,
    arbeitspaket_id INTEGER NOT NULL REFERENCES flow_arbeitspaket(id) ON DELETE CASCADE,
    titel VARCHAR(500) NOT NULL,
    beschreibung TEXT NOT NULL DEFAULT '',
    zustaendig INTEGER REFERENCES users(id) ON DELETE SET NULL,
    erstellt_von INTEGER REFERENCES users(id) ON DELETE SET NULL,
    deadline TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'offen'
        CHECK (status IN ('offen', 'in_bearbeitung', 'erledigt')),
    erstellt_aus VARCHAR(10) NOT NULL DEFAULT 'planung'
        CHECK (erstellt_aus IN ('planung', 'tagung')),
    tagung_id INTEGER REFERENCES flow_tagung(id) ON DELETE SET NULL,
    erledigt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_aufgabe_ap ON flow_aufgabe(arbeitspaket_id);
CREATE INDEX IF NOT EXISTS idx_flow_aufgabe_zustaendig ON flow_aufgabe(zustaendig);
CREATE INDEX IF NOT EXISTS idx_flow_aufgabe_status ON flow_aufgabe(status);
CREATE INDEX IF NOT EXISTS idx_flow_aufgabe_deadline ON flow_aufgabe(deadline);

-- ══ Agenda-Punkt ═════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flow_agenda_punkt (
    id SERIAL PRIMARY KEY,
    tagung_id INTEGER NOT NULL REFERENCES flow_tagung(id) ON DELETE CASCADE,
    titel VARCHAR(500) NOT NULL,
    beschreibung TEXT NOT NULL DEFAULT '',
    referenzierte_aufgabe_id INTEGER REFERENCES flow_aufgabe(id) ON DELETE SET NULL,
    ergebnis TEXT,
    entscheidung TEXT,
    sortierung INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_agenda_tagung ON flow_agenda_punkt(tagung_id);

-- ══ Datei ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flow_datei (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    groesse INTEGER NOT NULL,
    hochgeladen_von INTEGER REFERENCES users(id) ON DELETE SET NULL,
    external_url TEXT,
    -- Polymorphe Zuordnung: genau eine FK muss gesetzt sein
    bildungsgang_id INTEGER REFERENCES flow_bildungsgang(id) ON DELETE CASCADE,
    arbeitspaket_id INTEGER REFERENCES flow_arbeitspaket(id) ON DELETE CASCADE,
    aufgabe_id INTEGER REFERENCES flow_aufgabe(id) ON DELETE CASCADE,
    tagung_id INTEGER REFERENCES flow_tagung(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT flow_datei_zuordnung_check CHECK (
        (CASE WHEN bildungsgang_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN arbeitspaket_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN aufgabe_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN tagung_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

CREATE INDEX IF NOT EXISTS idx_flow_datei_bg ON flow_datei(bildungsgang_id);
CREATE INDEX IF NOT EXISTS idx_flow_datei_ap ON flow_datei(arbeitspaket_id);
CREATE INDEX IF NOT EXISTS idx_flow_datei_aufgabe ON flow_datei(aufgabe_id);
CREATE INDEX IF NOT EXISTS idx_flow_datei_tagung ON flow_datei(tagung_id);

-- ══ Aktivitaet (Audit Trail) ════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flow_aktivitaet (
    id SERIAL PRIMARY KEY,
    typ VARCHAR(50) NOT NULL,
    akteur INTEGER REFERENCES users(id) ON DELETE SET NULL,
    arbeitspaket_id INTEGER NOT NULL REFERENCES flow_arbeitspaket(id) ON DELETE CASCADE,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_aktivitaet_ap ON flow_aktivitaet(arbeitspaket_id);
CREATE INDEX IF NOT EXISTS idx_flow_aktivitaet_akteur ON flow_aktivitaet(akteur);
CREATE INDEX IF NOT EXISTS idx_flow_aktivitaet_created ON flow_aktivitaet(created_at);

-- ══ Kalender-Token ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flow_kalender_token (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_flow_kalender_token ON flow_kalender_token(token);

-- ══ Schulkalender-Import ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS flow_schulkalender (
    id SERIAL PRIMARY KEY,
    summary VARCHAR(500) NOT NULL,
    dtstart TIMESTAMPTZ NOT NULL,
    dtend TIMESTAMPTZ NOT NULL,
    ganztaegig BOOLEAN NOT NULL DEFAULT FALSE,
    quelle VARCHAR(500) NOT NULL,
    uid_extern VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(uid_extern, quelle)
);

CREATE INDEX IF NOT EXISTS idx_flow_schulkalender_zeit ON flow_schulkalender(dtstart, dtend);

-- ══ RLS fuer PII-Tabellen ═══════════════════════════════════════════

ALTER TABLE flow_arbeitspaket_mitglied ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_arbeitspaket_mitglied FORCE ROW LEVEL SECURITY;

ALTER TABLE flow_aufgabe ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_aufgabe FORCE ROW LEVEL SECURITY;

ALTER TABLE flow_aktivitaet ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_aktivitaet FORCE ROW LEVEL SECURITY;

ALTER TABLE flow_tagung_teilnehmer ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_tagung_teilnehmer FORCE ROW LEVEL SECURITY;

-- RLS Policy: App-User hat vollen Zugriff (Berechtigungspruefung in der Anwendungsschicht)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_flow_ap_mitglied') THEN
        EXECUTE 'CREATE POLICY app_full_access_flow_ap_mitglied ON flow_arbeitspaket_mitglied FOR ALL USING (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_flow_aufgabe') THEN
        EXECUTE 'CREATE POLICY app_full_access_flow_aufgabe ON flow_aufgabe FOR ALL USING (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_flow_aktivitaet') THEN
        EXECUTE 'CREATE POLICY app_full_access_flow_aktivitaet ON flow_aktivitaet FOR ALL USING (true)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_flow_tagung_tn') THEN
        EXECUTE 'CREATE POLICY app_full_access_flow_tagung_tn ON flow_tagung_teilnehmer FOR ALL USING (true)';
    END IF;
END $$;

-- ══ Modul-Registrierung ═════════════════════════════════════════════

INSERT INTO module_config (module_id, enabled)
VALUES ('flow', TRUE)
ON CONFLICT (module_id) DO NOTHING;

COMMIT;
