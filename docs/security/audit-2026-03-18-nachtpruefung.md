# Nachtpruefung – Code & Security Audit 2026-03-18

> **Durchgefuehrt von:** Waechter, Hygieniker, Konsistenzpruefer, Erkunder (parallel)
> **Datum:** 2026-03-18
> **Scope:** Gesamte Codebase (backend/, src/, docker-compose.yml, Migrationen)
> **Update:** 2026-03-18 (Batch 2 – weitere Behebungen)

---

## Zusammenfassung

| Schweregrad | Gefunden | Behoben | Offen |
|-------------|----------|---------|-------|
| Kritisch    | 1        | 1       | 0     |
| Hoch        | 3        | 3       | 0     |
| Mittel      | 10       | 10      | 0     |
| Niedrig     | 5        | 3       | 2     |
| Konventions-Drift | 19  | 10      | 9     |
| **Gesamt**  | **38**   | **27**  | **11** |

---

## Behobene Befunde

### Kritisch

| # | Befund | Fix | Commit |
|---|--------|-----|--------|
| S-01 | Default `SESSION_SECRET` und `POSTGRES_PASSWORD` in docker-compose.yml. Bei Deployment ohne .env werden JWTs mit bekanntem String signiert. | `:?` Syntax: Compose schlaegt fehl wenn Secrets nicht gesetzt. | `fix(security): remove default secrets...` |

### Hoch

| # | Befund | Fix | Commit |
|---|--------|-----|--------|
| S-02 | Token Revocation fehlte. Nach Logout/Passwortwechsel blieben JWTs bis zu 8h gueltig. | Migration 043 `token_version`. Auth-Middleware prueft JWT-`tv` gegen DB. Logout/Passwortwechsel inkrementiert Version. | `feat(security): token revocation...` |
| S-03 | Passwort-Validierung: nur `length >= 8`, keine Komplexitaet. | Neue zentrale `validatePassword()`: min 8 Zeichen + Gross/Klein/Ziffer. 3 Stellen umgestellt. | `feat(security): token revocation...` |
| S-04 | 8 Error-Handler gaben `error.message` (inkl. SQL-Details) an Clients weiter. Teils auf oeffentlichen Endpunkten. | Pattern: `status < 500 ? err.message : generisch`. CSV-Import und Superadmin-Preview komplett generisch. | `fix(security): remove default secrets...` |

### Mittel

| # | Befund | Fix | Commit |
|---|--------|-----|--------|
| S-05 | `LIMIT ${EXPORT_LIMIT}` in dataSubject.js – Konstante, aber Verstoss gegen Hard Rule #2. | Parametriert: `LIMIT $N` mit `params.push(EXPORT_LIMIT)`. | `feat(security): token revocation...` |
| S-06 | `esc()` in EmailBrandingTab.tsx fehlte Single-Quote-Escaping. | `&#39;` hinzugefuegt. | `feat(security): token revocation...` |
| S-07 | `assertSafeIdentifier()` fehlte in userRoutes.js fuer COUNSELOR_TABLES Tabellennamen. | Import + Assertions vor SQL-Interpolation. | `fix(security): remove default secrets...` |
| S-08 | Datenschutz.tsx: direkter `fetch()` statt api.ts (Regel 8). | Umgestellt auf `api.superadmin.getSiteBranding()`. | `fix(consistency): ...` |
| S-09 | BLAdmin.tsx: `|| []` ohne `Array.isArray()` Guard (Regel 4). | Guards nachgeruestet. | `fix(consistency): ...` |
| S-10 | SSW/BL counselor routes: `err.statusCode` ohne `< 500` Guard. | `err.statusCode && err.statusCode < 500` hinzugefuegt. | `fix(security): remove default secrets...` |
| S-11 | EmailBrandingTab.tsx: `dangerouslySetInnerHTML` – Stored-XSS-Risiko bei kompromittiertem Admin-Account. | Ersetzt durch `<iframe sandbox="" srcDoc={...}>`. | `fix(security+consistency): ...batch 2` |
| S-12 | `LIMIT 3000` als Template-Literal in teacher.js:379. | Parametriert: `LIMIT $3` mit `params.push(SLOT_LIMIT)`. | `fix(security+consistency): ...batch 2` |

### Konventions-Drift (behoben)

