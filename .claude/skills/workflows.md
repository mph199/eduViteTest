# Skills — eduViteTest

> Wiederverwendbare Workflows die Claude Code automatisieren.
> Aktiviert via `/skillname` oder automatisch bei passendem Kontext.

## /migrate-file

**Trigger:** "Migriere X auf Kysely" oder wenn eine Datei `config/db.js` importiert

Workflow:
1. Lies die Datei komplett
2. Zaehle alle `query()` Aufrufe
3. Ersetze `import { query } from '...config/db.js'` mit `import { db } from '...db/database.js'`
4. Fuer jeden `query()` Aufruf:
   - Simple SELECT → `db.selectFrom('table').select([...]).where(...).execute()`
   - INSERT → `db.insertInto('table').values({...}).execute()`
   - UPDATE → `db.updateTable('table').set({...}).where(...).execute()`
   - DELETE → `db.deleteFrom('table').where(...).execute()`
   - Komplexe Queries (JOINs, Subqueries) → `import { sql } from 'kysely'` + sql Tagged Template
   - Dynamische Tabellennamen → `sql.table(name)` mit `assertSafeIdentifier()` Guard
   - `getClient()` Transaktionen → `db.transaction().execute(async (trx) => { ... })`
5. KEIN `SELECT *` — immer explizite Spalten (kein password_hash, calendar_token_hash)
6. Schreibe die komplette Datei neu

## /routing-check

**Trigger:** "Pruefe Routing fuer User X" oder nach Aenderungen an ProtectedRoute/useAdminNavGroups

Workflow:
1. Definiere User-Profil: `{ role, teacherId, modules, adminModules }`
2. Berechne Flags: `isAdmin`, `isSuperadmin`, `hasAdminModules`, `isAdminOrModuleAdmin`, `hasTeacherId`
3. Fuer jede Route in App.tsx:
   - Spiele ProtectedRoute-Logik durch (allowedRoles, allowedModules, Admin-Bypass)
   - Ergebnis: 'allow' oder Redirect-Ziel
4. Fuer jede Sidebar-Gruppe in useAdminNavGroups:
   - checkModuleAccess → Item-Filter → groupView → filteredGroups
5. Vergleiche: Sidebar zeigt Link ↔ Route erreichbar
6. Melde Mismatches

## /security-scan

**Trigger:** Vor jedem PR oder nach groesseren Aenderungen

Workflow:
1. Suche nach `SELECT *` in allen Backend-Dateien (password_hash Leak)
2. Suche nach String-Interpolation in SQL (`${variable}` in query-Strings)
3. Pruefe ob alle Routen Auth-Middleware haben (ausser Public-Endpunkte)
4. Pruefe ob Public-Endpunkte Rate-Limiting haben
5. Suche nach leeren Catch-Bloecken ohne Logger
6. `npm audit --audit-level=high` (Frontend + Backend)
7. Melde nur KRITISCH und HOCH

## /test-run

**Trigger:** Nach Code-Aenderungen, vor Commits

Workflow:
1. `npx tsc --noEmit --pretty` (Frontend TypeScript)
2. `npx vitest run` (alle Tests)
3. Zusammenfassung: X passed, X failed, X skipped
4. Bei Failures: Zeige Fehler + betroffene Datei

## /pr-check

**Trigger:** Vor PR-Erstellung

Workflow:
1. Pruefe ob offener PR fuer den Branch existiert (`mcp__github__list_pull_requests`)
2. Falls ja: nur pushen, keinen neuen PR erstellen
3. Falls nein: PR erstellen mit:
   - Commits seit main auflisten
   - Diff-Stats
   - Summary + Test-Plan generieren

## /db-migration

**Trigger:** "Neue Migration" oder Schema-Aenderung

Workflow:
1. Naechste freie Migrationsnummer in `backend/db/migrations/` ermitteln
2. Datei erstellen: `NNN_beschreibung.js` mit `up(db)` und `down(db)`
3. `sql` Tagged Templates mit parametrisierten Werten
4. `IF NOT EXISTS` / `IF EXISTS` Guards
5. `backend/db/types.ts` aktualisieren (neue/geaenderte Spalten)
6. `backend/db/000_baseline.sql` aktualisieren (fuer neue Deployments)

## /backlog-update

**Trigger:** Nach Feature-Abschluss oder Sprint-Ende

Workflow:
1. Lies alle Backlog-Dateien:
   - `docs/compliance/dsgvo-saas-todo.md`
   - `docs/security/audit-booking-2026-03-22.md`
   - `docs/planning/kysely-migration-plan.md`
2. Markiere erledigte Items als `[x]`
3. Aktualisiere Fortschritts-Zaehler
4. Aktualisiere `CHANGELOG.md`
