# Skill: testing-react-express

> Tests erstellen, überarbeiten oder ergänzen für Frontend- oder Backend-Verhalten.

## Typische Trigger

- neuer Bugfix
- fehlende Testabdeckung
- instabile Route
- Login-/Logout-Änderung
- Validierungslogik
- geschützte Route
- Service-Logik
- Fehlerpfade

## Grundsätze

1. Teste beobachtbares Verhalten, nicht Implementierungsdetails.
2. Ergänze nach Bugfixes bevorzugt einen Regressionstest.
3. Tests sollen schnell, deterministisch und lesbar sein.
4. Frontend- und Backend-Verantwortung nur dann koppeln, wenn ein echter Integrationstest nötig ist.

## Frontend-Fokus

- Rendering von Routen
- Navigation
- Formulare und Validierungsfeedback
- Loading-, Empty-, Success- und Error-States
- Redirects
- geschützte UI-Pfade

## Backend-Fokus

- Zod-Validierung
- Auth- und Berechtigungsprüfung
- Erfolgs- und Fehlerantworten
- Service-Verhalten
- tenant-bezogene Logik
- DB-abhängige Entscheidungen

## Hochrisikofälle

- Login / Logout / Session-Ablauf
- Cookie-basierte JWT-Flows
- Rollen- oder Rechteprüfung
- Zugriff auf falsche Schule / falsche Tenant-Daten
- invalid / empty / unauthorized cases
- Write-Pfade und Transaktionslogik

## Erwartetes Ergebnis

- richtige Testebene gewählt
- Success- und Failure-Path geprüft
- Edge Cases erfasst
- bei verbleibendem Risiko: Lücke explizit benennen
