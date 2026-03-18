-- Migration 044: force_password_change flag
-- When true, user must change their password on next login.
-- Set to true on account creation / password reset, false after password change.

ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE;
