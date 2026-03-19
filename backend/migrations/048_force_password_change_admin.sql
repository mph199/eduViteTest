-- 048: Default-Admin 'Start' (angelegt in Migration 012) muss Passwort
-- bei erstem Login aendern.
-- Idempotent: greift nur wenn force_password_change noch FALSE ist.
-- Falls der Admin-Username geaendert oder der User geloescht wurde,
-- aktualisiert dieses Statement 0 Zeilen – kein Fehler.

UPDATE users
SET force_password_change = TRUE
WHERE username = 'Start'
  AND force_password_change = FALSE;
