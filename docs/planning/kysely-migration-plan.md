# Kysely-Migration + Codehygiene + Security — 10-Tage-Plan

> Erstellt: 2026-03-30
> Status: Aktiv
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

- [ ] `npm install kysely pg kysely-codegen` im Backend
- [ ] Kysely-Instanz konfigurieren (`backend/db/database.ts`)
- [ ] `kysely-codegen` → `backend/db/types.ts` (auto-generiert)
- [ ] Bestehenden `query()`-Helper als Kompatibilitäts-Wrapper behalten
- [ ] Smoke-Test: eine Query mit Kysely + Type-Check
- [ ] Review: Prüfer + Wächter

## Tag 2: Migrations-System ersetzen

- [ ] `000_baseline.sql`: komplettes Schema aus allen 62 Migrations
- [ ] Kysely-Migrator einrichten (Up + Down)
- [ ] `migrate.js` anpassen: Kysely-Migrator, Baseline-Erkennung
- [ ] Seed-Daten extrahieren → `backend/db/seed.sql`
- [ ] Erste neue Migration (001): `ssw_counselors.created_at NOT NULL`, `teachers.email` Index
- [ ] Review: DB-Analyst + Prüfer

## Tag 3: auth.js auf Kysely + Security-Härtung

- [ ] `auth.js` Login/Verify/Logout → Kysely (kein `SELECT *`, kein `password_hash` im Result)
- [ ] Seed-Skript: Klartext-Passwort-Logging entfernen
- [ ] `settings` RLS-Policies einschränken
- [ ] Review: Wächter + Prüfer + Tests

## Tag 4: Admin-Routes umstellen + Codehygiene

- [ ] `eventsRoutes.js` → Kysely
- [ ] `slotsRoutes.js` → Kysely
- [ ] `bookingRoutes.js` → Kysely
- [ ] `settingsRoutes.js` → Kysely + toter Code entfernen
- [ ] `teachers/crud.js` → Kysely + `generateTeacherUsername` Duplikat konsolidieren
- [ ] Review: Prüfer + Konsistenzprüfer

## Tag 5: Modul-Routes umstellen + Duplikate eliminieren

- [ ] `counselorService.js` (Shared Kernel SSW/BL) → Kysely
- [ ] `counselorAdminRoutes.js` → Kysely
- [ ] `counselorPublicRoutes.js` → Kysely + Phone-Regex-Validierung
- [ ] Weekly-Schedule-Upsert deduplizieren
- [ ] `public.js` (519 Zeilen) in 4 Dateien aufteilen
- [ ] Review: Prüfer + Hygieniker

## Tag 6: Flow + Teacher-Routes umstellen

- [ ] Flow-Services (5 Dateien) → Kysely
- [ ] Flow-Routes (8 Dateien) → Kysely
- [ ] Teacher-Routes → Kysely
- [ ] 24 Catch-Blöcke ohne `logger.error` fixen
- [ ] Toter Code entfernen: `teacherSystem`, `buildHalfHourWindows`
- [ ] Alten `query()`-Helper entfernen (wenn alle migriert)
- [ ] Review: Prüfer + Hygieniker + Testmeister

## Tag 7: Security-Hardening

- [ ] Vollständiger Wächter-Scan
- [ ] Rate-Limit-Konsolidierung (`/api/health`, `/api/dev`)
- [ ] `flow_aktivitaet` Retention-Cleanup
- [ ] Zombie-Tabellen `bl_topics`/`ssw_categories` bereinigen
- [ ] RLS-Audit aller PII-Tabellen
- [ ] Review: Wächter + Prüfer

## Tag 8: DSGVO-Fixes

- [ ] Automatisierte Löschfristen prüfen/implementieren
- [ ] E-Mail-Abmeldelink implementieren
- [ ] `audit_log.details` JSONB PII-Minimierung prüfen
- [ ] Consent-Receipts Vollständigkeitsprüfung
- [ ] DSAR-Endpunkte testen (Art. 15-21)
- [ ] Review: Wächter + DB-Analyst + Dokumentar

## Tag 9: Dependency-Updates + Finaler Scan

- [ ] `npm audit fix`
- [ ] Dependencies auf aktuelle Versionen prüfen
- [ ] Finaler Wächter-Scan
- [ ] Finaler Hygieniker-Scan
- [ ] Build-Test: `docker compose build` + `npm run build`
- [ ] Review: Wächter + Hygieniker + Konsistenzprüfer

## Tag 10: Dokumentation + Abschluss

- [ ] `docs/architecture/system-design.md` aktualisieren
- [ ] Neuen Security-Audit-Bericht schreiben
- [ ] `docs/compliance/dsgvo-saas-todo.md` Status aktualisieren
- [ ] Alle Backlog-Dateien bereinigen
- [ ] `CHANGELOG.md` erstellen
- [ ] Kysely-Migration-Guide schreiben
- [ ] Review: Dokumentar
