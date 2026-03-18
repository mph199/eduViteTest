-- Migration 043: Token Version fuer serverseitige JWT-Invalidierung
-- Bei Logout oder Passwort-Aenderung wird token_version inkrementiert.
-- Die auth-Middleware prueft ob der JWT-token_version >= users.token_version ist.

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.token_version IS 'Inkrementiert bei Logout/Passwortwechsel. JWTs mit aelterer Version werden abgelehnt.';
