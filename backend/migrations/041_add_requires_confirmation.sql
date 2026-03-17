-- Migration 041: Optionale Terminbestaetigung pro Berater/in
-- Wenn requires_confirmation = FALSE, wird die Buchung direkt auf 'confirmed' gesetzt.
-- DEFAULT TRUE sichert Rueckwaertskompatibilitaet (bisheriges Verhalten bleibt bestehen).

ALTER TABLE bl_counselors
  ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE ssw_counselors
  ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN bl_counselors.requires_confirmation
  IS 'Wenn FALSE: Buchung wird direkt auf confirmed gesetzt, ohne manuelle Bestaetigung.';

COMMENT ON COLUMN ssw_counselors.requires_confirmation
  IS 'Wenn FALSE: Buchung wird direkt auf confirmed gesetzt, ohne manuelle Bestaetigung.';
