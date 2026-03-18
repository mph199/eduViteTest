# DSGVO SaaS-ToDo – Umsetzungsplan

> **Zweck:** Ausfuehrliche, priorisierte Aufgabenliste fuer DSGVO-Konformitaet des SaaS-Betriebs.
> Abgeleitet aus Gap-Analyse: DSGVO-Anforderungen vs. IST-Zustand (DB-Audit + Code-Review).
>
> **Stand:** 2026-03-18
> **Bezug:** [Anforderungen](dsgvo-anforderungen.md) | [Dateninventar](dsgvo-dateninventar.md) | [DB-Audit](../security/db-audit-2026-03-17.md) | [Audit 2026-03-18](../security/audit-2026-03-18.md)

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
| 1.1.1 | **Datenexport-Endpunkt (Art. 15)** – `GET /api/admin/data-subject/export?email=&format=json` – Sammelt alle PII aus allen Tabellen zu einer Person. Export als JSON. Identifikation ueber E-Mail-Adresse. Integriert in Superadmin Datenschutz-Tab. | `backend/routes/admin/dataSubject.js`, `src/pages/SuperadminPage/DataProtectionTab.tsx` | [x] |
| 1.1.2 | **Datenloeschung-Endpunkt (Art. 17)** – `DELETE /api/admin/data-subject?email=` – Kaskadierte Anonymisierung aller PII zu einer Person. Generiert Loeschprotokoll im audit_log. | `backend/routes/admin/dataSubject.js` | [x] |
| 1.1.3 | **Datenberichtigung-Endpunkt (Art. 16)** – `PATCH /api/admin/data-subject?email=` – Korrektur von Name, E-Mail etc. ueber alle Tabellen. Aenderungshistorie in audit_log. | `backend/routes/admin/dataSubject.js` | [x] |
| 1.1.4 | **Verarbeitungseinschraenkung (Art. 18)** – Flag `restricted` in booking_requests, ssw_appointments, bl_appointments. Eingeschraenkte Datensaetze in Admin-Listen gefiltert. | `backend/migrations/038_*.sql`, `backend/routes/admin/dataSubject.js`, `backend/shared/counselorAdminRoutes.js` | [x] |
| 1.1.5 | **Datenuebertragbarkeit (Art. 20)** – Export in JSON + CSV ueber `GET /api/admin/data-subject/export?format=csv`. | `backend/routes/admin/dataSubject.js` | [x] |

### 1.2 Sicherheitsluecken fixen (aus DB-Audit)

> **Bezug:** TOM-003, TOM-005, H1-H6 aus DB-Audit

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 1.2.1 | **Transaktion in userRoutes fixen** – `getClient()` + `client.query()` mit `finally { client.release() }`. | `backend/routes/admin/userRoutes.js` | [x] |
| 1.2.2 | **Connection-Leak in eventsRoutes fixen** – War bereits korrekt implementiert (`finally { client.release() }`). | `backend/routes/admin/eventsRoutes.js` | [x] |
| 1.2.3 | **DB-SSL: rejectUnauthorized konfigurierbar** – `DB_SSL_REJECT_UNAUTHORIZED` Env-Variable. Default: true (sicher). | `backend/config/db.js` | [x] |
| 1.2.4 | **Klartext verification_token entfernen** – Migration 039: DROP COLUMN. Dual-Lookup in slotsService.js + teacher.js entfernt. | `backend/migrations/039_*.sql`, `slotsService.js`, `teacher.js` | [x] |
| 1.2.5 | **RLS auf users, ssw/bl-Tabellen aktivieren** – Migration 040: ENABLE ROW LEVEL SECURITY + app_full_access Policies (Defense-in-Depth). | `backend/migrations/040_rls_policies.sql` | [x] |
| 1.2.6 | **Fehlende Indizes erstellen** – Migration 039: 4 Indizes auf booking_requests(email), booking_requests(verification_token_hash), users(teacher_id), bl_weekly_schedule(counselor_id). | `backend/migrations/039_*.sql` | [x] |

### 1.3 Audit-Logging

> **Bezug:** AU-001, AU-002

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 1.3.1 | **PII-Zugriffs-Audit-Log** – `audit_log` Tabelle (Migration 038) + `writeAuditLog()` Utility. DSAR-Aktionen automatisch geloggt. | `backend/middleware/audit-log.js`, `backend/migrations/038_*.sql` | [x] |
| 1.3.2 | **Security-Event-Logging** – `logSecurityEvent()` fuer LOGIN_FAIL, ACCESS_DENIED in auth.js + auth-Middleware. | `backend/routes/auth.js`, `backend/middleware/auth.js` | [x] |
| 1.3.3 | **Audit-Log-Export** – `GET /api/admin/audit-log` (Pagination + Filter) + `GET /api/admin/audit-log/export` (CSV). Im Superadmin Datenschutz-Tab integriert. | `backend/routes/admin/dataSubject.js`, `src/pages/SuperadminPage/DataProtectionTab.tsx` | [x] |

