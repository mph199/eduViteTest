-- ============================================================
-- BASELINE SCHEMA — Consolidated from 62 legacy migrations
-- Generated: 2026-03-30
--
-- This file represents the complete database state after all
-- legacy migrations (001-062) have been applied.
--
-- For NEW deployments: this file is the starting point.
-- For EXISTING deployments: this file is skipped (migrations
-- 001-062 are already tracked in applied_migrations).
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS teachers (
    id               SERIAL PRIMARY KEY,
    first_name       VARCHAR(255)    NOT NULL DEFAULT '',
    last_name        VARCHAR(255)    NOT NULL DEFAULT '',
    name             VARCHAR(511)    GENERATED ALWAYS AS (TRIM(first_name || ' ' || last_name)) STORED,
    subject          VARCHAR(255)    NOT NULL,
    email            VARCHAR(255),
    salutation       VARCHAR(10),
    available_from   TIME            NOT NULL DEFAULT '16:00',
    available_until  TIME            NOT NULL DEFAULT '19:00',
    calendar_token_hash       CHAR(64),
    calendar_token_created_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ     DEFAULT NOW(),
    CONSTRAINT teachers_salutation_check
        CHECK (salutation IS NULL OR salutation IN ('Herr', 'Frau', 'Divers'))
);

CREATE TABLE IF NOT EXISTS events (
    id                 SERIAL PRIMARY KEY,
    name               VARCHAR(255)    NOT NULL,
    school_year        VARCHAR(20)     NOT NULL,
    starts_at          TIMESTAMPTZ     NOT NULL,
    ends_at            TIMESTAMPTZ     NOT NULL,
    timezone           VARCHAR(64)     NOT NULL DEFAULT 'Europe/Berlin',
    status             VARCHAR(20)     NOT NULL DEFAULT 'draft',
    booking_opens_at   TIMESTAMPTZ,
    booking_closes_at  TIMESTAMPTZ,
    closed_at          TIMESTAMPTZ,
    created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT events_status_check
        CHECK (status IN ('draft', 'published', 'closed')),
    CONSTRAINT events_time_check
        CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS slots (
    id                         SERIAL PRIMARY KEY,
    teacher_id                 INTEGER         NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    event_id                   INTEGER         REFERENCES events(id) ON DELETE CASCADE,
    time                       VARCHAR(50)     NOT NULL,
    date                       VARCHAR(50)     NOT NULL,
    booked                     BOOLEAN         DEFAULT FALSE,
    parent_name                VARCHAR(255),
    student_name               VARCHAR(255),
    class_name                 VARCHAR(100),
    status                     VARCHAR(20),
    visitor_type               VARCHAR(20),
    company_name               VARCHAR(255),
    trainee_name               VARCHAR(255),
    email                      VARCHAR(255),
    message                    TEXT,
    representative_name        VARCHAR(255),
    verification_sent_at       TIMESTAMPTZ,
    verified_at                TIMESTAMPTZ,
    confirmation_sent_at       TIMESTAMPTZ,
    verification_token_hash    TEXT,
    cancellation_sent_at       TIMESTAMPTZ,
    requires_confirmation      BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at                 TIMESTAMPTZ     DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ     DEFAULT NOW(),
    CONSTRAINT check_slot_status
        CHECK (status IS NULL OR status IN ('reserved', 'confirmed')),
    CONSTRAINT check_visitor_type
        CHECK (visitor_type IS NULL OR visitor_type IN ('parent', 'company'))
);

CREATE TABLE IF NOT EXISTS booking_requests (
    id                       SERIAL PRIMARY KEY,
    event_id                 INTEGER         REFERENCES events(id) ON DELETE CASCADE,
    teacher_id               INTEGER         NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    requested_time           VARCHAR(50)     NOT NULL,
    date                     VARCHAR(50)     NOT NULL,
    status                   VARCHAR(20)     NOT NULL DEFAULT 'requested',
    visitor_type             VARCHAR(20)     NOT NULL,
    parent_name              VARCHAR(255),
    company_name             VARCHAR(255),
    student_name             VARCHAR(255),
    trainee_name             VARCHAR(255),
    representative_name      VARCHAR(255),
    class_name               VARCHAR(100)    NOT NULL,
    email                    VARCHAR(255)    NOT NULL,
    message                  TEXT,
    verification_token_hash  VARCHAR(128),
    verification_sent_at     TIMESTAMPTZ,
    verified_at              TIMESTAMPTZ,
    confirmation_sent_at     TIMESTAMPTZ,
    assigned_slot_id         INTEGER         REFERENCES slots(id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT booking_requests_status_check
        CHECK (status IN ('requested', 'accepted', 'declined')),
    CONSTRAINT booking_requests_visitor_type_check
        CHECK (visitor_type IN ('parent', 'company'))
);

CREATE TABLE IF NOT EXISTS users (
    id                      SERIAL PRIMARY KEY,
    username                VARCHAR(100)    NOT NULL UNIQUE,
    password_hash           VARCHAR(255)    NOT NULL,
    role                    VARCHAR(20)     NOT NULL,
    teacher_id              INTEGER         REFERENCES teachers(id) ON DELETE SET NULL,
    email                   TEXT,
    failed_login_attempts   INTEGER         DEFAULT 0,
    locked_until            TIMESTAMPTZ,
    last_failed_login       TIMESTAMPTZ,
    token_version           INTEGER         NOT NULL DEFAULT 0,
    force_password_change   BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ     DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'teacher', 'superadmin'))
);

