-- Migration: Add superadmin role and email_branding table
-- Run: sudo -u sprechtag psql sprechtag < migrations/add_superadmin_and_email_branding.sql

-- 1. Extend users.role CHECK constraint to include 'superadmin'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'teacher', 'superadmin'));

-- 2. Create email_branding table (single-row config, like settings)
CREATE TABLE IF NOT EXISTS email_branding (
  id SERIAL PRIMARY KEY,
  school_name VARCHAR(255) NOT NULL DEFAULT 'BKSB',
  logo_url TEXT DEFAULT '',
  primary_color VARCHAR(9) NOT NULL DEFAULT '#2d5016',
  footer_text TEXT NOT NULL DEFAULT 'Mit freundlichen Grüßen

Ihr BKSB-Team',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default row if empty
INSERT INTO email_branding (id, school_name, logo_url, primary_color, footer_text)
VALUES (1, 'BKSB', '', '#2d5016', E'Mit freundlichen Grüßen\n\nIhr BKSB-Team')
ON CONFLICT (id) DO NOTHING;
