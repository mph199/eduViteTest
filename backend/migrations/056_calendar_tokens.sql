-- 056_calendar_tokens.sql
-- Kalender-Abo-Token für Lehrkräfte (ICS-Feed)
-- Token wird als SHA-256-Hash gespeichert (CHAR(64) = feste Länge)

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS calendar_token_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS calendar_token_created_at TIMESTAMPTZ;

-- Partieller Unique-Index: schneller Lookup + Uniqueness in einem
-- Kein separater UNIQUE-Constraint nötig (wäre doppelt)
CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_calendar_token_hash
  ON teachers (calendar_token_hash)
  WHERE calendar_token_hash IS NOT NULL;
