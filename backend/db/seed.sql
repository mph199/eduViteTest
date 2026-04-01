-- ============================================================
-- SEED DATA — Initial configuration for new deployments
-- Run manually: psql -f backend/db/seed.sql
-- NOT run automatically during migration.
-- ============================================================

-- Default settings (one row)
INSERT INTO settings (event_name, event_date)
VALUES ('Elternsprechtag', CURRENT_DATE)
ON CONFLICT DO NOTHING;

-- Default email branding (one row)
INSERT INTO email_branding (school_name, primary_color, footer_text)
VALUES ('BKSB', '#2d5016', E'Mit freundlichen Grüßen\n\nIhr BKSB-Team')
ON CONFLICT DO NOTHING;

-- Default site branding (singleton, id=1)
INSERT INTO site_branding (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Default text branding (singleton, id=1)
INSERT INTO text_branding (id) VALUES (1) ON CONFLICT DO NOTHING;
