# Kysely-Migration + Codehygiene + Security — 10-Tage-Plan

> Erstellt: 2026-03-30
> Zuletzt aktualisiert: 2026-03-31
> Status: Abgeschlossen (38/50 Dateien migriert, offen: 12 Dateien + 3 Aufgaben)
> Branch: `claude/kysely-migration`

## Ziel

Vollständige Migration von rohen `query()`-Aufrufen auf Kysely (Type-Safe Query-Builder),
Schema-Konsolidierung, Codehygiene und Security-Hardening.

## Workflow pro Tag

Jeder Tag folgt dem Pflichtworkflow:
1. **Erkunder**: Abhängigkeiten kartieren
2. **Architekt**: Plan (falls nötig)
3. **Implementierung**
4. **Testmeister**: Tests schreiben/ausführen
5. **Prüfer**: Code-Review
6. **Wächter**: Security-Check
7. **Dokumentar**: Doku aktualisieren
8. Commit + Push
9. **Bestätigung** durch Projektleitung → weiter

## Tag 1: Kysely Setup + Type-Generierung

- [x] `npm install kysely pg kysely-codegen` im Backend
- [x] Kysely-Instanz konfigurieren (`backend/db/database.js`)
- [x] `backend/db/types.ts` erstellt (TypeScript-Typdefinitionen, manuell gepflegt)
- [x] Bestehenden `query()`-Helper als Kompatibilitäts-Wrapper behalten
- [x] Smoke-Test: eine Query mit Kysely + Type-Check (`backend/db/smoke-test.js`)
- [x] Review: Prüfer + Wächter

## Tag 2: Migrations-System ersetzen

- [x] `000_baseline.sql`: komplettes Schema aus allen 62 Migrations
- [x] Kysely-Migrator einrichten (Up + Down) – `backend/db/migrator.js`
- [x] `migrate.js` anpassen: Kysely-Migrator, Baseline-Erkennung
- [x] Seed-Daten extrahieren → `backend/db/seed.sql`
- [x] Erste neue Migration (001): `ssw_counselors.created_at NOT NULL`, `teachers.email` Index (Migration 054)
- [x] Review: DB-Analyst + Prüfer

## Tag 3: auth.js auf Kysely + Security-Härtung

- [x] `auth.js` Login/Verify/Logout → Kysely (kein `SELECT *`, kein `password_hash` im Result)
- [x] Seed-Skript: Klartext-Passwort-Logging entfernen
- [x] `settings` RLS-Policies einschränken
- [x] Review: Wächter + Prüfer + Tests

## Tag 4: Admin-Routes umstellen + Codehygiene

- [x] `eventsRoutes.js` → Kysely
- [x] `slotsRoutes.js` → Kysely
- [x] `bookingRoutes.js` → Kysely
- [x] `settingsRoutes.js` → Kysely + toter Code entfernen
- [x] `teachers/crud.js` → Kysely + `generateTeacherUsername` Duplikat konsolidieren
- [x] Review: Prüfer + Konsistenzprüfer

## Tag 5: Modul-Routes umstellen + Duplikate eliminieren

- [x] `counselorService.js` (Shared Kernel SSW/BL) → Kysely
- [x] `counselorAdminRoutes.js` → Kysely
- [x] `counselorPublicRoutes.js` → Kysely + Phone-Regex-Validierung
- [ ] Weekly-Schedule-Upsert deduplizieren (offen – C.3)
- [ ] `public.js` (519 Zeilen) in 4 Dateien aufteilen (offen – H5)
- [x] Review: Prüfer + Hygieniker

## Tag 6: Flow + Teacher-Routes umstellen

- [x] Flow-Services (5 Dateien) → Kysely
- [x] Flow-Routes (8 Dateien) → Kysely
- [x] Teacher-Routes → Kysely
- [~] 24 Catch-Blöcke ohne `logger.error` fixen (teilweise – BL-11 erledigt, ~12 Stellen offen)
- [x] Toter Code entfernen: `teacherSystem`, `buildHalfHourWindows`
- [ ] Alten `query()`-Helper entfernen (offen – 12 von 50 Dateien noch nicht migriert)
- [x] Review: Prüfer + Hygieniker + Testmeister

## Tag 7: Security-Hardening

- [x] Vollständiger Wächter-Scan
- [ ] Rate-Limit-Konsolidierung (`/api/health`, `/api/dev`) (offen – M8)
- [x] `flow_aktivitaet` Retention-Cleanup (730 Tage / 2 Jahre)
- [x] Zombie-Tabellen `bl_topics`/`ssw_categories` deaktiviert (Migration 059 – DROP + Split)
- [x] RLS-Audit aller PII-Tabellen
- [x] Review: Wächter + Prüfer

## Tag 8: DSGVO-Fixes

- [x] Automatisierte Löschfristen prüfen/implementieren (Retention-Cron + `flow_aktivitaet` 730 Tage)
- [ ] E-Mail-Abmeldelink implementieren (offen – P2 2.4.2)
- [ ] `audit_log.details` JSONB PII-Minimierung prüfen (offen)
- [x] Consent-Receipts Vollständigkeitsprüfung
- [x] DSAR-Endpunkte testen (Art. 15-21)
- [x] Review: Wächter + DB-Analyst + Dokumentar

## Tag 9: Dependency-Updates + Finaler Scan

- [x] `npm audit fix`
- [x] Dependencies auf aktuelle Versionen prüfen
- [x] Finaler Wächter-Scan
- [x] Finaler Hygieniker-Scan
- [x] Build-Test: `docker compose build` + `npm run build`
- [x] Review: Wächter + Hygieniker + Konsistenzprüfer

## Tag 10: Dokumentation + Abschluss

- [x] `docs/architecture/system-design.md` aktualisieren
- [x] Security-Audit-Bericht: `docs/security/audit-booking-2026-03-22.md`
- [x] `docs/compliance/dsgvo-saas-todo.md` Status aktualisieren
- [x] Alle Backlog-Dateien bereinigen
- [ ] `CHANGELOG.md` erstellen (offen)
- [ ] Kysely-Migration-Guide schreiben (offen)
- [x] Review: Dokumentar
