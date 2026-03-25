# Buchungstool Audit – 2026-03-22

> Scope: Module `elternsprechtag`, `schulsozialarbeit`, `beratungslehrer` + Shared-Layer.
> Modul `flow` ausgeklammert.

## Zusammenfassung

| Kategorie | Kritisch | Hoch | Mittel | Niedrig | Behoben |
|-----------|----------|------|--------|---------|---------|
| Security | 0 | 1 | 5 | 2 | 8 |
| Code-Hygiene | 0 | 4 | 6 | 3 | 4 |
| Modulstruktur | 0 | 1 | 5 | 2 | 2 |
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

### Behoben im Backlog-Sprint (2026-03-25)

| # | Schweregrad | Befund | Datei | Fix |
|---|-------------|--------|-------|-----|
| S7 | NIEDRIG | Dynamische SET-Klausel aus Object.keys (hardcoded, aber wartungsanfaellig) | `backend/modules/elternsprechtag/services/slotsService.js` | `assertSafeIdentifier()` fuer alle Keys aufgerufen (BL-3) |
| S8 | NIEDRIG | Keine explizite Ownership-Pruefung im Bulk-Delete | `backend/shared/counselorAdminRoutes.js` | Atomarer `counselor_id`-Check im Bulk-Delete; restricted-Termine von Loeschung ausgeschlossen (BL-4) |
| BL-1 | MITTEL | `restricted`-Filter fehlt in Teacher-Booking-Queries (GET/DELETE/PUT) inkl. fehlender TOCTOU-Guards in UPDATE | `backend/modules/elternsprechtag/routes/teacher/bookings.js` | LEFT JOIN booking_requests + restricted-Filter in allen Teacher-Queries; TOCTOU-Guards in UPDATE-Statements |
| BL-2 | NIEDRIG | `writeAuditLog()` fehlte in GET /teacher/bookings (PII-Lesezugriff) | `backend/modules/elternsprechtag/routes/teacher/bookings.js` | `writeAuditLog` fuer GET /teacher/bookings ergaenzt |
| W1 | MITTEL | `tempPassword` in POST /teachers Response (Klartext-Passwort in API-Antwort) | `backend/routes/admin/teacherRoutes.js` | `tempPassword` entfernt; Response gibt nur noch `passwordSet: true` zurueck |
| W3 | MITTEL | `restricted`-Filter fehlte in `listAdminBookings()` | `backend/shared/counselorService.js` | `WHERE restricted IS NOT TRUE` in `listAdminBookings()` ergaenzt |
| W4 | NIEDRIG | `cancellationMessage` ohne Laengenbegrenzung | `backend/shared/counselorAdminRoutes.js` | Auf 1000 Zeichen begrenzt |
| W8 | NIEDRIG | `parseInt` fehlte bei `zustaendig`-Vergleich in `flowAuth` | `backend/middleware/auth.js` | `parseInt()` fuer `zustaendig`-Vergleich ergaenzt |

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

| # | Schweregrad | Befund | Datei | Status | Fix |
|---|-------------|--------|-------|--------|-----|
| H1 | HOCH | Active-Event-Query 3x inline statt `resolveActiveEvent()` | `public.js:130,171,237` | **ERLEDIGT (Sprint 2)** | `resolveActiveEvent()` verwenden |
| H2 | HOCH | `slotUpdate`-Objekt (14 Felder) dupliziert | `slotAssignment.js:184/271` | **ERLEDIGT (Sprint 2)** | `buildSlotUpdateFromRequest()` extrahiert |
| H3 | HOCH | `buildHalfHourWindows` etc. aus Backend kopiert | `useBooking.ts:10-38` | **ERLEDIGT (BL-5)** | `src/utils/timeWindows.ts` angelegt; Logik dorthin extrahiert |
| H4 | HOCH | `SELECT id, name, room FROM teachers WHERE id=$1` 9x inline | Diverse elternsprechtag-Dateien | **ERLEDIGT (Sprint 2)** | `getTeacherById()` in `teachersService.js` |
| H5 | MITTEL | `public.js` 519 Zeilen, 7 Handler | `public.js` | OFFEN | Aufteilen in booking/verify/event/dev-Routes |
| H6 | MITTEL | `TeacherBookings.tsx` 377 Zeilen, 13 Inline-Styles | `TeacherBookings.tsx` | **TEILWEISE ERLEDIGT (BL-7)** | 8 Inline-Styles durch CSS-Klassen ersetzt; `TeacherBookings.css` angelegt. Filter/Tabelle als Sub-Komponenten noch offen. |
| H7 | MITTEL | `useMemo` ohne reaktive Deps in AnfragenTab | `BLAnfragenTab.tsx`, `SSWAnfragenTab.tsx` | **ERLEDIGT (BL-16)** | Durch Modul-Level-Konstanten ersetzt |
| H8 | MITTEL | `defaultSchedule` Factory vs. Const inkonsistent | `SSWCounselorsTab.tsx` | OFFEN | Vereinheitlichen |
| H9 | MITTEL | `parseTimeWindow`/`fmtMinutes` reimplementiert | `slotAssignment.js:8-22` | OFFEN | Import aus `timeWindows.js` |
| H10 | MITTEL | `AdminSlots.tsx` 346 Zeilen | `AdminSlots.tsx` | OFFEN | TeacherSelect + SlotForm extrahieren |
| H11 | NIEDRIG | `normalize` als anonyme fn im Handler | `public.js:274` | OFFEN | An Dateianfang oder inline |
| H12 | NIEDRIG | Weekday-Index 0-basiert vs. 1-basiert | `BLCounselorsTab.tsx` vs. `SSWCounselorsTab.tsx` | OFFEN | Dokumentieren |
| H13 | NIEDRIG | Inline-Styles in `TeacherFeedback.tsx` | `TeacherFeedback.tsx` | OFFEN | In CSS auslagern |