### 1.4 Security-Hardening (Waechter-Audit 2026-03-18)

> **Bezug:** Waechter-Scan vom 2026-03-18, TOM-001 bis TOM-006

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 1.4.1 | **Account-Lockout (DB-User)** – 5 Fehlversuche → 15 Min Sperre. Atomares SQL-UPDATE gegen Race Conditions. Migration 041: `failed_login_attempts`, `locked_until` Spalten. | `backend/migrations/041_account_lockout.sql`, `backend/routes/auth.js` | [x] |
| 1.4.2 | **Account-Lockout (ADMIN_USER)** – In-Memory-Lockout fuer System-Admin (kein DB-Eintrag). 5 Versuche / 15 Min. | `backend/routes/auth.js` | [x] |
| 1.4.3 | **Timing-Attack-Prevention** – Dummy-bcrypt-Vergleich bei "User not found", um User-Enumeration ueber Antwortzeiten zu verhindern. | `backend/routes/auth.js` | [x] |
| 1.4.4 | **bcrypt-DoS-Schutz** – Passwort-Laenge auf 1024 Zeichen begrenzt. Verhindert Blockierung durch uebergrosse Passwoerter. | `backend/routes/auth.js` | [x] |
| 1.4.5 | **CSV-Extension-Validierung** – Dateiendung `.csv` wird zusaetzlich zum MIME-Type geprueft. Verhindert Upload manipulierter Dateien. | `backend/routes/admin/teacherRoutes.js` | [x] |
| 1.4.6 | **Passwort-Policy fuer Berater** – Mindestens 8 Zeichen bei Passwortaenderung durch Berater. | `backend/shared/counselorAdminRoutes.js` | [x] |
| 1.4.7 | **Info-Disclosure Fix** – Interne Fehlermeldungen (`error.message`) werden nicht mehr an Client weitergegeben. | `backend/modules/elternsprechtag/routes/events.js` | [x] |
| 1.4.8 | **Token-Revocation / Logout-Haertung** – Serverseitige JWT-Invalidierung (Blocklist oder Refresh-Token-Pattern). Aktuell nur Client-seitiges Cookie-Loeschen. | `backend/routes/auth.js` | [ ] |

---

## Phase 2: Mittel – innerhalb 3 Monaten (P2)

### 2.1 Multi-Tenancy / Mandantentrennung

> **Bezug:** BK-002, AV-001 bis AV-004
>
> **Architektur-Entscheidung (2026-03-18):** Jede Schule laeuft auf einem eigenen VPS
> mit separater Datenbank. **Keine Shared Databases.** Damit entfaellt die Notwendigkeit
> fuer Row-Level-Security mit `tenant_id` oder Schema-basierte Trennung.
> Die Isolation erfolgt physisch auf Infrastruktur-Ebene.
>
> **Konsequenzen:**
> - Maximale Datenisolation (Art. 32 DSGVO) – kein mandantenuebergreifender Zugriff moeglich
> - Einfachere DSGVO-Compliance: Loeschung = VPS + DB loeschen
> - Kein `tenant_id` in Tabellen noetig
> - AV-Vertrag pro Schule / VPS-Instanz
> - Deployment-Automatisierung (Provisioning, Updates) wird wichtiger

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 2.1.1 | **Tenant-Isolation-Strategie dokumentieren** – ~~Entscheidung: Separate DBs pro Mandant vs. RLS~~ → Entschieden: VPS + separate DB pro Schule. Architektur-Dokument erstellen. | `docs/architecture/multi-tenancy.md` (neu) | [x] |
| 2.1.2 | ~~**tenant_id in alle PII-Tabellen**~~ → **Entfaellt** – Physische Trennung durch separate VPS/DB. Kein tenant_id noetig. | -- | [x] |
| 2.1.3 | **AV-Vertrags-Management** – Digitale AV-Vertrags-Verwaltung: Templates, Signierung, Versionierung. Pro VPS-Instanz. | Neues Modul oder externer Dienst | [ ] |
| 2.1.4 | **Sub-Processor-Liste** – Oeffentlich zugaengliche Seite mit allen Unterauftragsverarbeitern. Benachrichtigung bei Aenderungen. | `src/pages/SubProcessors.tsx` (neu), Backend-Endpunkt | [ ] |
| 2.1.5 | **VPS-Provisioning-Automatisierung** – Skript/Playbook fuer neue Schul-Instanzen: VPS erstellen, Docker deployen, DB initialisieren, DNS/SSL einrichten. | `infrastructure/` (neu) | [ ] |
| 2.1.6 | **Zentrales Update-Management** – Mechanismus fuer Rolling Updates ueber alle VPS-Instanzen (Ansible, Docker Swarm, o.ae.). | `infrastructure/` (neu) | [ ] |
| 2.1.7 | **Zentrales Monitoring** – Health-Checks und Alerting fuer alle VPS-Instanzen. Downtime-Erkennung. | `infrastructure/monitoring/` (neu) | [ ] |

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
| 2.4.1 | ~~Datenschutz-Footer in alle Templates~~ → **Bereits erledigt** unter 0.4.2. Footer mit DSB-Kontakt, Verantwortlichem und Datenschutzerklaerung-Link in `template.js` implementiert. | `backend/emails/template.js` | [x] |
| 2.4.2 | **Abmeldelink in wiederkehrenden E-Mails** – Falls Erinnerungen oder Benachrichtigungen: Abmeldelink (List-Unsubscribe Header). | `backend/emails/` | [ ] |

