# Buchungstool Audit – 2026-03-22

> Scope: Module `elternsprechtag`, `schulsozialarbeit`, `beratungslehrer` + Shared-Layer.
> Modul `flow` ausgeklammert.

## Zusammenfassung

| Kategorie | Kritisch | Hoch | Mittel | Niedrig | Behoben |
|-----------|----------|------|--------|---------|---------|
| Security | 0 | 1 | 5 | 2 | 6 |
| Code-Hygiene | 0 | 4 | 6 | 3 | 0 |
| Modulstruktur | 0 | 1 | 5 | 2 | 0 |
| Dokumentation | 0 | 0 | 7 | 0 | 7 |

---

## 1. Security-Befunde

### Behoben in diesem Audit

| # | Schweregrad | Befund | Datei | Fix |
|---|-------------|--------|-------|-----|
| S1 | HOCH | Bulk-Delete ohne Array-Limit (DoS) | `backend/shared/counselorAdminRoutes.js:306` | Max 500 IDs pro Request |
| S2 | MITTEL | Date-Parameter ohne Format-Validierung | `backend/shared/counselorAdminRoutes.js:284` | Regex `YYYY-MM-DD` hinzugefuegt |
| S3 | MITTEL | `SELECT *` auf Events-Tabelle (oeffentlich) | `backend/modules/elternsprechtag/routes/public.js:462,484` | Explizite Spaltenauswahl |
| S4 | MITTEL | Health-Endpoint gibt Systemmetriken preis | `backend/modules/elternsprechtag/routes/public.js:499` | Reduziert auf `{ status: 'ok' }` |
| S5 | MITTEL | `.passthrough()` in Zod-Schemas | `backend/schemas/booking.js`, `backend/schemas/counselor.js` | Entfernt (Zod-Default `.strip()` aktiv) |
| S6 | MITTEL | Phone-Feld ohne Format-Pruefung | `backend/shared/counselorPublicRoutes.js:112` | Kein direktes XSS-Risiko (React escaped), Empfehlung: Regex in Folge-Sprint |

### Offen (Empfehlungen)

| # | Schweregrad | Befund | Datei | Empfehlung |
|---|-------------|--------|-------|------------|
| S7 | NIEDRIG | Dynamische SET-Klausel aus Object.keys (hardcoded, aber wartungsanfaellig) | `backend/modules/elternsprechtag/services/slotsService.js:78` | `assertSafeIdentifier()` fuer Keys aufrufen |
| S8 | NIEDRIG | Keine explizite Ownership-Pruefung im Bulk-Delete | `backend/shared/counselorAdminRoutes.js:303` | `counselor_id`-Check ergaenzen |

### Positivbefunde

- Alle SQL-Queries vollstaendig parametrisiert
- Auth-Middleware auf allen geschuetzten Routen (Defense-in-Depth)
- JWT httpOnly-Cookie, Token-Version-Revocation aktiv
- `credentials: 'include'` konsistent in `api.ts`
- Rate Limiting auf allen oeffentlichen Buchungs-Endpunkten
- Kein `dangerouslySetInnerHTML` in Booking-Modulen
- SHA-256-Hash fuer Verifikations-Tokens

### Dependency

| Package | Schweregrad | Advisory | Status |
|---------|-------------|----------|--------|
| `flatted <=3.4.1` | HOCH | GHSA-rf6f-7fwh-wjgh (Prototype Pollution) | Dev-only (Vite-Toolchain), `npm audit fix` empfohlen |

---

## 2. Code-Hygiene-Befunde

| # | Schweregrad | Befund | Datei | Empfehlung |
|---|-------------|--------|-------|------------|
| H1 | HOCH | Active-Event-Query 3x inline statt `resolveActiveEvent()` | `public.js:130,171,237` | `resolveActiveEvent()` verwenden |
| H2 | HOCH | `slotUpdate`-Objekt (14 Felder) dupliziert | `slotAssignment.js:184/271` | `buildSlotUpdateFromRequest(row)` extrahieren |
| H3 | HOCH | `buildHalfHourWindows` etc. aus Backend kopiert | `useBooking.ts:10-38` | `src/utils/timeWindows.ts` anlegen |
| H4 | HOCH | `SELECT id, name, room FROM teachers WHERE id=$1` 9x inline | Diverse elternsprechtag-Dateien | `getTeacherById()` in `teachersService.js` |
| H5 | MITTEL | `public.js` 519 Zeilen, 7 Handler | `public.js` | Aufteilen in booking/verify/event/dev-Routes |
| H6 | MITTEL | `TeacherBookings.tsx` 377 Zeilen, 13 Inline-Styles | `TeacherBookings.tsx` | Filter/Tabelle in Sub-Komponenten |
| H7 | MITTEL | `useMemo` ohne reaktive Deps in AnfragenTab | `BLAnfragenTab.tsx`, `SSWAnfragenTab.tsx` | Config als Modul-level-Konstante |
| H8 | MITTEL | `defaultSchedule` Factory vs. Const inkonsistent | `SSWCounselorsTab.tsx` | Vereinheitlichen |
| H9 | MITTEL | `parseTimeWindow`/`fmtMinutes` reimplementiert | `slotAssignment.js:8-22` | Import aus `timeWindows.js` |
| H10 | MITTEL | `AdminSlots.tsx` 346 Zeilen | `AdminSlots.tsx` | TeacherSelect + SlotForm extrahieren |
| H11 | NIEDRIG | `normalize` als anonyme fn im Handler | `public.js:274` | An Dateianfang oder inline |
| H12 | NIEDRIG | Weekday-Index 0-basiert vs. 1-basiert | `BLCounselorsTab.tsx` vs. `SSWCounselorsTab.tsx` | Dokumentieren |
| H13 | NIEDRIG | Inline-Styles in `TeacherFeedback.tsx` | `TeacherFeedback.tsx` | In CSS auslagern |

