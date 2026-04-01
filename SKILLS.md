# SKILLS.md

Dieses Dokument definiert die bevorzugten Arbeitsweisen für Claude Code in diesem Projekt.

## Projektkontext

Diese Anwendung ist eine schulbezogene Full-Stack-Plattform mit folgendem Stack:

### Frontend
- React 19
- TypeScript 5.9
- Vite 7
- React Router 7
- Vitest
- @testing-library/react
- CSS Custom Properties
- Kein Tailwind

### Backend
- Node.js 20
- ESM
- Express 4
- PostgreSQL 16
- Kysely
- JWT Auth mit httpOnly Cookie
- Zod für Validierung
- Pino für Logging
- Nodemailer für E-Mail

### Deployment
- Docker Compose
- 3 Services: Frontend, Backend, PostgreSQL
- Single-Tenant pro Schule
- Jede Schule hat eine separate Datenbank und einen separaten VPS

---

## Projektspezifische Details

### Ordnerstruktur

```
eduViteTest/
├── backend/
│   ├── config/          # Logger (Pino), Konfiguration
│   ├── db/              # database.js (Kysely), types.ts, migrator.js, migrations/
│   ├── middleware/       # auth.js, audit-log.js
│   ├── migrations/      # SQL-Dateien (001...062), dreistellig nummeriert
│   ├── modules/         # elternsprechtag, schulsozialarbeit, beratungslehrer, flow
│   ├── routes/          # globale Routen
│   ├── schemas/         # Zod-Schemas (auth.js, booking.js, counselor.js)
│   ├── services/        # auth.js, booking.js, counselor.js, oauthService.js
│   └── shared/          # wiederverwendbare Route-Factories
├── src/
│   ├── components/, contexts/, hooks/, pages/, utils/
│   ├── modules/         # Frontend-Module (gleiche Namen wie backend/modules/)
│   ├── services/        # api.ts, apiBase.ts, mediaUtils.ts
│   └── types/           # index.ts
└── .claude/
    ├── agents/          # erkunder.md, architekt.md, pruefer.md, ...
    ├── rules/           # backend.md, frontend.md, workflows.md
    └── skills.md        # Slash-Command-Workflows (/migrate-file, /test-run, etc.)
```

### Namensschema

| Bereich | Muster | Beispiel |
|---------|--------|----------|
| Zod-Schemas | `backend/schemas/<domain>.js`, Export als `<action>Schema` | `loginSchema`, `bookingSchema` |
| Services | `backend/services/<domain>.js`, flache Dateien, kein Repository-Muster | `auth.js`, `booking.js` |
| DB-Zugriff | Kysely via `import { db } from '../db/database.js'` | Kein `SELECT *`, immer explizite Spalten |
| Frontend-API | Alle Methoden in `src/services/api.ts`, Basis in `apiBase.ts` | `fetchBookings()`, `createBooking()` |
| Module | Gleiche Namen in `backend/modules/` und `src/modules/` | `elternsprechtag`, `schulsozialarbeit` |

### Auth-Middleware-Muster

Token liegt im httpOnly-Cookie (`req.cookies.token`), kein Bearer-Header.
Token enthält `{ username, role, id, teacherId, modules, tv, fpc }`.
Token-Version wird gegen DB geprüft (Revocation).

| Middleware | Verwendung |
|---|---|
| `requireAuth` | Jeder eingeloggte User |
| `requireAdmin` | Rolle admin oder superadmin |
| `requireSuperadmin` | Nur superadmin |
| `requireModuleAccess(key)` | Factory — prüft `user.modules[]` |
| `requireModuleAdmin(key)` | Factory — prüft `user_admin_access`-Tabelle |

Einbindung:
```js
import { requireModuleAccess } from '../../../middleware/auth.js';
router.get('/...', requireModuleAccess('schulsozialarbeit'), handler);
```

### Kysely-Migrationspfad

- Verzeichnis: `backend/migrations/` — derzeit 062 SQL-Dateien
- Nummerierung: `NNN_beschreibender_name.sql` (dreistellig, nullgepaddet)
- Nächste Nummer ermitteln: `ls backend/migrations/ | sort | tail -1`
- Migrator: `backend/db/migrator.js` führt Migrationen beim Start aus
- JS-Migrationen für Datenhygiene: `backend/db/migrations/*.js` mit `up(db)` und `down(db)`
- Pflicht: `IF NOT EXISTS`, `TIMESTAMPTZ`, RLS-Policies direkt in der Migration