---

## Phase 3: Niedrig – naechste Planungsphase (P3)

### 3.1 Erweiterte Datenschutz-Features

| # | Aufgabe | Dateien | Status |
|---|---------|---------|--------|
| 3.1.1 | ~~Verschluesselung von Art.-9-Feldern at Rest~~ → **Entfaellt** – Art.-9-Felder (concern/notes) wurden in Migration 035 komplett entfernt (siehe 0.2). Keine Verschluesselung noetig. | -- | [x] |
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
| C.1 | `generate-slots` in Shared-Modul extrahieren | Bereits in `backend/shared/counselorService.js` zentralisiert | P1 | [x] |
| C.2 | `generateUsername` deduplizieren | `backend/shared/generateUsername.js` (neu), teacherRoutes + counselorAdminRoutes nutzen shared | P1 | [x] |
| C.3 | Weekly-Schedule-Upsert deduplizieren | `teacherRoutes.js`, `counselorAdminRoutes.js` | P2 | [ ] |
| C.4 | Rate-Limiter auf `/api/teacher` Mount | `backend/modules/elternsprechtag/index.js` – adminLimiter hinzugefuegt | P1 | [x] |
| C.5 | Catch-Bloecke mit `logger.error` ergaenzen (24 Stellen) | Diverse | P2 | [ ] |
| C.6 | `SELECT *` durch explizite Spalten ersetzen (password_hash) | `teacherRoutes.js:541`, `teacher.js:890` – explicit column lists | P1 | [x] |
| C.7 | Toten Code entfernen (`teacherSystem`, `buildHalfHourWindows`) | `teacher.js:8,115` | P2 | [ ] |
| C.8 | `.env.example` vervollstaendigen | Alle 27 Variablen dokumentiert | P1 | [x] |

---

## Fortschritts-Tracker

| Phase | Gesamt | Offen | Teilweise | Abgeschlossen | Fortschritt |
|-------|--------|-------|-----------|---------------|-------------|
| P0: Go-Live-Blocker | 18 | 0 | 0 | 18 | 100% |
| P1: Hoch (4 Wochen) | 22 | 1 | 0 | 21 | 95% |
| P2: Mittel (3 Monate) | 15 | 9 | 0 | 6 | 40% |
| P3: Niedrig | 13 | 12 | 0 | 1 | 8% |
| Code-Hygiene | 8 | 3 | 0 | 5 | 63% |
| **Gesamt** | **76** | **25** | **0** | **51** | **~67%** |

---

## Referenzen

| Dokument | Pfad |
|----------|------|
| DSGVO-Anforderungen | `docs/compliance/dsgvo-anforderungen.md` |
| Dateninventar | `docs/compliance/dsgvo-dateninventar.md` |
| DB-Audit | `docs/security/db-audit-2026-03-17.md` |
| Audit 2026-03-18 | `docs/security/audit-2026-03-18.md` |
| Security Baseline | `docs/security/security-baseline.md` |
| Multi-Tenancy | `docs/architecture/multi-tenancy.md` |
| Consent-Checkbox | `docs/planning/dsgvo-consent-checkbox.md` |
| System-Design | `docs/architecture/system-design.md` |
