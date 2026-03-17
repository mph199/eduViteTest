-- Migration 037: DSB-Kontaktdaten in site_branding (DSGVO Art. 13/14)
--
-- Erweitert site_branding um Felder fuer Datenschutzbeauftragten,
-- Verantwortliche Stelle und Aufsichtsbehoerde.

ALTER TABLE site_branding ADD COLUMN IF NOT EXISTS dsb_name TEXT DEFAULT '';
ALTER TABLE site_branding ADD COLUMN IF NOT EXISTS dsb_email TEXT DEFAULT '';
ALTER TABLE site_branding ADD COLUMN IF NOT EXISTS responsible_name TEXT DEFAULT '';
ALTER TABLE site_branding ADD COLUMN IF NOT EXISTS responsible_address TEXT DEFAULT '';
ALTER TABLE site_branding ADD COLUMN IF NOT EXISTS responsible_email TEXT DEFAULT '';
ALTER TABLE site_branding ADD COLUMN IF NOT EXISTS responsible_phone TEXT DEFAULT '';
ALTER TABLE site_branding ADD COLUMN IF NOT EXISTS supervisory_authority TEXT DEFAULT '';
ALTER TABLE site_branding ADD COLUMN IF NOT EXISTS privacy_policy_url TEXT DEFAULT '/datenschutz';
