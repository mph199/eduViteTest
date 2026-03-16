-- Add background_images JSONB field to site_branding
-- Stores per-page background image URLs: {"landing": "/uploads/bg/...", "elternsprechtag": "/uploads/bg/..."}
ALTER TABLE site_branding
  ADD COLUMN IF NOT EXISTS background_images JSONB DEFAULT '{}'::jsonb;
