-- Migration 020: site_branding table for tenant appearance configuration
-- Stores theme colors, school name, header settings, and landing page texts.
-- Single-row table (id=1) like email_branding.

CREATE TABLE IF NOT EXISTS site_branding (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- School identity
  school_name       VARCHAR(255) NOT NULL DEFAULT 'BKSB',
  logo_url          TEXT         NOT NULL DEFAULT '',

  -- Theme colors (hex – navy/institutionell)
  primary_color     VARCHAR(9)  NOT NULL DEFAULT '#123C73',
  primary_dark      VARCHAR(9)  NOT NULL DEFAULT '#0B2545',
  primary_darker    VARCHAR(9)  NOT NULL DEFAULT '#081D38',
  secondary_color   VARCHAR(9)  NOT NULL DEFAULT '#5B8DEF',
  ink_color         VARCHAR(9)  NOT NULL DEFAULT '#0B2545',
  surface_1         VARCHAR(9)  NOT NULL DEFAULT '#F8FAFC',
  surface_2         VARCHAR(9)  NOT NULL DEFAULT '#D9E4F2',

  -- Header
  header_font_color VARCHAR(9)  NOT NULL DEFAULT '',

  -- Landing page
  hero_title        VARCHAR(255) NOT NULL DEFAULT 'Herzlich willkommen!',
  hero_text         TEXT         NOT NULL DEFAULT 'Über dieses Portal können Sie Gesprächstermine für den Eltern- und Ausbildersprechtag anfragen.',
  step_1            VARCHAR(255) NOT NULL DEFAULT 'Lehrkraft auswählen',
  step_2            VARCHAR(255) NOT NULL DEFAULT 'Wunsch-Zeitfenster wählen',
  step_3            VARCHAR(255) NOT NULL DEFAULT 'Daten eingeben und Anfrage absenden',

  -- Module tile images (JSON: { "elternsprechtag": "/uploads/tiles/abc.png" })
  tile_images       JSONB        NOT NULL DEFAULT '{}',

  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed default row
INSERT INTO site_branding (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