### Docker-Compose-Startlogik

Startreihenfolge: `postgres` (healthcheck: pg_isready) → `backend` → `frontend`

| Service | Details |
|---------|---------|
| postgres | `postgres:16-alpine`, Port `127.0.0.1:5432`, Volume `pg_data` |
| backend | `Dockerfile.backend`, Port `127.0.0.1:4000`, Volume `uploads/` |
| frontend | `Dockerfile.frontend`, Build-Arg `VITE_ENABLED_MODULES`, Port via `FRONTEND_BIND`/`FRONTEND_PORT` |

Pflicht-Env-Vars Backend: `POSTGRES_PASSWORD`, `SESSION_SECRET`, `JWT_SECRET`
Module doppelt aktivieren: `ENABLED_MODULES` (Backend-Runtime) + `VITE_ENABLED_MODULES` (Frontend-Build-Zeit)

---

## Globale Regeln

Diese Regeln gelten projektweit und sind bei allen Änderungen zu beachten:

1. Bevorzugt die kleinste sichere Änderung, die das Problem tatsächlich löst.
2. Trennt klar zwischen Frontend, Routing, Backend, Geschäftslogik und Datenzugriff.
3. Behandelt Auth, Cookies, Validierung, Migrationen und Tenant-Isolation als Hochrisikobereiche.
4. Führt keine breiten Architekturänderungen durch, wenn ein lokaler Fix ausreicht.
5. Berücksichtigt immer, dass der Datenzugriff aktuell teilweise migriert ist:
   - Kysely ist nur in etwa 50 Prozent der relevanten Dateien eingeführt.
   - Legacy-Zugriffe und Kysely-Zugriffe können nebeneinander existieren.
   - Änderungen am Datenzugriff müssen angrenzende Altpfade mitdenken.
6. Erzwingt Autorisierung serverseitig, niemals nur im Frontend.
7. Nutzt Zod an Backend-Grenzen für Request-Validierung.
8. Nutzt Logs gezielt zur Ursachenanalyse, ohne sensitive Daten offenzulegen.
9. Beachtet immer den Single-Tenant-Betrieb:
   - Jede Schule ist ein separates Deployment.
   - Jede Schule hat ihre eigene Datenbank.
   - Konfigurationsfehler, die auf die falsche DB oder falsche Umgebung zeigen, sind kritisch.
10. Wenn Änderungen Migrationen oder Deployments berühren, beschreibt Reihenfolge, Risiken und Verifikation explizit.

---

## Skill: debugging-react-express-kysely

**Wann verwenden**
Bei Fehleranalyse in React, React Router, Express, PostgreSQL, Kysely, Auth, Docker Compose oder Tenant-spezifischer Konfiguration.

**Typische Trigger**
- Runtime Error
- kaputte Navigation
- fehlerhafte API-Response
- Cookie/Auth-Probleme
- Zod-Validierungsfehler
- DB-Schema-Mismatch
- Docker-Compose- oder Env-Probleme
- tenant-spezifischer Fehler

**Vorgehen**
1. Fehler reproduzieren, bevor Änderungen vorgeschlagen werden.
2. Definieren, in welcher Schicht der Fehler liegt:
   - React-Komponente
   - React-Router-Route / Navigation
   - Frontend-API-Client
   - Express-Route oder Middleware
   - Auth-/Cookie-Handling
   - Zod-Validierung
   - Kysely-Query oder Migrationszustand
   - PostgreSQL-Schema oder Daten
   - Docker-Compose / Environment / Service-Kommunikation
3. Root Cause klar benennen.
4. Die kleinste sichere Korrektur bevorzugen.
5. Mögliche Regressionen im Umfeld prüfen.

**Besonders prüfen**
- React Router params, redirects, navigation state
- fehlerhafte Effects oder Render-Schleifen
- falsche API-Base-URL
- fehlende `credentials`-Konfiguration bei Cookie-Auth
- JWT-Cookie wird nicht gesetzt, nicht gesendet, falsch gelöscht oder falsch geprüft
- Middleware-Reihenfolge in Express
- fehlende Async-Fehlerbehandlung
- Zod-Schema stimmt nicht mit Payload überein
- Kysely-Resultat passt nicht zur erwarteten Verwendung
- Code und Migrationen sind nicht synchron
- falsche Tenant-Konfiguration oder falsche Ziel-DB
- Docker-Service-Reihenfolge, Netzwerk oder Env Vars

