-- Migration: Add email column to users table for email-based login
-- Populate existing users' email from linked teachers table

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Populate email from teachers for existing teacher-users
UPDATE users u
SET email = LOWER(t.email)
FROM teachers t
WHERE u.teacher_id = t.id
  AND t.email IS NOT NULL
  AND u.email IS NULL;

-- Create unique index (allows NULL — only enforces uniqueness on non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email) WHERE email IS NOT NULL;

-- Index for faster login lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
