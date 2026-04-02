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

---

# Choice-Modul Skills

> Skills fuer die Implementierung des Moduls „Differenzierungswahl".
> Referenz: `docs/planning/choice-module-plan.md`

## /choice-phase

**Trigger:** "Implementiere Phase X" oder "Starte Phase X des Choice-Moduls"

Zweck: Erzwingt den Pflicht-Agenten-Workflow und standardisiert die Reihenfolge pro Umsetzungsphase.

Workflow:
1. **Phase identifizieren** — Lies `docs/planning/choice-module-plan.md` Abschnitt 10, bestimme welche Phase gemeint ist
2. **Erkunder** — Spawne `erkunder` Agent: betroffene Dateien, Abhaengigkeiten, Seiteneffekte kartieren
3. **Entscheidung: Architekt noetig?**
   - JA wenn: Multi-File-Aenderung, DB-Schema, neuer Service, neues API-Pattern, Strukturaenderung
   - NEIN wenn: einzelne Datei, reines UI-Tweak, Bugfix innerhalb bestehender Struktur
   - Im Zweifel: JA
4. **Architekt** (wenn noetig) — Spawne `architekt` Agent: Dateiliste, Reihenfolge, Contracts
5. **Implementierung** — Backend vor Frontend. Eine logische Aenderung pro Commit
6. **Modulwaechter** — Spawne `modulwaechter` Agent: Registry, Manifest, Routen-Konformitaet pruefen
7. **Pruefer** — Spawne `pruefer` Agent: alle Findings Kritisch/Hoch fixen vor Commit
8. **Build pruefen** — `npm run build` bei Frontend-Aenderungen
9. **Commit + Push** — Conventional Commit Format, Push auf Feature-Branch

Regeln:
- Schritte 2, 6, 7 sind IMMER Pflicht, auch bei kleinen Aenderungen
- Schritt 3+4 duerfen nur uebersprungen werden mit expliziter Begruendung
- Bei Schritt 7 Findings: Fix → erneut pruefen → erst dann committen
- Jede Phase darf mehrere Commits enthalten, aber jeder Commit durchlaeuft Schritt 7

## /choice-crud

**Trigger:** "Erstelle CRUD fuer X im Choice-Modul" oder "Neue Ressource X"

Zweck: Scaffoldet Standard-CRUD fuer eine Choice-Ressource, aber nur nach Pruefung ob Standard-CRUD passt.

Workflow:
1. **Guard — Ist Standard-CRUD angemessen?**
   - Pruefe: Gibt es schon ein aehnliches Pattern im Choice-Modul?
   - Pruefe: Ist die Ressource wirklich einfaches CRUD oder hat sie Speziallogik (Statusmaschine, Validierungsketten)?
   - Pruefe: Braucht es wirklich alle 6 Dateien oder nur eine Teilmenge?
   - Pruefe: Gehoert die Route in `admin.js` oder an anderer Stelle (z.B. `public.js`)?
   - Falls KEIN Standard-CRUD: abbrechen, stattdessen `/choice-change` empfehlen
2. **Zod-Schema** — In `backend/schemas/choice.js` ergaenzen (Create + Update Variante)
3. **Service-Methode** — In `backend/modules/choice/services/choiceService.js`: list, getById, create, update, deactivate
4. **Route** — In `backend/modules/choice/routes/admin.js` (oder `public.js`): GET list, GET :id, POST, PUT :id, POST :id/deactivate
5. **Kysely-Types** — `backend/db/types.ts` pruefen/ergaenzen
6. **Frontend-Type** — In `src/types/index.ts` ergaenzen
7. **API-Client** — In `src/services/api.ts` ergaenzen (mit `credentials: 'include'`)

Regeln:
- KEIN Hard Delete — immer `is_active` / deactivate
- Alle Queries ueber Kysely, explizite Spalten, kein `SELECT *`
- Auth: `requireModuleAdmin('choice')` fuer Admin-Routen
- Response normalisieren zu Array vor `.map()` im Frontend
- Nach Scaffolding: modulwaechter spawnen

## /choice-test

**Trigger:** "Teste Endpoint X" oder "Tests fuer Choice-Route X"

Zweck: Generiert strategisch fundierte Tests fuer einen Choice-Endpoint, basierend auf bestehenden Testmustern.

Workflow:
1. **Endpoint analysieren** — Route, Middleware, Service-Logik, Validierung, DB-Operationen lesen
2. **Bestehende Testmuster suchen** — Grep in `backend/modules/*/tests/`, `backend/__tests__/`, `src/**/*.test.*` nach aehnlichen Patterns
3. **Teststrategie ableiten:**
   - Braucht es Mocking oder DB-nahe Tests?
   - Welche Fixtures/Setup-Daten sind noetig?
   - Welche Edge Cases sind fachlich relevant?
4. **Tests implementieren** (Vitest + Supertest):
   - **Happy Path** — Erfolgreicher Request mit gueltigem Input
   - **Validierungsfehler** — Fehlende/ungueltige Felder (Zod-Rejection)
   - **Auth/Permission** — Ohne Token, falsches Token, falsche Rolle
   - **Not Found** — Unbekannte ID
   - **Fachliche Konflikte** — z.B. Submit bei geschlossener Group, doppelte Prioritaet, inaktive Option
5. **Konsistenz pruefen** — Testdatei-Struktur und Naming muss zu bestehenden Tests passen

Regeln:
- Bestehende Tests im Modul als Vorlage priorisieren, nicht generisch scaffolden
- Keine Tests fuer triviale Getter ohne Logik
- Bei Public-Endpoints: Token/Cookie-Flow mittesten
- Bei Submissions: min/max/ranking-Validierung mittesten

## /choice-change

**Trigger:** "Aendere X im Choice-Modul" oder Aenderungen an bestehender Choice-Logik

Zweck: Sichere Aenderungen an bestehender Choice-Logik — Flows, Status, Berechtigungen, Queries.

Workflow:
1. **Erkunder** — Spawne `erkunder` Agent fuer die betroffene Logik:
   - Welche Dateien sind betroffen?
   - Welche Flows nutzen den geaenderten Code?
   - Gibt es Seiteneffekte auf andere Endpunkte/Services?
2. **Auswirkungsanalyse:**
   - Statusuebergaenge betroffen? → Statusmaschine in `choiceService.js` pruefen
   - DB-Schema betroffen? → Neue Migration noetig?
   - Auth/Berechtigungen betroffen? → Middleware-Kette pruefen
   - Public-Flow betroffen? → Token/Cookie-Logik pruefen
   - Frontend betroffen? → Welche Seiten/Komponenten anpassen?
3. **Implementierung** — Backend vor Frontend, eine logische Aenderung pro Commit
4. **Tests anpassen** — Bestehende Tests aktualisieren, neue Edge Cases ergaenzen
5. **Modulwaechter** — Spawne `modulwaechter` Agent
6. **Pruefer** — Spawne `pruefer` Agent

Regeln:
- Nie Logik aendern ohne vorher den bestehenden Flow vollstaendig gelesen zu haben
- Bei Statusaenderungen: alle Uebergaenge pruefen, nicht nur den geaenderten
- Bei Query-Aenderungen: Performance und Index-Nutzung pruefen
- Bei Public-Aenderungen: Rate-Limiting und Token-Validierung re-pruefen
