# Skill: working-with-auth-validation-and-cookies

> Änderungen an Authentifizierung, Autorisierung, Cookie-Handling, Session-Flows oder Zod-Validierung.

## Projektbesonderheiten

- JWT liegt in einem httpOnly Cookie
- Zod validiert externe Eingaben
- Fehler in diesem Bereich sind hochkritisch

## Regeln

1. Auth- und Validierungsänderungen immer als Hochrisiko behandeln.
2. Autorisierung ausschließlich serverseitig absichern.
3. Cookie-Verhalten explizit betrachten.
4. Eingaben an Backend-Grenzen validieren.
5. Berechtigungsprüfungen nah an den geschützten Aktionen halten.

## Prüfschritte

### 1. Authentifizierungsfluss
- Login
- Logout
- Cookie setzen / löschen
- Token prüfen
- abgelaufene oder ungültige Tokens behandeln

### 2. Autorisierung
- geschützte Routen
- Rollen / Rechte
- schulbezogene Zugriffsbeschränkungen
- sauberes Deny-Verhalten

### 3. Validierung
- Body, Params und Query prüfen
- Zod-Schemas mit realer Payload abgleichen
- konsistente Fehlerrückgaben liefern

### 4. Frontend-Integration
- Requests mit Credentials korrekt konfigurieren
- UI reagiert sauber auf unauthorized / session expired
- Redirects und Guards folgen der Backend-Wahrheit

### 5. Häufige Fehler
- nur frontend-seitige Schutzlogik
- falsches Cookie-Setzen oder Löschen
- inkonsistente Validierung
- sensitive Daten in Responses oder Logs

## Erwartetes Ergebnis

- korrekter serverseitiger Schutz
- konsistente Validierung
- stabiler Login-/Logout-/Session-Flow
- keine Leaks sensibler Daten