| # | Befund | Fix | Commit |
|---|--------|-----|--------|
| K-01 | CounselorBookingApp: eigener `requestJSON` statt api.ts (Regel 8). | Zentrale `requestJSON` exportiert und importiert. | `fix(security+consistency): ...batch 2` |
| K-02 | `alert()` in SSWCounselorsTab (3 Stellen) statt Flash-System. | Durch `showFlash` Prop ersetzt. | `fix(security+consistency): ...batch 2` |
| K-03 | `alert()` in CounselorBookingApp (2 Stellen). | Durch `setError` State ersetzt. | `fix(security+consistency): ...batch 2` |
| K-04 | Hardcoded `#fff`, `#374151` in BrandingTab.tsx Vorschau. | Durch `var(--color-white)`, `var(--color-gray-700)` ersetzt. | `fix(security+consistency): ...batch 2` |
| K-05 | Toter Re-Export `generateUsername` in counselorAdminRoutes.js. | Entfernt. | `style(hygiene): ...` |
| K-06 | `pad()` 3x dupliziert in icalExport.ts. | Konsolidiert. | `style(hygiene): ...` |
| K-07 | Datenschutz.tsx direkter fetch(). | Durch api.ts ersetzt. | `fix(consistency): ...` |

---

## Offene Befunde

### Mittel (Roadmap)

| # | Befund | Datei:Zeile | Empfehlung | Prioritaet |
|---|--------|-------------|------------|------------|
| O-01 | `tempPassword` in API-Antwort ohne `force_password_change` Flag. | `teacherRoutes.js:242,399,579` | Flag einfuehren, bei erstem Login Passwortwechsel erzwingen. | P2 |

### Niedrig (Backlog)

| # | Befund | Datei:Zeile | Empfehlung |
|---|--------|-------------|------------|
| O-02 | `seed-teachers-from-stdin.js`: `console.log` statt `logger`. | Zeile 207-384 | Durch Pino-Logger ersetzen. |
| O-03 | `github.dev` CORS-Origin in Dev-Modus. | `index.js:54` | Sicherstellen dass `NODE_ENV=production` im Deployment. |

### Konventions-Drift (Backlog – eigene Refactoring-Tickets)

| # | Befund | Betroffene Dateien | Aufwand |
|---|--------|--------------------|---------|
| R-01 | ~11 Domain-Typen in 5 Dateien ausserhalb `types/index.ts` (Regel 7) | `AuthContextBase.ts`, `BrandingContext.tsx`, `TextBrandingContext.tsx`, `AdminTeachers/types.ts`, `TeacherLayout.tsx` | Mittel – 20+ Import-Updates |
| R-02 | Email-Preview-Template Hex-Werte in `EmailBrandingTab.tsx` | CSS-Vars nicht moeglich in Email-HTML | Akzeptierte Ausnahme |

### Hygieniker-Backlog (Refactoring-Tickets)

| # | Befund | Aufwand | Prioritaet |
|---|--------|---------|------------|
| H-03 | SSW/BL counselor.js Backend-Routen ~85% identisch → `createCounselorSelfServiceRoutes()` Factory | Mittel | P3 |
| H-04 | SSWAnfragenTab/BLAnfragenTab ~98% identisch → Shared `CounselorAnfragenTab` | Niedrig | P3 |
| H-05 | SSWTermineTab/BLTermineTab Monatsberechnung → `getMonthRange()` Utility | Niedrig | P3 |
| H-06 | `teacher.js` 911 Zeilen → Aufteilen in Bookings/Requests/Slots-Subrouter | Mittel | P3 |
| H-07 | `teacherRoutes.js` 708 Zeilen → CSV-Logik in `backend/utils/csvImport.js` | Niedrig | P3 |
| H-08 | BLAdmin.tsx 636 Zeilen monolithisch → Tab-Komponenten nach SSW-Muster | Mittel | P3 |
| H-09 | AdminDashboard.css 2390 Zeilen → Aufteilen in thematische CSS-Dateien | Niedrig | P4 |
| H-10 | `DataProtectionTab.tsx` 495 Zeilen mit 14 useState → Custom-Hooks extrahieren | Niedrig | P3 |

### Infrastruktur-Backlog

| # | Befund | Empfehlung | Prioritaet |
|---|--------|------------|------------|
| I-01 | Kein Zod/Joi Schema-Validierung fuer Request-Bodies | Schema-Validierung als Middleware fuer Public-Endpunkte | P2 |
| I-02 | DB-SSL ohne CA-Zertifikat | CA hinterlegen fuer Produktion | P3 |
| I-03 | Kein Request-ID/Correlation-ID in Logs | UUID-Middleware + Pino-Integration | P3 |
| I-04 | Kein `npm audit` in CI/CD | Als CI-Job hinzufuegen | P3 |

---

## Dependency-Audit

| Paket | Ergebnis |
|-------|----------|
| Frontend (root) | 0 Vulnerabilities |
| Backend | 0 Vulnerabilities |

---

## Statistik

| Kennzahl | Wert |
|----------|------|
| Befunde gesamt | 38 + 21 (aus erstem Audit) |
| Behoben | 27 + diverse aus Audit 1 |
| Behebungsquote (Nachtpruefung) | 71% |
| Kritisch/Hoch offen | **0** |
| Commits | 7 (feat+fix+style+docs) |
| Agents eingesetzt | 5 (Waechter, Hygieniker, Konsistenzpruefer, Erkunder, Pruefer) |
