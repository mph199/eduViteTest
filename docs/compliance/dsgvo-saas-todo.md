# DSGVO SaaS-ToDo – Umsetzungsplan

> **Zweck:** Ausfuehrliche, priorisierte Aufgabenliste fuer DSGVO-Konformitaet des SaaS-Betriebs.
> Abgeleitet aus Gap-Analyse: DSGVO-Anforderungen vs. IST-Zustand (DB-Audit + Code-Review).
>
> **Stand:** 2026-03-17
> **Bezug:** [Anforderungen](dsgvo-anforderungen.md) | [Dateninventar](dsgvo-dateninventar.md) | [DB-Audit](../security/db-audit-2026-03-17.md)

---

## Legende

| Symbol | Bedeutung |
|--------|-----------|
| `[ ]` | Offen |
| `[~]` | Teilweise implementiert |
| `[x]` | Abgeschlossen |
| **P0** | Blocker – vor Go-Live zwingend |
| **P1** | Hoch – innerhalb 4 Wochen nach Go-Live |
| **P2** | Mittel – innerhalb 3 Monaten |
| **P3** | Niedrig – naechste Planungsphase |

---

## Phase 0: Go-Live-Blocker (P0)

### 0.1 Loeschkonzept und Datenbereinigung

> **Bezug:** RG-003, BR-003, GS-002, K1-K3 aus DB-Audit

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 0.1.1 | **PII-Anonymisierung in `booking_requests` bei Event-Abschluss** – Migration: Funktion `anonymize_booking_requests(event_id)` die `parent_name`, `student_name`, `trainee_name`, `representative_name`, `company_name`, `email`, `message` auf NULL setzt. Admin-Endpunkt + automatischer Trigger bei Event-Status `closed`. | `backend/migrations/034_*.sql`, `backend/routes/admin/bookingRoutes.js` | [x] |
| 0.1.2 | **PII-Anonymisierung bei Cancel in SSW/BL** – Bei `status='cancelled'`: `student_name`, `student_class`, `email`, `phone`, `concern`, `notes` auf NULL setzen (analog `cancelBookingAdmin()` bei slots). | `backend/modules/schulsozialarbeit/routes/counselor.js`, `backend/modules/beratungslehrer/routes/counselor.js`, `backend/shared/counselorAdminRoutes.js` | [x] |
| 0.1.3 | **Retention-Cron-Job** – Automatische Anonymisierung abgelaufener Daten. Fristen: Elternsprechtag 6 Monate nach Event, SSW/BL 12 Monate nach Termin, stornierte Termine 30 Tage. | `backend/jobs/retention-cleanup.js` (neu), `backend/index.js` (Job registrieren) | [x] |
| 0.1.4 | **DELETE-Endpunkt fuer booking_requests** – Admin-Route zum manuellen Loeschen/Anonymisieren einzelner Anfragen. | `backend/routes/admin/bookingRoutes.js` | [x] |
| 0.1.5 | **Aufbewahrungsfristen konfigurierbar machen** – Fristen in `module_config` oder Environment-Variablen, nicht hardcoded. | `backend/config/retention.js` (neu) | [x] |

### 0.2 Art.-9-Daten: Erhebung eingestellt

> **Bezug:** DSFA-001, BK-001, K2 aus DB-Audit
> **Entscheidung (2026-03-17):** Psychosoziale Daten (concern/notes in SSW/BL) werden nicht mehr erhoben.
> Die Felder wurden aus Frontend, Backend und Datenbank entfernt (Migration 035).
> Damit entfallen DSFA, spezielle Zugriffsbeschraenkung, Art.-9-Consent und Audit-Log fuer diese Felder.

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 0.2.1 | ~~DSFA~~ → **Entfaellt** – Keine Art.-9-Daten mehr erhoben. Entscheidung dokumentiert. | -- | [x] |
| 0.2.2 | ~~Zugriffsbeschraenkung~~ → **Entfaellt** – concern/notes-Spalten entfernt (Migration 035). | `backend/migrations/035_remove_art9_data.sql` | [x] |
| 0.2.3 | ~~Art.-9-Einwilligung~~ → **Entfaellt** – Kein Art.-9-Consent noetig ohne Art.-9-Daten. | -- | [x] |
| 0.2.4 | ~~Audit-Log fuer concern/notes~~ → **Entfaellt** – Felder existieren nicht mehr. | -- | [x] |