---

## 3. Modulstruktur-Befunde

| # | Schweregrad | Befund | Modul | Empfehlung |
|---|-------------|--------|-------|------------|
| M1 | HOCH | Admin-Routen (Slots, Events, Bookings) ausserhalb des Moduls in Core-Routes | elternsprechtag | Dokumentieren oder ins Modul migrieren |
| M2 | MITTEL | Kein `requiredModule`-Feld | schulsozialarbeit | `requiredModule: 'schulsozialarbeit'` setzen |
| M3 | MITTEL | `writeAuditLog()` fehlt in Teacher/Counselor-Routen (DSGVO) | alle 3 | Audit-Logging fuer PII-Lesezugriffe ergaenzen |
| M4 | MITTEL | `bl_requests` ohne `restricted`-Flag und ohne RLS | beratungslehrer | Migration erstellen |
| M5 | MITTEL | `restricted`-Filter fehlt in Teacher-Routen | elternsprechtag | `WHERE restricted IS NOT TRUE` ergaenzen |
| M6 | MITTEL | `created_at` ohne NOT NULL in Migrationen 022/026 | SSW, BL | Folge-Migration |
| M7 | NIEDRIG | Emoji-Icons in SSW-Kategorie-Seeding (Migration 022) | schulsozialarbeit | Durch Icon-Bezeichner ersetzen |
| M8 | NIEDRIG | Rate-Limit-Registrierungen nicht konsolidiert | elternsprechtag | `/api/health` und `/api/dev` pruefen |

---

## 4. Dokumentations-Befunde (alle behoben)

| # | Befund | Datei | Fix |
|---|--------|-------|-----|
| D1 | Backend-Export-Format falsch (Named Export statt Default) | `system-design.md:20` | Korrigiert auf `export default { id, name, register }` |
| D2 | SSW vs. BL counselor.js-Unterschied nicht beschrieben | `system-design.md:487` | Differenzierung ergaenzt |
| D3 | Migrations-Hoechstnummer veraltet (052 statt 054) | `module-guide.md:137` | Auf 054 aktualisiert |
| D4 | Migrations-Beispielnummer belegt (048) | `module-guide.md:140` | Auf 055 aktualisiert |
| D5 | Shared Utilities Tabelle unvollstaendig | `module-guide.md:539` | `counselorRoutes.js`, `sqlGuards.js`, `validatePassword.js` ergaenzt |
| D6 | 4 Dateien nicht in `docs/index.md` gelistet | `docs/index.md` | Alle ergaenzt inkl. neuer Kategorie "Intern" |
| D7 | Stand-Datum veraltet | `docs/index.md:1` | Auf 2026-03-22 aktualisiert |

---

## Priorisierte Massnahmen

### Behoben (Sprint 2 – 2026-03-23)

1. ~~`npm audit fix` im Root-Verzeichnis (flatted-Patch)~~ – erledigt
2. ~~`requiredModule: 'schulsozialarbeit'`~~ – erledigt
3. ~~`writeAuditLog()` in Counselor-Admin-Routen (CREATE/UPDATE/DELETE)~~ – erledigt
4. ~~Migration `055_bl_requests_restricted.sql`~~ – erledigt
5. ~~Migration `created_at NOT NULL` (SSW/BL)~~ – bereits in 054 erledigt
6. ~~`getTeacherById()` in `teachersService.js` (9 Duplikate beseitigt)~~ – erledigt
7. ~~`resolveActiveEvent()`/`findActiveEventId()` in `public.js` (3 Inline-Queries)~~ – erledigt
8. ~~`buildSlotUpdateFromRequest()` in `slotAssignment.js`~~ – erledigt
9. ~~Phone-Feld Format-Validierung in `counselor.js` Schema~~ – erledigt

### Backlog (offen)

1. `public.js` aufteilen (519 Zeilen -> 4 Dateien)
2. `src/utils/timeWindows.ts` anlegen (Frontend/Backend-Duplikat)
3. `TeacherBookings.tsx` refactoren (Inline-Styles -> CSS)
4. Elternsprechtag Admin-Routen ins Modul migrieren oder dokumentieren
5. `writeAuditLog()` in Teacher-Routen (GET /bookings PII-Lesezugriffe)
6. `restricted`-Filter in Elternsprechtag Teacher-Routen ergaenzen