Zusaetzliche Code-Hygiene-Massnahmen im Backlog-Sprint:

| # | Befund | Datei | Fix |
|---|--------|-------|-----|
| BL-13 | `SELECT *` durch explizite Spalten ersetzt | `backend/shared/crud.js`, `backend/modules/elternsprechtag/services/slotAssignment.js` | Vollstaendige Spaltenauswahl |
| BL-11 | Fehlende `logger.error` in Catch-Bloecken | `backend/middleware/auth.js` (3 Catch-Bloecke), `backend/utils/resolveActiveEvent.js` | `logger.error` in allen Catch-Bloecken ergaenzt |
| BL-17 | Flow-CSS ohne Design-Token | `src/modules/flow/` CSS-Dateien | `var(--brand-*)` / `var(--color-*)` Fallbacks ergaenzt |
| BL-3b | `assertSafeIdentifier` in `slotAssignment.js` | `backend/modules/elternsprechtag/services/slotAssignment.js` (2 Stellen) | Guard fuer dynamische Identifier |

---

## 3. Modulstruktur-Befunde

| # | Schweregrad | Befund | Modul | Status | Empfehlung |
|---|-------------|--------|-------|--------|------------|
| M1 | HOCH | Admin-Routen (Slots, Events, Bookings) ausserhalb des Moduls in Core-Routes | elternsprechtag | OFFEN | Dokumentieren oder ins Modul migrieren |
| M2 | MITTEL | Kein `requiredModule`-Feld | schulsozialarbeit | **ERLEDIGT (Sprint 2)** | `requiredModule: 'schulsozialarbeit'` gesetzt |
| M3 | MITTEL | `writeAuditLog()` fehlt in Teacher/Counselor-Routen (DSGVO) | alle 3 | **TEILWEISE ERLEDIGT** | Counselor-Admin-Routen erledigt (Sprint 2). Teacher GET /bookings erledigt (BL-2). |
| M4 | MITTEL | `bl_requests` ohne `restricted`-Flag und ohne RLS | beratungslehrer | **ERLEDIGT (Sprint 2)** | Migration `055_bl_requests_restricted.sql` erstellt |
| M5 | MITTEL | `restricted`-Filter fehlt in Teacher-Routen | elternsprechtag | **ERLEDIGT (BL-1)** | LEFT JOIN + `WHERE restricted IS NOT TRUE` in allen Teacher-Booking-Queries |
| M6 | MITTEL | `created_at` ohne NOT NULL in Migrationen 022/026 | SSW, BL | **ERLEDIGT (Sprint 2)** | Bereits in 054 erledigt |
| M7 | NIEDRIG | Emoji-Icons in SSW-Kategorie-Seeding (Migration 022) | schulsozialarbeit | OFFEN | Durch Icon-Bezeichner ersetzen |
| M8 | NIEDRIG | Rate-Limit-Registrierungen nicht konsolidiert | elternsprechtag | OFFEN | `/api/health` und `/api/dev` pruefen |

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

### Behoben (Backlog-Sprint – 2026-03-25)

1. ~~BL-1: `restricted`-Filter in Teacher-Booking-Queries (GET/DELETE/PUT) + TOCTOU-Guards~~ – erledigt
2. ~~BL-2: `writeAuditLog` fuer GET /teacher/bookings~~ – erledigt
3. ~~BL-3: `assertSafeIdentifier` in `slotsService.js` und `slotAssignment.js`~~ – erledigt
4. ~~BL-4: Atomarer Ownership-Check im Bulk-Delete; restricted-Termine von Loeschung ausgeschlossen~~ – erledigt
5. ~~BL-5: `buildHalfHourWindows`/`formatDateDE` in `src/utils/timeWindows.ts` extrahiert~~ – erledigt
6. ~~BL-7: 8 Inline-Styles in `TeacherBookings.tsx` durch CSS-Klassen ersetzt; `TeacherBookings.css` angelegt~~ – erledigt
7. ~~BL-11: `logger.error` in 3 flowAuth-Catch-Bloecken und `resolveActiveEvent` ergaenzt~~ – erledigt
8. ~~BL-13: `SELECT *` durch explizite Spalten in `crud.js` und `slotAssignment.js` ersetzt~~ – erledigt
9. ~~BL-16: `useMemo` mit leerem Dep-Array durch Modul-Level-Konstanten ersetzt~~ – erledigt
10. ~~BL-17: Flow-CSS Design-Tokens auf `var(--brand-*)` / `var(--color-*)` Fallbacks umgestellt~~ – erledigt
11. ~~W1: `tempPassword` aus POST /teachers Response entfernt~~ – erledigt
12. ~~W3: `restricted`-Filter in `listAdminBookings()` ergaenzt~~ – erledigt
13. ~~W4: `cancellationMessage` auf 1000 Zeichen begrenzt~~ – erledigt
14. ~~W8: `parseInt` fuer `zustaendig`-Vergleich in flowAuth~~ – erledigt

### Backlog (offen)

1. `public.js` aufteilen (519 Zeilen -> 4 Dateien) – H5
2. `TeacherBookings.tsx` weiter refactoren: Filter/Tabelle als Sub-Komponenten – H6 (Restarbeit)
3. Elternsprechtag Admin-Routen ins Modul migrieren oder dokumentieren – M1
4. `parseTimeWindow`/`fmtMinutes` in `slotAssignment.js` auf Import aus `timeWindows.js` umstellen – H9
5. `defaultSchedule` Factory vs. Const konsolidieren in `SSWCounselorsTab.tsx` – H8
6. Emoji-Icons in SSW-Kategorie-Seeding durch Icon-Bezeichner ersetzen – M7