### 0.3 Consent Management

> **Bezug:** RG-001, AU-003, BK-004

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 0.3.1 | **Consent-Receipt in DB speichern** – Append-only `consent_receipts`-Tabelle. Bei jeder Buchung (SSW/BL/EST): Timestamp, IP, User-Agent, consent_version, Zweck. | `backend/migrations/036_consent_receipts.sql`, `counselorPublicRoutes.js`, `elternsprechtag/routes/public.js` | [x] |
| 0.3.2 | **Consent-Checkbox: Version und Zweck speichern** – Frontend sendet `consent_version` (z.B. `ssw-v2`, `est-v2`) im Body mit. Backend validiert Pflichtfeld. | `src/components/ConsentCheckbox.tsx`, `CounselorBookingApp.tsx`, `BookingForm.tsx` | [x] |
| 0.3.3 | **Widerruf-Endpunkt** – `POST /api/consent/withdraw` anonymisiert Buchungsdaten anhand E-Mail + Modul. Rate-Limited. Widerruf wird in consent_receipts protokolliert. | `backend/routes/consent.js` | [x] |

### 0.4 Datenschutzerklaerung und Informationspflichten

> **Bezug:** IP-001, GS-005

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 0.4.1 | **Datenschutzseite vervollstaendigen** – Alle Module (EST/SSW/BL) mit Daten, Zweck, Rechtsgrundlage, Speicherdauer. Dynamisch aus site_branding (DSB, Verantwortlicher). | `src/pages/Datenschutz.tsx` | [x] |
| 0.4.2 | **Datenschutz-Footer in alle E-Mail-Templates** – Link zur Datenschutzerklaerung, Verantwortlicher, DSB-Kontakt in jedem transaktionalen E-Mail. | `backend/emails/template.js` | [x] |
| 0.4.3 | **DSB-Kontaktdaten konfigurierbar** – Migration 037: dsb_name, dsb_email, responsible_*, supervisory_authority, privacy_policy_url in site_branding. Superadmin kann pflegen. | `backend/migrations/037_dsb_contact_fields.sql`, `backend/routes/superadmin.js` | [x] |

### 0.5 Verarbeitungsverzeichnis (Art. 30)

> **Bezug:** VVT-001, VVT-002

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 0.5.1 | **Verarbeitungsverzeichnis erstellen** – 6 Verarbeitungstaetigkeiten (EST, SSW, BL, Benutzer, Consent, Feedback), TOM-Abschnitt, Aenderungshistorie. | `docs/compliance/verarbeitungsverzeichnis.md` | [x] |
| 0.5.2 | **AV-Verzeichnis erstellen** – Vorlage fuer Self-Hosted-Deployments mit Unterauftragsverarbeiter-Tabelle. | `docs/compliance/av-verzeichnis.md` | [x] |

---

## Phase 1: Hoch – innerhalb 4 Wochen (P1)

### 1.1 Betroffenenrechte-Endpunkte

> **Bezug:** BR-001 bis BR-006

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 1.1.1 | **Datenexport-Endpunkt (Art. 15)** – `GET /api/data-subject/{identifier}/export` – Sammelt alle PII aus allen Tabellen (teachers, users, slots, booking_requests, ssw_appointments, bl_appointments) zu einer Person. Export als JSON. Identifikation ueber E-Mail-Adresse. | `backend/routes/admin/dataSubject.js` (neu) | [ ] |
| 1.1.2 | **Datenloeschung-Endpunkt (Art. 17)** – `DELETE /api/data-subject/{identifier}` – Kaskadierte Anonymisierung aller PII zu einer Person. Prueft Aufbewahrungspflichten vor Loeschung. Generiert Loeschprotokoll. | `backend/routes/admin/dataSubject.js` (neu) | [ ] |
| 1.1.3 | **Datenberichtigung-Endpunkt (Art. 16)** – `PATCH /api/data-subject/{identifier}` – Korrektur von Name, E-Mail etc. ueber alle Tabellen. Aenderungshistorie fuehren. | `backend/routes/admin/dataSubject.js` (neu) | [ ] |
| 1.1.4 | **Verarbeitungseinschraenkung (Art. 18)** – Flag `restricted` in relevanten Tabellen. Eingeschraenkte Datensaetze werden gespeichert, aber nicht in Listen/Exports angezeigt. | Migration + `backend/routes/admin/dataSubject.js` | [ ] |
| 1.1.5 | **Datenuebertragbarkeit (Art. 20)** – Export in standardisiertem Format (JSON + CSV). Identisch mit 1.1.1 aber erweitertes Format. | `backend/routes/admin/dataSubject.js` | [ ] |

