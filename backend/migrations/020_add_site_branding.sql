-- Migration 020: site_branding table for tenant appearance configuration
-- Stores theme colors, school name, header settings, and landing page texts.
-- Single-row table (id=1) like email_branding.

CREATE TABLE IF NOT EXISTS site_branding (
  id            INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- School identity
  school_name       VARCHAR(255) NOT NULL DEFAULT 'BKSB',
  logo_url          TEXT         NOT NULL DEFAULT '',

  -- Theme colors (hex, e.g. "#10b981")
  primary_color     VARCHAR(9)  NOT NULL DEFAULT '#10b981',
  primary_dark      VARCHAR(9)  NOT NULL DEFAULT '#059669',
  primary_darker    VARCHAR(9)  NOT NULL DEFAULT '#047857',
  secondary_color   VARCHAR(9)  NOT NULL DEFAULT '#a7f3d0',
  ink_color         VARCHAR(9)  NOT NULL DEFAULT '#065f46',
  surface_1         VARCHAR(9)  NOT NULL DEFAULT '#f0fdf4',
  surface_2         VARCHAR(9)  NOT NULL DEFAULT '#dcfce7',

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
