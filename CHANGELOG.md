# Changelog

## 2026-03-31 — Kysely-Migration (100%) + Security + Codehygiene + Sidebar-Rework

> Branch: `claude/kysely-migration`
> 34 Commits, 50/50 Dateien migriert

### Datenbank

- **Kysely Query Builder** als primaere DB-Schicht — 50/50 Backend-Dateien migriert (100%)
- **Baseline-Schema** (`000_baseline.sql`) konsolidiert 62 Legacy-Migrationen
- **Kysely-Migrator** mit Up+Down-Support (`backend/db/migrator.js`)
- DB-Type-Definitionen fuer alle 35+ Tabellen (`backend/db/types.ts`)
- Neue Migrations: Schema-Hygiene (NOT NULL, Index), Zombie-Tabellen-Cleanup, RLS-Fixes
- `migrate.js` Dual-Mode: Legacy SQL (001-062) + Kysely-Migrationen
- Seed-Daten extrahiert (`backend/db/seed.sql`)
- Zero `query()` Aufrufe in Produktiv-Code verbleibend

### Security

- JWT-Secret: `SESSION_SECRET`-Fallback entfernt (nur `JWT_SECRET` akzeptiert)
- `SELECT *` durch explizite Spaltenlisten ersetzt (kein Leak von `password_hash`, `calendar_token_hash`, `verification_token_hash`)
- SQL-Injection-Praevention: Fragile Platzhalter-Interpolation durch Kysely-Builder ersetzt
- Phone-Feld: Regex-Validierung + 30-Zeichen-Limit
- RLS: `events` Policy + `slots` ENABLE RLS ergaenzt
- 14 leere Catch-Bloecke mit `logger.debug`/`logger.warn` versehen
- npm: 0 Vulnerabilities (Frontend + Backend)

### DSGVO

- `flow_aktivitaet` Retention-Cleanup: 730 Tage (konfigurierbar via `RETENTION_FLOW_AKTIVITAET_DAYS`)
- `ssw/bl_appointments` expired-Pfad: Status-Filter `!= 'cancelled'` ergaenzt
- Zombie-Tabellen (`bl_topics`, `ssw_categories`) deaktiviert
- Dateninventar aktualisiert (`flow_aktivitaet` → 730 Tage automatisch)
- Seed-Skript: Klartext-Passwort-Logging entfernt

### Codehygiene

- `public.js` (500 Zeilen) in 4 fokussierte Dateien aufgeteilt (`slots.js`, `bookings.js`, `events.js`, `misc.js`)
- 9 tote `db`-Imports entfernt
- Toter Code entfernt: `teacherSystem`, `buildHalfHourWindows` (C.7)
- Alle Test-Mocks auf Kysely aktualisiert

### Frontend — Sidebar-Rework

- **Permanente Sticky-Sidebar** (220px) fuer Admin/Teacher/Superadmin-Bereich
- **ViewSwitcher** (Admin/Lehrkraft) mit korrektem Routing fuer Modul-Admins
- **SidebarProfile** (Avatar, Passwort aendern, Logout) im Sidebar-Footer
- **Lucide-Icons** fuer alle Sidebar-Items
- **960px Layout-Constraint** auf allen Subpages (linkbuendig, nicht zentriert)
- **Logo** ueber Sidebar-Breite ausgerichtet
- **Breakpoint-Konsolidierung**: 900px/980px → 1024px
- Superadmin in globale Sidebar integriert (eigene Sidebar entfernt)

### Routing-Fixes

- Elternsprechtag `requiredModule` gesetzt → Modul-Admins koennen Events/Slots verwalten
- Backend: Events/Slots-Routen auf `requireModuleAdmin('elternsprechtag')`
- SSW-Berater ohne teacherId: Sidebar nicht mehr leer
- BL-Berater: Link in Sidebar sichtbar
- Neue Lehrkraefte: `/teacher` wieder erreichbar (Regression-Fix)
- BL-Admin-Seite vereinfacht (nur Uebersicht + Sprechzeiten)

### Tests

- **89 Tests** bestehen, 0 skipped, 0 failed
- Frontend: 28 Nav-Tests (8 User-Typen) + 5 Route-Access-Tests
- Backend: 56 Tests (DSGVO, Security, Services, Calendar)
- Alle Test-Mocks auf Kysely aktualisiert (consent, retention, calendarToken, dataSubject)
- 0 npm Vulnerabilities

### Dokumentation

- 10-Tage-Migrationsplan dokumentiert und abgehakt
- Security-Audit-Bericht 2026-03-30
- Backend-Rules: Kysely als bevorzugte Query-Methode
- Frontend-Rules: 960px Layout-Constraint dokumentiert
- DSGVO-Fortschritt: 69% → 71%