### 1.2 Sicherheitsluecken fixen (aus DB-Audit)

> **Bezug:** TOM-003, TOM-005, H1-H6 aus DB-Audit

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 1.2.1 | **Transaktion in userRoutes fixen** – `query('BEGIN')` auf `getClient()` + `client.query()` umstellen. | `backend/routes/admin/userRoutes.js:107` | [ ] |
| 1.2.2 | **Connection-Leak in eventsRoutes fixen** – `finally { client.release() }` ergaenzen. | `backend/routes/admin/eventsRoutes.js:199-201` | [ ] |
| 1.2.3 | **DB-SSL: rejectUnauthorized konfigurierbar** – Env-Variable `DB_SSL_REJECT_UNAUTHORIZED` einfuehren. In Produktion auf `true` setzen mit CA-Zertifikat. | `backend/config/db.js:42` | [ ] |
| 1.2.4 | **Klartext verification_token entfernen** – Migration 034: `ALTER TABLE slots DROP COLUMN IF EXISTS verification_token`. Dual-Lookup im Code entfernen. | Migration + `backend/modules/elternsprechtag/routes/public.js` | [ ] |
| 1.2.5 | **RLS auf users, ssw/bl-Tabellen aktivieren** – `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + restriktive Policies. | Migration | [ ] |
| 1.2.6 | **Fehlende Indizes erstellen** – `booking_requests(email)`, `booking_requests(verification_token_hash)`, `users(teacher_id)`, `bl_weekly_schedule(counselor_id)`. | Migration | [ ] |

### 1.3 Audit-Logging

> **Bezug:** AU-001, AU-002

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 1.3.1 | **PII-Zugriffs-Audit-Log** – Middleware die bei jedem Zugriff auf PII-Tabellen loggt: User-ID, Aktion, Tabelle, Timestamp. Append-only-Tabelle oder separater Log-Stream. | `backend/middleware/audit-log.js` (neu), Migration | [ ] |
| 1.3.2 | **Security-Event-Logging** – Failed Logins, 403er, Rate-Limit-Hits in separatem Log-Stream. | `backend/routes/auth.js`, `backend/middleware/auth.js` | [ ] |
| 1.3.3 | **Audit-Log-Export** – Admin-Endpunkt zum Export von Audit-Logs (fuer Behoerdenanfragen). | `backend/routes/admin/auditRoutes.js` (neu) | [ ] |

---

## Phase 2: Mittel – innerhalb 3 Monaten (P2)

### 2.1 Multi-Tenancy vorbereiten

> **Bezug:** BK-002, AV-001 bis AV-004

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 2.1.1 | **Tenant-Isolation-Strategie festlegen** – Entscheidung: Separate DBs pro Mandant vs. Row-Level-Security mit `tenant_id`. Dokumentieren. | `docs/architecture/multi-tenancy.md` (neu) | [ ] |
| 2.1.2 | **tenant_id in alle PII-Tabellen** – Migration: `tenant_id` Spalte + Index + RLS-Policy. Jeder Request muss `tenant_id` aus JWT validieren. | Migrationen, alle Module | [ ] |
| 2.1.3 | **AV-Vertrags-Management** – Digitale AV-Vertrags-Verwaltung: Templates, Signierung, Versionierung. | Neues Modul oder externer Dienst | [ ] |
| 2.1.4 | **Sub-Processor-Liste** – Oeffentlich zugaengliche Seite mit allen Unterauftragsverarbeitern. Benachrichtigung bei Aenderungen. | `src/pages/SubProcessors.tsx` (neu), Backend-Endpunkt | [ ] |

### 2.2 Incident Management

> **Bezug:** MP-001 bis MP-003

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 2.2.1 | **Incident-Workflow digitalisieren** – CRUD fuer Datenpannen mit 72h-Timer und Eskalation. Pflichtfelder gemaess Art. 33 Abs. 3. | `backend/routes/admin/incidentRoutes.js` (neu), Migration | [ ] |
| 2.2.2 | **Betroffenen-Benachrichtigung** – Massen-E-Mail bei Datenpanne (Art. 34). Mehrsprachige Templates. Dokumentation der Benachrichtigung. | `backend/emails/incident-notification.js` (neu) | [ ] |
| 2.2.3 | **Incident-Log (append-only)** – Unveraenderbare Dokumentation aller Datenschutzverletzungen inkl. Bewertung und Massnahmen. | Migration, Backend-Route | [ ] |

### 2.3 Automatisierte Compliance

> **Bezug:** TOM-008

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 2.3.1 | **Security-Scans in CI/CD** – npm audit, Dependency-Check, OWASP-Checks als Pipeline-Step. | `.github/workflows/security.yml` (neu) | [ ] |
| 2.3.2 | **Automatisierte DSGVO-Checks** – Pre-Commit-Hook oder CI-Check: Neue DB-Queries auf PII-Tabellen muessen Audit-Log haben. `SELECT *` auf users-Tabelle warnen. | `.github/workflows/dsgvo-lint.yml` (neu) | [ ] |
| 2.3.3 | **Retention-Monitoring** – Dashboard oder Alert wenn Daten ueber Aufbewahrungsfrist liegen und nicht bereinigt wurden. | Backend-Route + Frontend-Komponente | [ ] |

### 2.4 E-Mail-Compliance

> **Bezug:** BK-003

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 2.4.1 | **Datenschutz-Footer in alle Templates** – Standardisierter Footer mit: Warum diese E-Mail, Datenschutzerklaerung-Link, Kontakt DSB. | `backend/emails/template.js` | [ ] |
| 2.4.2 | **Abmeldelink in wiederkehrenden E-Mails** – Falls Erinnerungen oder Benachrichtigungen: Abmeldelink (List-Unsubscribe Header). | `backend/emails/` | [ ] |

---

## Phase 3: Niedrig – naechste Planungsphase (P3)

### 3.1 Erweiterte Datenschutz-Features

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 3.1.1 | **Verschluesselung von Art.-9-Feldern at Rest** – concern/notes in SSW/BL verschluesselt speichern. Application-Level-Encryption mit Key-Management. | Backend-Service, Migration | [ ] |
| 3.1.2 | **Pseudonymisierung in Analytics/Logs** – PII in Pino-Logs redaktieren. Keine Klarnamen in Produktions-Logs. | `backend/config/logger.js` | [ ] |
| 3.1.3 | **Cookie-Consent-Banner** – Falls Tracking/Analytics eingefuehrt wird: Granularer Cookie-Consent (technisch, funktional, Analytics). Aktuell nicht noetig (nur technischer httpOnly-Cookie). | Frontend-Komponente | [ ] |
| 3.1.4 | **Automatisiertes Verarbeitungsverzeichnis** – API-Endpunkt der das VVT aus DB-Metadaten generiert. Export als JSON/PDF. | `backend/routes/admin/ropaRoutes.js` (neu) | [ ] |
| 3.1.5 | **Datenportabilitaet: Direkte Uebertragung** – Option, Daten direkt an anderen Anbieter zu uebermitteln (Art. 20 Abs. 2). | Backend-Service | [ ] |

### 3.2 Internationaler Datentransfer

> **Bezug:** DT-001 bis DT-003

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 3.2.1 | **Datenresidenz-Konfiguration** – Pro Mandant: Erlaubte Regionen/Rechenzentren. Geo-Routing. | Backend-Config, Multi-Tenancy | [ ] |
| 3.2.2 | **SCC-Verwaltung** – Standardvertragsklauseln-Status pro Drittland-Verbindung. Digitale Signatur. | Neues Modul | [ ] |
| 3.2.3 | **Transfer Impact Assessment** – TIA-Dokumentation pro Drittland. Regelmaessige Neubewertung. | Dokument | [ ] |

### 3.3 Organisatorische Massnahmen

| # | Aufgabe | Verantwortlich | Status |
|---|---------|---------------|--------|
| 3.3.1 | **DSB benennen** – Datenschutzbeauftragten bestellen (Pflicht ab 20 Mitarbeiter mit regelmaessiger PII-Verarbeitung oder bei Art.-9-Daten). | Geschaeftsfuehrung | [ ] |
| 3.3.2 | **Mitarbeiter-Schulung** – DSGVO-Schulung fuer alle mit Zugriff auf PII. Jaehrliche Auffrischung. | DSB / HR | [ ] |
| 3.3.3 | **Privacy-Review-Prozess** – Formaler Review bei neuen Features die PII verarbeiten. Checkliste in PR-Template. | Entwicklungsteam | [ ] |
| 3.3.4 | **Penetration-Test** – Jaehrlicher externer Pentest. Basis: Checkliste in `security-baseline.md` Abschnitt 14. | Extern | [ ] |
| 3.3.5 | **Backup-Strategie formalisieren** – Verschluesselte Backups, Aufbewahrungsfristen, Restore-Tests, RTO/RPO dokumentieren. | DevOps | [ ] |

---

## Code-Hygiene (parallel zu allen Phasen)

> **Bezug:** DB-Audit Befunde H7, M1-M10

| # | Aufgabe | Dateien | Prioritaet | Status |
|---|---------|---------|------------|--------|
| C.1 | `generate-slots` in Shared-Modul extrahieren | `backend/shared/generateCounselorSlots.js` (neu) | P1 | [ ] |
| C.2 | `generateUsername` deduplizieren | `teacherRoutes.js`, `counselorAdminRoutes.js` | P1 | [ ] |
| C.3 | Weekly-Schedule-Upsert deduplizieren | `teacherRoutes.js`, `counselorAdminRoutes.js` | P2 | [ ] |
| C.4 | Rate-Limiter auf `/api/teacher` Mount | `backend/modules/elternsprechtag/index.js` | P1 | [ ] |
| C.5 | Catch-Bloecke mit `logger.error` ergaenzen (24 Stellen) | Diverse | P2 | [ ] |
| C.6 | `SELECT *` durch explizite Spalten ersetzen (password_hash) | `teacherRoutes.js:541`, `teacher.js:890` | P1 | [ ] |
| C.7 | Toten Code entfernen (`teacherSystem`, `buildHalfHourWindows`) | `teacher.js:8,115` | P2 | [ ] |
| C.8 | `.env.example` vervollstaendigen (25 von 27 Variablen fehlen) | `.env.example` | P1 | [ ] |

---

## Fortschritts-Tracker

| Phase | Gesamt | Offen | Teilweise | Abgeschlossen | Fortschritt |
|-------|--------|-------|-----------|---------------|-------------|
| P0: Go-Live-Blocker | 18 | 0 | 0 | 18 | 100% |
| P1: Hoch (4 Wochen) | 14 | 14 | 0 | 0 | 0% |
| P2: Mittel (3 Monate) | 12 | 12 | 0 | 0 | 0% |
| P3: Niedrig | 13 | 13 | 0 | 0 | 0% |
| Code-Hygiene | 8 | 8 | 0 | 0 | 0% |
| **Gesamt** | **65** | **46** | **0** | **19** | **~29%** |

---

## Referenzen

| Dokument | Pfad |
|----------|------|
| DSGVO-Anforderungen | `docs/compliance/dsgvo-anforderungen.md` |
| Dateninventar | `docs/compliance/dsgvo-dateninventar.md` |
| DB-Audit | `docs/security/db-audit-2026-03-17.md` |
| Security Baseline | `docs/security/security-baseline.md` |
| Consent-Checkbox | `docs/planning/dsgvo-consent-checkbox.md` |
| System-Design | `docs/architecture/system-design.md` |
