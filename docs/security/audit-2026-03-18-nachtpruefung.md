# Nachtpruefung – Code & Security Audit 2026-03-18

> **Durchgefuehrt von:** Waechter, Hygieniker, Konsistenzpruefer, Erkunder (parallel)
> **Datum:** 2026-03-18
> **Scope:** Gesamte Codebase (backend/, src/, docker-compose.yml, Migrationen)

---

## Zusammenfassung

| Schweregrad | Gefunden | Behoben | Offen |
|-------------|----------|---------|-------|
| Kritisch    | 1        | 1       | 0     |
| Hoch        | 3        | 3       | 0     |
| Mittel      | 10       | 8       | 2     |
| Niedrig     | 5        | 1       | 4     |
| Konventions-Drift | 19  | 3       | 16    |
| **Gesamt**  | **38**   | **16**  | **22** |

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

---

## Offene Befunde

### Mittel (Roadmap)

| # | Befund | Datei:Zeile | Empfehlung | Ticket |
|---|--------|-------------|------------|--------|
| O-01 | Admin-Lockout in-memory: Neustart setzt Zaehler zurueck. | `auth.js:26` | Persistent in DB oder Redis speichern. | P2 |
| O-02 | `tempPassword` in API-Antwort ohne `force_password_change` Flag. | `teacherRoutes.js:242,399,579` | Flag einfuehren, bei erstem Login Passwortwechsel erzwingen. | P2 |

### Niedrig (Backlog)

| # | Befund | Datei:Zeile | Empfehlung |
|---|--------|-------------|------------|
| O-03 | `seed-teachers-from-stdin.js`: `console.log` statt `logger`. | Zeile 207-384 | Durch Pino-Logger ersetzen. |
| O-04 | Migrationen 001/012: `TIMESTAMP WITH TIME ZONE` statt `TIMESTAMPTZ`. | Kosmetisch, funktional identisch. | Nur bei naechster Aenderung anpassen. |
| O-05 | `github.dev` CORS-Origin in Dev-Modus. | `index.js:54` | Sicherstellen dass `NODE_ENV=production` im Deployment. |
| O-06 | DB-SSL ohne CA-Zertifikat. Self-Signed akzeptiert. | `config/db.js:41` | CA hinterlegen fuer Produktions-Deployments. |

### Konventions-Drift (Backlog – eigenes Refactoring-Ticket)

| Regel | Betroffene Dateien | Aufwand |
|-------|-------------------|---------|
| Typen ausserhalb `types/index.ts` (Regel 7) | 7 Dateien, 15+ Interfaces | Mittel – erfordert breites Refactoring mit Re-Exports |
| Hardcoded Farben statt `var(--brand-*)` (Regel 5) | 5 Stellen (CSS + Email-Preview) | Niedrig |
| Email-Preview-Template Hex-Werte | `EmailBrandingTab.tsx` | Niedrig – Inline-HTML-Template, nicht DOM-Styling |

---

## Dependency-Audit

| Paket | Ergebnis |
|-------|----------|
| Frontend (root) | 0 Vulnerabilities |
| Backend | 0 Vulnerabilities |

---

## Hygieniker-Befunde (Code-Verschlankung)

### Behoben

| # | Befund | Fix |
|---|--------|-----|
| H-01 | Toter Re-Export `generateUsername` in `counselorAdminRoutes.js:367` | Entfernt |
| H-02 | `pad()` 3x dupliziert in `icalExport.ts` | Auf Modul-Ebene konsolidiert |

### Backlog (eigenes Refactoring-Ticket)

| # | Befund | Aehnlichkeit | Aufwand |
|---|--------|-------------|---------|
| H-03 | SSW/BL counselor.js Backend-Routen ~85% identisch | Router-Factory `createCounselorSelfServiceRoutes()` | Mittel |
| H-04 | SSWAnfragenTab/BLAnfragenTab ~98% identisch | Shared `CounselorAnfragenTab` Komponente | Niedrig |
| H-05 | SSWTermineTab/BLTermineTab Monatsberechnung dupliziert | `getMonthRange()` Utility extrahieren | Niedrig |
| H-06 | `teacher.js` 911 Zeilen – groesste Backend-Datei | Aufteilen in Bookings/Requests/Slots-Subrouter | Mittel |
| H-07 | `teacherRoutes.js` 708 Zeilen – CSV-Import inline | CSV-Logik in `backend/utils/csvImport.js` auslagern | Niedrig |
| H-08 | `alert()` in SSWCounselorsTab statt Flash-System | Durch `showFlash` Prop ersetzen | Niedrig |

### Verschlankungspotenzial: ~280 Zeilen entfernbar/konsolidierbar

---

## Agents eingesetzt

| Agent | Dauer | Findings |
|-------|-------|----------|
| Waechter (Security-Scan) | ~3 Min | 17 Befunde |
| Konsistenzpruefer (Konventionen) | ~3 Min | 19 Befunde |
| Hygieniker (Dead Code/Duplikate) | ~5 Min | 12 Befunde |
| Erkunder (Detailanalyse 4 Items) | ~2 Min | Kontext fuer alle 4 Fixes |