CREATE TABLE IF NOT EXISTS settings (
    id          SERIAL PRIMARY KEY,
    event_name  VARCHAR(255)    NOT NULL DEFAULT 'Elternsprechtag',
    event_date  DATE            NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ     DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     DEFAULT NOW()
);

-- ============================================================
-- 2. SSW (Schulsozialarbeit) TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS ssw_counselors (
    id                          SERIAL PRIMARY KEY,
    first_name                  VARCHAR(255) NOT NULL DEFAULT '',
    last_name                   VARCHAR(255) NOT NULL DEFAULT '',
    name                        VARCHAR(511) GENERATED ALWAYS AS (TRIM(first_name || ' ' || last_name)) STORED,
    email                       VARCHAR(255),
    salutation                  VARCHAR(10),
    room                        VARCHAR(100),
    phone                       VARCHAR(50),
    specializations             TEXT,
    available_from              TIME NOT NULL DEFAULT '08:00',
    available_until             TIME NOT NULL DEFAULT '14:00',
    slot_duration_minutes       INTEGER NOT NULL DEFAULT 30,
    user_id                     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    active                      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    calendar_token_hash         CHAR(64),
    calendar_token_created_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ssw_categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    icon        VARCHAR(10) DEFAULT '',
    sort_order  INTEGER DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ssw_weekly_schedule (
    id           SERIAL PRIMARY KEY,
    counselor_id INTEGER NOT NULL REFERENCES ssw_counselors(id) ON DELETE CASCADE,
    weekday      INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time   TIME NOT NULL DEFAULT '08:00',
    end_time     TIME NOT NULL DEFAULT '14:00',
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (counselor_id, weekday)
);

CREATE TABLE IF NOT EXISTS ssw_appointments (
    id               SERIAL PRIMARY KEY,
    counselor_id     INTEGER NOT NULL REFERENCES ssw_counselors(id) ON DELETE CASCADE,
    category_id      INTEGER REFERENCES ssw_categories(id) ON DELETE SET NULL,
    date             DATE NOT NULL,
    time             TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status           VARCHAR(20) NOT NULL DEFAULT 'available'
                         CHECK (status IN ('available', 'requested', 'confirmed', 'cancelled', 'completed')),
    student_name     VARCHAR(255),
    student_class    VARCHAR(100),
    email            VARCHAR(255),
    phone            VARCHAR(50),
    is_urgent        BOOLEAN DEFAULT FALSE,
    booked_at        TIMESTAMPTZ,
    confirmed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    restricted       BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- 3. BL (Beratungslehrer) TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS bl_counselors (
    id                          SERIAL PRIMARY KEY,
    first_name                  VARCHAR(255) NOT NULL DEFAULT '',
    last_name                   VARCHAR(255) NOT NULL DEFAULT '',
    name                        VARCHAR(511) GENERATED ALWAYS AS (TRIM(first_name || ' ' || last_name)) STORED,
    email                       VARCHAR(255),
    salutation                  VARCHAR(10),
    room                        VARCHAR(100),
    phone                       VARCHAR(50),
    specializations             TEXT,
    available_from              TIME NOT NULL DEFAULT '08:00',
    available_until             TIME NOT NULL DEFAULT '14:00',
    slot_duration_minutes       INTEGER NOT NULL DEFAULT 30,
    user_id                     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    active                      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    calendar_token_hash         CHAR(64),
    calendar_token_created_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS bl_topics (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order  INTEGER DEFAULT 0,
    active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS bl_weekly_schedule (
    id           SERIAL PRIMARY KEY,
    counselor_id INTEGER NOT NULL REFERENCES bl_counselors(id) ON DELETE CASCADE,
    weekday      INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
    start_time   TIME NOT NULL DEFAULT '08:00',
    end_time     TIME NOT NULL DEFAULT '14:00',
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (counselor_id, weekday)
);

CREATE TABLE IF NOT EXISTS bl_appointments (
    id               SERIAL PRIMARY KEY,
    counselor_id     INTEGER NOT NULL REFERENCES bl_counselors(id) ON DELETE CASCADE,
    topic_id         INTEGER REFERENCES bl_topics(id) ON DELETE SET NULL,
    date             DATE NOT NULL,
    time             TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status           VARCHAR(20) NOT NULL DEFAULT 'available'
                         CHECK (status IN ('available', 'requested', 'confirmed', 'cancelled', 'completed')),
    student_name     VARCHAR(255),
    student_class    VARCHAR(100),
    email            VARCHAR(255),
    phone            VARCHAR(50),
    is_anonymous     BOOLEAN DEFAULT FALSE,
    is_urgent        BOOLEAN DEFAULT FALSE,
    booked_at        TIMESTAMPTZ,
    confirmed_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    restricted       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS bl_requests (
    id             SERIAL PRIMARY KEY,
    counselor_id   INTEGER REFERENCES bl_counselors(id) ON DELETE CASCADE,
    topic_id       INTEGER REFERENCES bl_topics(id) ON DELETE SET NULL,
    message        TEXT NOT NULL,
    contact_method VARCHAR(50) DEFAULT 'none'
                       CHECK (contact_method IN ('none', 'email', 'note')),
    contact_info   VARCHAR(255),
    is_urgent      BOOLEAN DEFAULT FALSE,
    status         VARCHAR(20) NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'read', 'in_progress', 'answered', 'closed')),
    response       TEXT,
    responded_at   TIMESTAMPTZ,
    responded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    access_token   VARCHAR(64) NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW(),
    restricted     BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- 4. BRANDING TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS email_branding (
    id           SERIAL PRIMARY KEY,
    school_name  VARCHAR(255) NOT NULL DEFAULT 'BKSB',
    logo_url     TEXT DEFAULT '',
    primary_color VARCHAR(9) NOT NULL DEFAULT '#2d5016',
    footer_text  TEXT NOT NULL DEFAULT E'Mit freundlichen Grüßen\n\nIhr BKSB-Team',
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_branding (
    id                   INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    school_name          VARCHAR(255) NOT NULL DEFAULT 'BKSB',
    logo_url             TEXT NOT NULL DEFAULT '',
    primary_color        VARCHAR(9) NOT NULL DEFAULT '#123C73',
    primary_dark         VARCHAR(9) NOT NULL DEFAULT '#0B2545',
    primary_darker       VARCHAR(9) NOT NULL DEFAULT '#081D38',
    secondary_color      VARCHAR(9) NOT NULL DEFAULT '#5B8DEF',
    ink_color            VARCHAR(9) NOT NULL DEFAULT '#0B2545',
    surface_1            VARCHAR(9) NOT NULL DEFAULT '#F8FAFC',
    surface_2            VARCHAR(9) NOT NULL DEFAULT '#D9E4F2',
    header_font_color    VARCHAR(9) NOT NULL DEFAULT '',
    hero_title           VARCHAR(255) NOT NULL DEFAULT 'Herzlich willkommen!',
    hero_text            TEXT NOT NULL DEFAULT 'Über dieses Portal können Sie Gesprächstermine für den Eltern- und Ausbildersprechtag anfragen.',
    step_1               VARCHAR(255) NOT NULL DEFAULT 'Lehrkraft auswählen',
    step_2               VARCHAR(255) NOT NULL DEFAULT 'Wunsch-Zeitfenster wählen',
    step_3               VARCHAR(255) NOT NULL DEFAULT 'Daten eingeben und Anfrage absenden',
    tile_images          JSONB NOT NULL DEFAULT '{}',
    background_images    JSONB DEFAULT '{}',
    dsb_name             TEXT DEFAULT '',
    dsb_email            TEXT DEFAULT '',
    responsible_name     TEXT DEFAULT '',
    responsible_address  TEXT DEFAULT '',
    responsible_email    TEXT DEFAULT '',
    responsible_phone    TEXT DEFAULT '',
    supervisory_authority TEXT DEFAULT '',
    privacy_policy_url   TEXT DEFAULT '/datenschutz',
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS text_branding (
    id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    booking_title         VARCHAR(255) NOT NULL DEFAULT 'Herzlich willkommen!',
    booking_text          TEXT NOT NULL DEFAULT '',
    booking_steps_title   VARCHAR(255) NOT NULL DEFAULT 'In drei Schritten zum Termin:',
    booking_step_1        VARCHAR(255) NOT NULL DEFAULT 'Lehrkraft auswählen',
    booking_step_2        VARCHAR(255) NOT NULL DEFAULT 'Wunsch-Zeitfenster wählen',
    booking_step_3        VARCHAR(255) NOT NULL DEFAULT 'Daten eingeben und Anfrage absenden',
    booking_hint          TEXT NOT NULL DEFAULT '',
    event_banner_template TEXT NOT NULL DEFAULT '',
    event_banner_fallback TEXT NOT NULL DEFAULT '',
    modal_title           VARCHAR(255) NOT NULL DEFAULT 'Fast fertig!',
    modal_text            TEXT NOT NULL DEFAULT '',
    modal_button          VARCHAR(100) NOT NULL DEFAULT 'Verstanden',
    booking_closed_text   TEXT NOT NULL DEFAULT 'Buchungen sind aktuell noch nicht freigeschaltet.',
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. ACCESS CONTROL TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS user_module_access (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_key VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, module_key)
);

CREATE TABLE IF NOT EXISTS user_admin_access (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_key   VARCHAR(50) NOT NULL,
    access_level VARCHAR(20) NOT NULL DEFAULT 'full',
    granted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, module_key)
);

CREATE TABLE IF NOT EXISTS module_config (
    module_id  VARCHAR(64) PRIMARY KEY,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consent_receipts (
    id               SERIAL PRIMARY KEY,
    module           VARCHAR(50) NOT NULL,
    appointment_id   INTEGER,
    consent_version  VARCHAR(20) NOT NULL,
    consent_purpose  TEXT NOT NULL,
    ip_address       VARCHAR(45),
    user_agent       TEXT,
    consented_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action     VARCHAR(32) NOT NULL,
    table_name VARCHAR(64),
    record_id  INTEGER,
    details    JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. OAUTH TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS oauth_providers (
    id                      SERIAL PRIMARY KEY,
    provider_key            VARCHAR(50) NOT NULL UNIQUE,
    display_name            VARCHAR(255) NOT NULL,
    enabled                 BOOLEAN NOT NULL DEFAULT FALSE,
    client_id               VARCHAR(500) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    discovery_url           TEXT NOT NULL,
    scopes                  VARCHAR(500) NOT NULL DEFAULT 'openid profile email',
    email_claim             VARCHAR(100) NOT NULL DEFAULT 'email',
    name_claim              VARCHAR(100) NOT NULL DEFAULT 'name',
    allowed_domains         TEXT,
    auto_provisioning       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_user_links (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id             INTEGER NOT NULL REFERENCES oauth_providers(id) ON DELETE CASCADE,
    provider_subject        VARCHAR(500) NOT NULL,
    provider_email          VARCHAR(500),
    linked_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at           TIMESTAMPTZ,
    refresh_token_encrypted TEXT,
    access_token_encrypted  TEXT,
    token_expires_at        TIMESTAMPTZ,
    UNIQUE (provider_id, provider_subject),
    UNIQUE (user_id, provider_id)
);

-- ============================================================
-- 7. FLOW MODULE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS flow_bildungsgang (
    id                                    SERIAL PRIMARY KEY,
    name                                  VARCHAR(255) NOT NULL,
    erlaubt_mitgliedern_paket_erstellung  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_bildungsgang_mitglied (
    id              SERIAL PRIMARY KEY,
    bildungsgang_id INTEGER NOT NULL REFERENCES flow_bildungsgang(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rolle           VARCHAR(20) NOT NULL CHECK (rolle IN ('leitung', 'mitglied')),
    hinzugefuegt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    restricted      BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (bildungsgang_id, user_id)
);

CREATE TABLE IF NOT EXISTS flow_abteilungsleitung (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS flow_arbeitspaket (
    id                        SERIAL PRIMARY KEY,
    bildungsgang_id           INTEGER NOT NULL REFERENCES flow_bildungsgang(id) ON DELETE CASCADE,
    titel                     VARCHAR(500) NOT NULL,
    ist_zustand               TEXT NOT NULL,
    soll_zustand              TEXT NOT NULL,
    beteiligte_beschreibung   TEXT NOT NULL,
    status                    VARCHAR(20) NOT NULL DEFAULT 'entwurf'
                                  CHECK (status IN ('entwurf', 'geplant', 'aktiv', 'abgeschlossen')),
    deadline                  TIMESTAMPTZ,
    geplante_tagungen         INTEGER,
    abgeschlossen_at          TIMESTAMPTZ,
    abgeschlossen_von         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    abschluss_zusammenfassung TEXT,
    reflexion                 TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_arbeitspaket_mitglied (
    id              SERIAL PRIMARY KEY,
    arbeitspaket_id INTEGER NOT NULL REFERENCES flow_arbeitspaket(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rolle           VARCHAR(20) NOT NULL CHECK (rolle IN ('koordination', 'mitwirkende', 'lesezugriff')),
    hinzugefuegt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    restricted      BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (arbeitspaket_id, user_id)
);

CREATE TABLE IF NOT EXISTS flow_tagung (
    id              SERIAL PRIMARY KEY,
    arbeitspaket_id INTEGER NOT NULL REFERENCES flow_arbeitspaket(id) ON DELETE CASCADE,
    titel           VARCHAR(500) NOT NULL,
    start_at        TIMESTAMPTZ NOT NULL,
    end_at          TIMESTAMPTZ,
    raum            VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_tagung_teilnehmer (
    tagung_id INTEGER NOT NULL REFERENCES flow_tagung(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (tagung_id, user_id)
);

CREATE TABLE IF NOT EXISTS flow_aufgabe (
    id              SERIAL PRIMARY KEY,
    arbeitspaket_id INTEGER NOT NULL REFERENCES flow_arbeitspaket(id) ON DELETE CASCADE,
    titel           VARCHAR(500) NOT NULL,
    beschreibung    TEXT NOT NULL DEFAULT '',
    zustaendig      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    erstellt_von    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    deadline        TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'offen'
                        CHECK (status IN ('offen', 'in_bearbeitung', 'erledigt')),
    erstellt_aus    VARCHAR(10) NOT NULL DEFAULT 'planung'
                        CHECK (erstellt_aus IN ('planung', 'tagung')),
    tagung_id       INTEGER REFERENCES flow_tagung(id) ON DELETE SET NULL,
    erledigt_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    restricted      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS flow_agenda_punkt (
    id                       SERIAL PRIMARY KEY,
    tagung_id                INTEGER NOT NULL REFERENCES flow_tagung(id) ON DELETE CASCADE,
    titel                    VARCHAR(500) NOT NULL,
    beschreibung             TEXT NOT NULL DEFAULT '',
    referenzierte_aufgabe_id INTEGER REFERENCES flow_aufgabe(id) ON DELETE SET NULL,
    ergebnis                 TEXT,
    entscheidung             TEXT,
    sortierung               INTEGER NOT NULL DEFAULT 0,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_datei (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(500) NOT NULL,
    original_name   VARCHAR(500) NOT NULL,
    mime_type       VARCHAR(100) NOT NULL,
    groesse         INTEGER NOT NULL,
    hochgeladen_von INTEGER REFERENCES users(id) ON DELETE SET NULL,
    external_url    TEXT,
    bildungsgang_id INTEGER REFERENCES flow_bildungsgang(id) ON DELETE CASCADE,
    arbeitspaket_id INTEGER REFERENCES flow_arbeitspaket(id) ON DELETE CASCADE,
    aufgabe_id      INTEGER REFERENCES flow_aufgabe(id) ON DELETE CASCADE,
    tagung_id       INTEGER REFERENCES flow_tagung(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT flow_datei_zuordnung_check CHECK (
        (CASE WHEN bildungsgang_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN arbeitspaket_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN aufgabe_id      IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN tagung_id       IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

CREATE TABLE IF NOT EXISTS flow_aktivitaet (
    id              SERIAL PRIMARY KEY,
    typ             VARCHAR(50) NOT NULL,
    akteur          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    arbeitspaket_id INTEGER NOT NULL REFERENCES flow_arbeitspaket(id) ON DELETE CASCADE,
    details         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    restricted      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS flow_kalender_token (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id),
    UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS flow_schulkalender (
    id           SERIAL PRIMARY KEY,
    summary      VARCHAR(500) NOT NULL,
    dtstart      TIMESTAMPTZ NOT NULL,
    dtend        TIMESTAMPTZ NOT NULL,
    ganztaegig   BOOLEAN NOT NULL DEFAULT FALSE,
    quelle       VARCHAR(500) NOT NULL,
    uid_extern   VARCHAR(500),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (uid_extern, quelle)
);

-- ============================================================
-- 8. INDICES
-- ============================================================

-- Core
CREATE INDEX IF NOT EXISTS idx_slots_teacher_id ON slots(teacher_id);
CREATE INDEX IF NOT EXISTS idx_slots_booked ON slots(booked);
CREATE INDEX IF NOT EXISTS idx_slots_teacher_date ON slots(teacher_id, date);
CREATE INDEX IF NOT EXISTS idx_slots_email ON slots(email);
CREATE INDEX IF NOT EXISTS idx_slots_event_id ON slots(event_id);
CREATE INDEX IF NOT EXISTS idx_slots_verification_token_hash ON slots(verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_school_year ON events(school_year);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_booking_requests_email ON booking_requests(email);
CREATE INDEX IF NOT EXISTS idx_booking_requests_verification_token_hash ON booking_requests(verification_token_hash);
CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at ON booking_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_booking_requests_event_id ON booking_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_booking_requests_teacher_id ON booking_requests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_users_teacher_id ON users(teacher_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_calendar_token_hash ON teachers(calendar_token_hash) WHERE calendar_token_hash IS NOT NULL;

-- SSW
CREATE INDEX IF NOT EXISTS idx_ssw_counselors_user_id ON ssw_counselors(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ssw_counselors_calendar_token_hash ON ssw_counselors(calendar_token_hash) WHERE calendar_token_hash IS NOT NULL;

-- BL
CREATE INDEX IF NOT EXISTS idx_bl_counselors_user_id ON bl_counselors(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_weekly_schedule_counselor_id ON bl_weekly_schedule(counselor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bl_counselors_calendar_token_hash ON bl_counselors(calendar_token_hash) WHERE calendar_token_hash IS NOT NULL;

-- Access Control
CREATE INDEX IF NOT EXISTS idx_user_admin_access_user_id ON user_admin_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_admin_access_module_key ON user_admin_access(module_key);
CREATE INDEX IF NOT EXISTS idx_consent_receipts_consented_at ON consent_receipts(consented_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_consent_receipts_module_appointment ON consent_receipts(module, appointment_id);

-- OAuth
CREATE INDEX IF NOT EXISTS idx_oauth_user_links_user ON oauth_user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_user_links_provider ON oauth_user_links(provider_id);

-- Flow
CREATE INDEX IF NOT EXISTS idx_flow_bg_mitglied_bg ON flow_bildungsgang_mitglied(bildungsgang_id);
CREATE INDEX IF NOT EXISTS idx_flow_bg_mitglied_user ON flow_bildungsgang_mitglied(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_abteilungsleitung_user ON flow_abteilungsleitung(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_ap_bildungsgang ON flow_arbeitspaket(bildungsgang_id);
CREATE INDEX IF NOT EXISTS idx_flow_ap_status ON flow_arbeitspaket(status);
CREATE INDEX IF NOT EXISTS idx_flow_ap_deadline ON flow_arbeitspaket(deadline);
CREATE INDEX IF NOT EXISTS idx_flow_ap_mitglied_ap ON flow_arbeitspaket_mitglied(arbeitspaket_id);
CREATE INDEX IF NOT EXISTS idx_flow_ap_mitglied_user ON flow_arbeitspaket_mitglied(user_id);
CREATE INDEX IF NOT EXISTS idx_flow_tagung_ap ON flow_tagung(arbeitspaket_id);
CREATE INDEX IF NOT EXISTS idx_flow_tagung_start ON flow_tagung(start_at);
CREATE INDEX IF NOT EXISTS idx_flow_aufgabe_ap ON flow_aufgabe(arbeitspaket_id);
CREATE INDEX IF NOT EXISTS idx_flow_aufgabe_zustaendig ON flow_aufgabe(zustaendig);
CREATE INDEX IF NOT EXISTS idx_flow_aufgabe_status ON flow_aufgabe(status);
CREATE INDEX IF NOT EXISTS idx_flow_aufgabe_deadline ON flow_aufgabe(deadline);
CREATE INDEX IF NOT EXISTS idx_flow_agenda_tagung ON flow_agenda_punkt(tagung_id);
CREATE INDEX IF NOT EXISTS idx_flow_datei_bg ON flow_datei(bildungsgang_id);
CREATE INDEX IF NOT EXISTS idx_flow_datei_ap ON flow_datei(arbeitspaket_id);
CREATE INDEX IF NOT EXISTS idx_flow_datei_aufgabe ON flow_datei(aufgabe_id);
CREATE INDEX IF NOT EXISTS idx_flow_datei_tagung ON flow_datei(tagung_id);
CREATE INDEX IF NOT EXISTS idx_flow_aktivitaet_ap ON flow_aktivitaet(arbeitspaket_id);
CREATE INDEX IF NOT EXISTS idx_flow_aktivitaet_akteur ON flow_aktivitaet(akteur);
CREATE INDEX IF NOT EXISTS idx_flow_aktivitaet_created ON flow_aktivitaet(created_at);
CREATE INDEX IF NOT EXISTS idx_flow_kalender_token ON flow_kalender_token(token);
CREATE INDEX IF NOT EXISTS idx_flow_schulkalender_zeit ON flow_schulkalender(dtstart, dtend);

-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots FORCE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE ssw_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssw_appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE bl_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bl_appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE flow_arbeitspaket_mitglied ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_arbeitspaket_mitglied FORCE ROW LEVEL SECURITY;
ALTER TABLE flow_aufgabe ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_aufgabe FORCE ROW LEVEL SECURITY;
ALTER TABLE flow_aktivitaet ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_aktivitaet FORCE ROW LEVEL SECURITY;
ALTER TABLE flow_tagung_teilnehmer ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_tagung_teilnehmer FORCE ROW LEVEL SECURITY;

-- Permissive policies (app accesses via single pool user)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Teachers are viewable by everyone') THEN
    CREATE POLICY "Teachers are viewable by everyone" ON teachers FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can book slots') THEN
    CREATE POLICY "Anyone can book slots" ON slots FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_users') THEN
    CREATE POLICY app_full_access_users ON users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_ssw') THEN
    CREATE POLICY app_full_access_ssw ON ssw_appointments FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_bl') THEN
    CREATE POLICY app_full_access_bl ON bl_appointments FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_audit') THEN
    CREATE POLICY app_full_access_audit ON audit_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_flow_ap_mitglied') THEN
    CREATE POLICY app_full_access_flow_ap_mitglied ON flow_arbeitspaket_mitglied FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_flow_aufgabe') THEN
    CREATE POLICY app_full_access_flow_aufgabe ON flow_aufgabe FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_flow_aktivitaet') THEN
    CREATE POLICY app_full_access_flow_aktivitaet ON flow_aktivitaet FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_flow_tagung_tn') THEN
    CREATE POLICY app_full_access_flow_tagung_tn ON flow_tagung_teilnehmer FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'app_full_access_events') THEN
    CREATE POLICY app_full_access_events ON events FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 10. FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION anonymize_booking_requests(p_event_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE booking_requests
  SET parent_name = NULL, company_name = NULL, student_name = NULL,
      trainee_name = NULL, representative_name = NULL, class_name = NULL,
      email = NULL, message = NULL, verification_token_hash = NULL,
      updated_at = NOW()
  WHERE event_id = p_event_id
    AND (parent_name IS NOT NULL OR email IS NOT NULL);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION anonymize_booking_request(p_request_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE booking_requests
  SET parent_name = NULL, company_name = NULL, student_name = NULL,
      trainee_name = NULL, representative_name = NULL, class_name = NULL,
      email = NULL, message = NULL, verification_token_hash = NULL,
      updated_at = NOW()
  WHERE id = p_request_id
    AND (parent_name IS NOT NULL OR email IS NOT NULL);
  RETURN FOUND;
END;
$$;

COMMIT;
