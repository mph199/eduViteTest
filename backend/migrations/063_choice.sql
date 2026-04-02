-- Migration 063: Modul Differenzierungswahl
--
-- 6 Tabellen fuer strukturierte Wunschabgabe fuer Differenzierungsfaecher.
-- Wahldaecher (Groups) mit Optionen, Teilnehmern, Abgaben und E-Mail-Tokens.

BEGIN;

-- Wahldaecher
CREATE TABLE IF NOT EXISTS choice_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  min_choices     INT NOT NULL DEFAULT 1,
  max_choices     INT NOT NULL DEFAULT 1,
  ranking_mode    VARCHAR(20) NOT NULL DEFAULT 'none'
                    CHECK (ranking_mode IN ('none', 'required')),
  allow_edit_after_submit BOOLEAN NOT NULL DEFAULT true,
  opens_at        TIMESTAMPTZ,
  closes_at       TIMESTAMPTZ,
  created_by      INT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Waehlbare Optionen (Faecher) pro Wahldach
CREATE TABLE IF NOT EXISTS choice_options (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES choice_groups(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, title)
);

CREATE INDEX IF NOT EXISTS idx_choice_options_group_id
  ON choice_options(group_id);

-- Teilnehmer pro Wahldach
CREATE TABLE IF NOT EXISTS choice_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES choice_groups(id) ON DELETE CASCADE,
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  audience_label  VARCHAR(100),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, email)
);

CREATE INDEX IF NOT EXISTS idx_choice_participants_group_id
  ON choice_participants(group_id);

-- Abgaben (eine pro Teilnehmer und Wahldach)
CREATE TABLE IF NOT EXISTS choice_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES choice_groups(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES choice_participants(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'submitted')),
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_choice_submissions_group_id
  ON choice_submissions(group_id);
CREATE INDEX IF NOT EXISTS idx_choice_submissions_participant_id
  ON choice_submissions(participant_id);

-- Einzelne Wuensche einer Abgabe
CREATE TABLE IF NOT EXISTS choice_submission_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID NOT NULL REFERENCES choice_submissions(id) ON DELETE CASCADE,
  option_id       UUID NOT NULL REFERENCES choice_options(id) ON DELETE RESTRICT,
  priority        INT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(submission_id, option_id),
  UNIQUE(submission_id, priority)
);

CREATE INDEX IF NOT EXISTS idx_choice_submission_items_submission_id
  ON choice_submission_items(submission_id);

-- E-Mail-Verifizierungstokens (Single-Use, gehashter Token)
CREATE TABLE IF NOT EXISTS choice_email_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  UUID NOT NULL REFERENCES choice_participants(id) ON DELETE CASCADE,
  token_hash      CHAR(64) NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_choice_email_tokens_token_hash
  ON choice_email_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_choice_email_tokens_participant_id
  ON choice_email_tokens(participant_id);

-- Modul in module_config registrieren
INSERT INTO module_config (module_id, enabled)
VALUES ('choice', false)
ON CONFLICT (module_id) DO NOTHING;

COMMIT;