**Erwartetes Ergebnis**
- Klare Root-Cause-Erklärung
- kleiner, gezielter Fix
- kurze Risikoprüfung
- wenn sinnvoll: Regressionstest ergänzen

---

## Skill: testing-react-express

**Wann verwenden**
Beim Erstellen, Überarbeiten oder Ergänzen von Tests für Frontend- oder Backend-Verhalten.

**Typische Trigger**
- neuer Bugfix
- fehlende Testabdeckung
- instabile Route
- Login-/Logout-Änderung
- Validierungslogik
- geschützte Route
- Service-Logik
- Fehlerpfade

**Grundsätze**
1. Teste beobachtbares Verhalten, nicht Implementierungsdetails.
2. Ergänze nach Bugfixes bevorzugt einen Regressionstest.
3. Tests sollen schnell, deterministisch und lesbar sein.
4. Frontend- und Backend-Verantwortung nur dann koppeln, wenn ein echter Integrationstest nötig ist.

**Frontend-Fokus**
- Rendering von Routen
- Navigation
- Formulare und Validierungsfeedback
- Loading-, Empty-, Success- und Error-States
- Redirects
- geschützte UI-Pfade

**Backend-Fokus**
- Zod-Validierung
- Auth- und Berechtigungsprüfung
- Erfolgs- und Fehlerantworten
- Service-Verhalten
- tenant-bezogene Logik
- DB-abhängige Entscheidungen

**Hochrisikofälle**
- Login / Logout / Session-Ablauf
- Cookie-basierte JWT-Flows
- Rollen- oder Rechteprüfung
- Zugriff auf falsche Schule / falsche Tenant-Daten
- invalid / empty / unauthorized cases
- Write-Pfade und Transaktionslogik

**Erwartetes Ergebnis**
- richtige Testebene gewählt
- Success- und Failure-Path geprüft
- Edge Cases erfasst
- bei verbleibendem Risiko: Lücke explizit benennen

---

## Skill: reviewing-fullstack-school-platform

**Wann verwenden**
Bei Code Review, PR-Review, Risikoanalyse oder Architekturprüfung.

**Review-Prioritäten**
1. Korrektheit
2. Auth- und Datensicherheit
3. Tenant-Isolation
4. Wartbarkeit
5. Performance
6. Nebenaspekte / Politur

**Prüfkatalog**

### 1. Korrektheit
- Löst die Änderung das eigentliche Problem?
- Sind Null-, leer-, invalid- und unauthorized-Fälle behandelt?
- Entstehen Seiteneffekte in benachbarten Pfaden?

### 2. Frontend
- Ist das Routing korrekt?
- Ist Formularverhalten klar und robust?
- Ist die Komponentenverantwortung sauber?
- Wurde unnötige Komplexität eingeführt?

### 3. Backend
- Ist Validierung vorhanden und am richtigen Ort?
- Ist Middleware-Reihenfolge korrekt?
- Werden Async-Fehler sauber behandelt?
- Ist Geschäftslogik von Route-Glue getrennt?

### 4. Auth und Sicherheit
- Wird Autorisierung serverseitig erzwungen?
- Sind Cookie-Flows korrekt?
- Werden sensitive Daten geschützt?
- Wird nichts allein im Frontend abgesichert, was Backend-Schutz braucht?

### 5. Datenbank und Kysely
- Ist die Query fachlich korrekt?
- Sind Joins, Filter, Limits, Pagination und Sortierung plausibel?
- Wurde der teilweise migrierte Zustand berücksichtigt?
- Fehlen Transaktionen?
- Gibt es Risiko für falsche DB-Ziele oder Tenant-Verwechslung?

### 6. Betrieb und Deployment
- Braucht die Änderung neue Env Vars?
- Braucht sie Migrationen?
- Muss die Reihenfolge von Deploy und Migration beachtet werden?
- Gibt es Risiko für ein einzelnes Schul-Deployment?

