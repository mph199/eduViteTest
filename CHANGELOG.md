# Changelog

## 2026-03-30 — Kysely-Migration + Security-Hardening + Sidebar-Rework

### Datenbank

- **Kysely Query Builder** eingeführt — type-safe Queries ersetzen rohe `query()` Aufrufe
- 38 von 50 Backend-Dateien vollständig auf Kysely migriert
- **Baseline-Schema** (`000_baseline.sql`) konsolidiert 62 Legacy-Migrationen
- **Kysely-Migrator** mit Up+Down-Support (neben Legacy-Migrator für Abwärtskompatibilität)
- DB-Type-Definitionen für alle 35+ Tabellen (`backend/db/types.ts`)
- Neue Migrations: Schema-Hygiene (NOT NULL, Index), Zombie-Tabellen-Cleanup, RLS-Fixes

### Security

- JWT-Secret: `SESSION_SECRET`-Fallback entfernt (nur `JWT_SECRET` akzeptiert)
- `SELECT *` durch explizite Spaltenlisten ersetzt (verhindert Leak von `password_hash`, `calendar_token_hash`, `verification_token_hash`)
- SQL-Injection-Prävention: Fragile Platzhalter-Interpolation durch Kysely-Builder ersetzt
- Phone-Feld: Regex-Validierung + 30-Zeichen-Limit
- RLS: `events` Policy + `slots` ENABLE RLS ergänzt
- npm: 0 Vulnerabilities (Frontend + Backend)

### DSGVO

- `flow_aktivitaet` Retention-Cleanup: 730 Tage (konfigurierbar)
- `ssw/bl_appointments` expired-Pfad: Status-Filter ergänzt
- Zombie-Tabellen (`bl_topics`, `ssw_categories`) deaktiviert
- Dateninventar aktualisiert (`flow_aktivitaet` → 730 Tage automatisch)
- Seed-Skript: Klartext-Passwort-Logging entfernt

### Frontend — Sidebar-Rework

- **Permanente Sticky-Sidebar** (220px) für Admin/Teacher/Superadmin-Bereich
- **ViewSwitcher** (Admin/Lehrkraft) mit korrektem Routing für Modul-Admins
- **SidebarProfile** (Avatar, Passwort ändern, Logout) im Sidebar-Footer
- **Lucide-Icons** für alle Sidebar-Items
- **960px Layout-Constraint** auf allen Subpages (linksbündig, nicht zentriert)
- **Logo** über Sidebar-Breite ausgerichtet
- **Breakpoint-Konsolidierung**: 900px/980px → 1024px
- Superadmin in globale Sidebar integriert (eigene Sidebar entfernt)

### Routing-Fixes

- Elternsprechtag `requiredModule` gesetzt → Modul-Admins können Events/Slots verwalten
- Backend: Events/Slots-Routen auf `requireModuleAdmin('elternsprechtag')`
- SSW-Berater ohne teacherId: Sidebar nicht mehr leer
- BL-Berater: Link in Sidebar sichtbar
- Neue Lehrkräfte: `/teacher` wieder erreichbar (Regression-Fix)
- BL-Admin-Seite vereinfacht (nur Übersicht + Sprechzeiten)

### Tests

- **Vitest** für Frontend eingerichtet
- 28 Frontend-Tests (Nav-Logik für 8 User-Typen + Route-Access)
- 56 Backend-Tests (84 gesamt mit Frontend, 5 skipped/stale)
- 0 npm vulnerabilities

### Dokumentation

- 10-Tage-Migrationsplan dokumentiert
- Security-Audit-Bericht 2026-03-30
- Backend-Rules: Kysely als bevorzugte Query-Methode
- Frontend-Rules: 960px Layout-Constraint dokumentiert
- DSGVO-Dateninventar aktualisiert
