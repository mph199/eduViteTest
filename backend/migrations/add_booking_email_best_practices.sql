-- Migration: Email best practices
-- - Store verification token as hash (sha256) instead of plaintext
-- - Add cancellation_sent_at to make cancellation emails idempotent

-- Needed for digest() in backfill
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE slots
  ADD COLUMN IF NOT EXISTS verification_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_slots_verification_token_hash ON slots(verification_token_hash);

-- Backfill hash for existing plaintext tokens (transition)
UPDATE slots
SET verification_token_hash = encode(digest(verification_token, 'sha256'), 'hex')
WHERE verification_token IS NOT NULL
  AND verification_token_hash IS NULL;