**Review-Ausgabeformat**
- Kritische Probleme
- Wichtige Korrekturen
- Mittlere Risiken
- Kleine Verbesserungen

---

## Skill: refactoring-react-express-kysely

**Wann verwenden**
Bei Refactoring von React-Komponenten, Express-Routen, Services, Validierung oder Datenzugriff.

**Ziele**
- Komplexität senken
- Lesbarkeit verbessern
- Typensicherheit erhöhen
- Duplikate reduzieren
- Testbarkeit verbessern
- schrittweise Kysely-Migration erleichtern

**Regeln**
1. Verhalten zuerst erhalten.
2. Kleine, reviewbare Schritte bevorzugen.
3. Keine cleveren Abstraktionen ohne klaren Nutzen.
4. Geschäftslogik aus Express-Routen herausziehen.
5. React-Komponenten auf Rendering und Interaktion fokussieren.
6. Wiederholte Validierungs-, Auth- oder Query-Logik gezielt zentralisieren.
7. Risiko bei Teilmigration aktiv mitdenken.

**Typische Refactor-Ziele**
- zu große React-Komponenten
- gemischte UI- und Datenlogik
- wiederholte Fetch-/Form-Patterns
- Express-Routen mit zu viel Logik
- wiederholte Zod-Schemas oder Parsing-Muster
- unklare Tenant-Auflösung
- inkonsistente DB-Zugriffe
- schwach typisierte Rückgabeformen

**Bevorzugte Richtung**
- UI bleibt im Frontend
- Routing bleibt dünn
- Business-Logik liegt in Services
- DB-Logik ist explizit und konsistent
- Auth und Tenant-Auflösung sind wiederverwendbar und klar sichtbar

---

## Skill: working-with-kysely-postgres-changes

**Wann verwenden**
Bei Änderungen an PostgreSQL, Kysely, Migrationen, Query-Verhalten, Indizes, Transaktionen oder Daten-Backfills.

**Projektbesonderheiten**
- PostgreSQL 16
- Kysely nur teilweise eingeführt
- Falsche DB-Änderungen können einzelne Schulsysteme brechen
- Tenant-Isolation ist wichtiger als Geschwindigkeit

**Regeln**
1. DB-Änderungen explizit, klein und überprüfbar halten.
2. Teilmigration als Risikofaktor behandeln.
3. Schema, Runtime-Code und Typen synchron halten.
4. Niemals stillschweigend annehmen, dass alle Tenant-Umgebungen identisch sind.

**Prüfschritte**

### 1. Änderungsart bestimmen
- Schemaänderung
- Migration
- Query-Rewrite
- Transaktionsänderung
- Index-/Performance-Änderung
- Backfill

### 2. Schemaänderungen
- genaue Form definieren
- Nullability prüfen
- Defaults prüfen
- Rückwärtskompatibilität prüfen
- Backfill-Bedarf benennen

### 3. Migrationen
- wenn möglich reversibel
- destruktive Änderungen nur mit klarer Begründung
- Reihenfolge zwischen Migration und Anwendungscode nennen
- Rollout- oder Verifikationsschritte notieren

### 4. Kysely-Queries
- Query-Absicht soll klar lesbar sein
- Joins dürfen nicht unbemerkt Zeilen multiplizieren
- Filter, Sortierung, Limits und Pagination prüfen
- Selektion muss zur späteren Nutzung passen
- Transaktionen bei mehrteiligen Schreibvorgängen prüfen

### 5. Teilmigration
- angrenzende Legacy-Pfade berücksichtigen
- keine inkonsistenten Zugriffs-Patterns einführen
- berührte Bereiche wenn möglich vereinheitlichen, ohne Scope unnötig aufzublähen

**Erwartetes Ergebnis**
- sichere Änderung
- betroffene Routen/Services identifiziert
- Typen angepasst
- Tests ergänzt oder Lücken benannt
- Deployment-/Migrationsreihenfolge dokumentiert

---

## Skill: working-with-auth-validation-and-cookies

**Wann verwenden**
Bei Änderungen an Authentifizierung, Autorisierung, Cookie-Handling, Session-Flows oder Zod-Validierung.

**Projektbesonderheiten**
- JWT liegt in einem httpOnly Cookie
- Zod validiert externe Eingaben
- Fehler in diesem Bereich sind hochkritisch

**Regeln**
1. Auth- und Validierungsänderungen immer als Hochrisiko behandeln.
2. Autorisierung ausschließlich serverseitig absichern.
3. Cookie-Verhalten explizit betrachten.
4. Eingaben an Backend-Grenzen validieren.
5. Berechtigungsprüfungen nah an den geschützten Aktionen halten.

**Prüfschritte**

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

**Erwartetes Ergebnis**
- korrekter serverseitiger Schutz
- konsistente Validierung
- stabiler Login-/Logout-/Session-Flow
- keine Leaks sensibler Daten

---

## Skill: deploying-single-tenant-school-stack

**Wann verwenden**
Bei Deployment-, Rollout-, Docker-Compose-, Konfigurations- oder Migrationsarbeit.

**Wichtiger Hinweis**
Deployment-Arbeit ist bewusst und risikobehaftet. Beschreibe Schritte explizit und vermeide implizite Annahmen.

**Projektbesonderheiten**
- Docker Compose mit Frontend, Backend und PostgreSQL
- jede Schule läuft separat
- jede Schule hat eigenen VPS und eigene DB
- Fehler können Verfügbarkeit, Auth oder DB-Zuordnung beschädigen

**Regeln**
1. Rollout-Schritte explizit formulieren.
2. Env Vars und Secrets klar benennen.
3. Migrationsreihenfolge vor Deployment prüfen.
4. Tenant-spezifische Konfiguration als Hochrisiko behandeln.
5. Wenn möglich immer Rollback-Pfad nennen.

**Prüfschritte**

### 1. Betroffene Services
- Frontend
- Backend
- Datenbank

### 2. Konfiguration
- Env Vars
- Host-/Netzwerkannahmen
- Cookie-/Domain-Verhalten
- DB-Connection
- Mail-Konfiguration

### 3. Migrationen
- ist eine Migration nötig?
- muss Code vor oder nach Migration deployt werden?
- braucht es Backfill oder manuelle Verifikation?

### 4. Tenant-Sicherheit
- richtige Schule / richtige Umgebung
- richtige DB
- keine versehentliche Wiederverwendung tenant-fremder Konfiguration

### 5. Ausgabe
- Deployment-Zusammenfassung
- exakte Rollout-Schritte
- Verifikationsschritte
- Rollback-Hinweise

---

## Arbeitsstil für Claude Code in diesem Projekt

Wenn du in diesem Repository arbeitest, beachte zusätzlich:

1. Bei unklaren Fehlern zuerst eingrenzen, dann ändern.
2. Bei DB-nahen Änderungen immer auch an Migrationen, Typen und angrenzende Legacy-Pfade denken.
3. Bei Auth-Änderungen immer das Zusammenspiel aus:
   - Frontend Request
   - Cookie-Verhalten
   - Express Middleware
   - Token-Prüfung
   - serverseitiger Autorisierung
   zusammen betrachten.
4. Bei Reviews und Refactors Tenant-Isolation aktiv als Prüfpunkte aufnehmen.
5. Bei Tests Verhalten priorisieren:
   - Frontend sichtbar
   - Backend fachlich
   - Auth und Fehlerpfade robust
6. Bei Logging mit Pino:
   - Logs zur Ursachenanalyse nutzen
   - keine sensiblen Tokens, Cookies oder vertraulichen Nutzdaten leaken
7. Bei Deployment- oder Migrationsarbeit:
   - Reihenfolge benennen
   - Risiken benennen
   - Verifikation benennen
   - Rollback benennen, wenn möglich

## Standard-Ausgabepräferenzen

Bei Analyse, Review oder Änderungsvorschlägen:

1. Erst kurz Problem oder Ziel benennen.
2. Dann Root Cause oder Risikobereich erklären.
3. Dann die kleinste sinnvolle Änderung vorschlagen.
4. Danach betroffene Randbereiche und mögliche Regressionen nennen.
5. Wenn sinnvoll, passende Tests oder Verifikation ergänzen.

## Nicht bevorzugt in diesem Projekt

- unnötig breite Refactors
- neue Abstraktionen ohne klaren Nutzen
- rein frontend-seitige Sicherheitsannahmen
- implizite DB-Annahmen trotz Teilmigration
- Deployments ohne explizite Reihenfolge
- "magische" Änderungen ohne Erklärung des Risikos
