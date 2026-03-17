# ToDo – Docker / On-Premise-Deployment

## Vision
Das Projekt als selbstgehostetes Docker-Image ausliefern, das Schulen, Träger oder
IT-Dienstleister auf einem beliebigen VPS (oder lokal) starten können.
Funktionsmodule (Elternsprechtag, Schulsozialarbeit, Beratungslehrer …) sind
entkoppelt und können einzeln aktiviert / angedockt werden.

---

## Phase 1 – Containerisierung (Basis)

- [x] **Dockerfile Backend** – Node.js 20-Image, `npm ci --omit=dev`, Healthcheck
- [x] **Dockerfile Frontend** – Multi-Stage-Build: Vite-Build → nginx zum Ausliefern
- [x] **docker-compose.yml** – Services: `frontend`, `backend`, `postgres`
- [x] **.dockerignore** – `node_modules`, `dist`, `.env`, `uploads/`, `*.pid` ausschließen
- [x] **Volumes** – Persistentes DB-Volume (`pg_data`), Upload-Volume (`uploads`)
- [x] **Environment** – `.env.example` aktualisiert mit Docker-Defaults (`postgres`-Host, `POSTGRES_*`-Vars)
- [x] **Migrations automatisch** – 17 SQL-Dateien nummeriert (`001_`–`017_`), `backend/migrate.js` führt beim Start alle ausstehenden Migrationen aus (mit `applied_migrations`-Tabelle)
- [x] **Healthcheck-Endpoint** – `GET /api/health` existiert bereits (DB-Ping)

## Phase 2 – Konfiguration & Multi-Tenancy-Vorbereitung

- [x] **Zentrale Config** – E-Mail-Branding (Schulname, Logo, Farben) ist bereits über die Superadmin-UI + `email_branding`-Tabelle steuerbar
- [x] **Reverse-Proxy-Setup** – Beispiel-Configs für Caddy, Traefik und nginx in `../deployment/reverse-proxy-examples.md`
- [x] **CORS / Trusted Origins** – Env-Variable `CORS_ORIGINS` (kommasepariert) statt Hardcode in `index.js`
- [x] **Secrets-Management** – Alle Secrets über `.env`-Datei, mit Sicherheitshinweisen und Generierungs-Befehl in `.env.example`

## Phase 3 – Production Hardening

- [x] **Structured Logging** – Pino mit JSON-Output (Production) / Pretty-Print (Development), `console.log` komplett ersetzt
- [x] **Rate Limiting** – `express-rate-limit` auf Auth-Routen (20/15min) und Booking-Endpunkte (30/15min)
- [x] **Graceful Shutdown** – `SIGTERM`/`SIGINT`-Handler: HTTP-Server schließen, DB-Pool beenden, Force-Exit nach 10s
- [x] **Error Handling** – Stack-Traces nur in Development, strukturierte Fehler-Logs via Pino
- [x] **Security Headers** – Helmet.js aktiv (HSTS, X-Content-Type-Options, X-Frame-Options etc.)

## Phase 4 – CI/CD & Image-Veröffentlichung

- [x] **GitHub Actions** – `.github/workflows/docker-publish.yml` – Build + Push bei Release-Tag (`v*`)
- [x] **Container-Registry** – GitHub Container Registry (`ghcr.io/mph199/eduvitetest-backend`, `-frontend`)
- [x] **Versioning** – Semantic Versioning via Git-Tags, automatische `major.minor` + `sha`-Tags
- [x] **Smoke-Tests** – CI startet Stack aus gepushten Images → Healthcheck + Frontend-Check + API-Proxy-Check → Teardown

## Phase 5 – Betrieb & Dokumentation

- [x] **Admin-Installationsanleitung** – `../deployment/install.md` – Schritt-für-Schritt: VPS → Docker → `.env` → `docker compose up -d` → HTTPS → Backup → Monitoring → Troubleshooting
- [x] **Backup-Strategie** – `scripts/backup.sh` – DB-Dump + Uploads-Volume, Retention 30 Tage, Cron-ready
- [x] **Update-Prozess** – In install.md dokumentiert: `docker compose pull && docker compose up -d`
- [x] **Monitoring** – Health-Endpoint-Cron + Uptime Kuma Empfehlung in install.md
- [x] **Ressourcen-Empfehlung** – Min. 1 vCPU / 1 GB RAM, empfohlen 2 vCPU / 2 GB RAM

## Phase 6 – Login-Cookies (httpOnly)

- [x] **Backend: cookie-parser** – `npm install cookie-parser`, in `index.js` einbinden
- [x] **Backend: Cookie setzen** – Beim Login JWT als `httpOnly`, `SameSite=Lax`, `Secure`-Cookie setzen statt nur im JSON-Body zurückgeben
- [x] **Backend: Cookie lesen** – `requireAuth`-Middleware liest Token zuerst aus Cookie (`req.cookies`), dann Fallback auf `Authorization`-Header
- [x] **Backend: Cookie löschen** – Logout-Endpoint löscht das Cookie (`res.clearCookie`)
- [x] **Frontend: credentials** – Alle `fetch`-Aufrufe mit `credentials: 'include'` versehen
- [x] **Frontend: localStorage entfernen** – Token nicht mehr in `localStorage` speichern, Cookie-basierte Verify-Route nutzen
- [x] **CSRF-Schutz** – `SameSite=Lax` reicht für Standard-Formulare; bei Bedarf Double-Submit-Cookie ergänzen

## Zukunftsvision – Modulares Plugin-System ✅

> Langfristiges Ziel: Das Projekt modular aufbauen, sodass Funktionsmodule
> einzeln aktiviert werden können. Voraussetzung: Phase 1–5 stehen stabil.

- [x] **Modul-Architektur definieren** – Jedes Modul = eigener Ordner mit festem Interface (Routes, Migrationen, UI-Komponenten, Sidebar-Einträge, Rollen). Elternsprechtag als erstes Modul unter `backend/modules/elternsprechtag/` + `src/modules/elternsprechtag/` umgesetzt.
- [x] **Modul-Registry** – Backend: `ENABLED_MODULES` Env-Variable + `backend/moduleLoader.js` lädt Module dynamisch. Frontend: `VITE_ENABLED_MODULES` + `src/modules/registry.ts` filtert Module.
- [x] **Shared Kernel** – Auth (`routes/auth.js`), User-Verwaltung (`routes/admin.js`), E-Mail-Service (`config/email.js`), Branding (`routes/superadmin.js`) bleiben im `backend/`-Root als gemeinsamer Kern.
- [x] **Lazy Loading Frontend** – Module per `React.lazy()` + Dynamic Import → separate Chunks (BookingApp, AdminSlots, TeacherLayout etc.)

## Phase 7 – Superadmin & Tenant-Branding

> Ziel: Der Superadmin-Bereich wird vollständig verdrahtet, sodass Schulen/Träger
> das gesamte Erscheinungsbild ohne Code-Änderungen anpassen können.

### 7a – CSS-Variablen-Standardisierung
- [x] **Hardcoded Farben eliminieren** – Alle Hex-Werte in CSS-Dateien auf `var(--brand-*)` / `var(--color-*)` umgestellt (LoginPage, MaintenancePage, LegalPage, LandingPage, Sidebar, AdminDashboard, BookingApp, TeacherHome, NotificationBell — insgesamt 206 Ersetzungen)
- [x] **RGB-Helfer** – Für jede Brand-Variable auch die RGB-Variante in `:root` (`--brand-primary-rgb`, `-dark-rgb`, `-darker-rgb`, `-ink-rgb`) für `rgba()` Nutzung
- [x] **Navy-Farbschema** – Corporate Design (#123C73, #0B2545, #5B8DEF, #D9E4F2, #F8FAFC) als Standard-Defaults eingesetzt

### 7b – Seiten-Branding verdrahten (DB + API)
- [x] **Migration: `site_branding`-Tabelle** – `020_add_site_branding.sql` mit Farbschema (7 Farben), Schulname, Header-Schriftfarbe, Logo-URL, Landing-Page-Texte (hero_title, hero_text, step_1–3), tile_images (JSONB)
- [x] **Backend: CRUD-Endpoints** – `GET /api/superadmin/site-branding` (public, kein Auth — alle brauchen das Theme), `PUT` (superadmin only) mit Hex-Validierung, `POST /api/superadmin/tile-image` für Kachel-Bild-Upload
- [x] **Frontend: API-Client** – `getSiteBranding()`, `updateSiteBranding()`, `uploadTileImage()`, `resolveTileUrl()` in `api.ts`
- [x] **Frontend: BrandingProvider** – `BrandingContext.tsx` lädt Site-Branding beim App-Start, setzt 12 CSS-Custom-Properties auf `:root` (inkl. RGB-Helfer), `useBranding()` Hook für alle Komponenten
- [x] **Fallback** – Defaults in BrandingContext + Backend-Route greifen wenn keine DB-Konfiguration vorhanden

### 7c – Superadmin-UI erweitern
- [x] **Tab: Erscheinungsbild** – Voll verdrahtet: Schulname, Header-Schriftfarbe, 7 Farbfelder (Primary, Dark, Darker, Secondary, Ink, Surface 1/2), Hero-Texte, 3-Schritte-Anleitung, Kachel-Bilder pro Modul, Live-Vorschau → Speichern in `site_branding` → `BrandingProvider.reload()` aktualisiert gesamte App
- [x] **Tab: Landing Page** – Kachel-Bilder pro Modul per Upload, Hero-Text und Schritte editierbar, Landing Page zeigt dynamisch Branding-Daten + Kachel-Bilder (mit Emoji-Fallback)
- [ ] **Tab: Texte & Inhalte** – Impressum und Datenschutz als Markdown/HTML-Felder über Superadmin pflegbar (statt statische React-Komponenten)
- [ ] **Tab: System** – Maintenance-Modus per Toggle (sofort wirksam, kein Rebuild), Superadmin-Rolle an andere User vergeben

### 7d – Header & Landing Page dynamisch
- [x] **Schulname im Header** – `GlobalTopHeader` liest Schulname + Schriftfarbe aus `useBranding()` statt hardcoded "BKSB", dynamische `aria-label`
- [x] **Landing-Page-Kacheln** – Kachel-Bilder aus DB laden (via `branding.tile_images`), Fallback auf Emoji. 3-Schritte-Row + Hero-Texte dynamisch aus Branding
- [x] **Superadmin-Link** – Zugriff über `user.role === 'superadmin'` statt `username === 'marc.huhn'`; Hard-Coded Admin (`Start`) bekommt automatisch Rolle `superadmin`

### 7e – E-Mail-Branding synchronisieren
- [x] **Farben koppeln** – Beim Speichern von Seiten-Branding wird `primary_color` automatisch in `email_branding` aktualisiert
- [x] **Schulname koppeln** – `school_name` wird ebenfalls synchronisiert (Backend: `UPDATE email_branding SET school_name, primary_color` nach site_branding-Save)

## Phase 8 – Microsoft 365 Login (Azure AD / Entra ID)

- [ ] **Azure App-Registrierung** – Multi-Tenant-App in Azure Entra ID anlegen (Client-ID + Client-Secret), Redirect-URI konfigurieren
- [ ] **Backend: OpenID Connect** – OAuth 2.0 Authorization Code Flow implementieren (`/api/auth/microsoft` → Redirect zu Microsoft, `/api/auth/microsoft/callback` → Token-Austausch)
- [ ] **Backend: passport-azure-ad oder msal-node** – `npm install @azure/msal-node` für Token-Handling + ID-Token-Validierung
- [ ] **Backend: User-Matching** – E-Mail aus Microsoft-Profil mit bestehender `users`-Tabelle abgleichen; optional Auto-Anlage bei erstem Login
- [ ] **Backend: Env-Variablen** – `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (oder `common` für Multi-Tenant)
- [ ] **Frontend: Login-Button** – "Mit Microsoft anmelden"-Button auf der Login-Seite, leitet zu `/api/auth/microsoft` weiter
- [ ] **Frontend: Callback-Route** – Redirect nach erfolgreichem Microsoft-Login verarbeiten, JWT-Cookie setzen (Phase 6)
- [ ] **Admin Consent** – Dokumentation für Schul-IT: Welche Berechtigungen die App braucht (`User.Read`, `openid`, `profile`, `email`), wie Admin Consent erteilt wird
- [ ] **HTTPS Pflicht** – Microsoft erlaubt nur HTTPS-Redirect-URIs (außer localhost); in install.md als Voraussetzung dokumentieren
- [ ] **Fallback** – Klassischer Username/Passwort-Login bleibt parallel bestehen für Schulen ohne Microsoft 365

## Phase 9 – DSGVO & Datenhygiene

> Ziel: Vollständige DSGVO-Konformität (Verordnung (EU) 2016/679) für den Betrieb
> an öffentlichen Schulen und in Zusammenarbeit mit Schulträgern. Schulen sind
> verantwortliche Stellen i. S. d. DSGVO; die Software muss alle technischen und
> organisatorischen Maßnahmen (TOMs) unterstützen.

### 9a – Bestandsaufnahme personenbezogener Daten

Folgende Tabellen enthalten personenbezogene Daten (PII), die unter die DSGVO fallen:

| Tabelle | PII-Spalten | Kategorie | Aufbewahrungszweck |
|---------|-------------|-----------|-------------------|
| `users` | `username`, `email`, `password_hash` | Beschäftigtendaten | Authentifizierung |
| `teachers` | `first_name`, `last_name`, `email`, `phone`, `salutation` | Beschäftigtendaten | Lehrkräfte-Verwaltung |
| `slots` | `email`, `parent_name`, `student_name`, `company_name`, `message` | Eltern-/Schülerdaten | Terminbuchung |
| `booking_requests` | `email`, `parent_name`, `student_name`, `representative_name`, `message` | Eltern-/Schülerdaten | Buchungsanfragen |
| `ssw_counselors` | `first_name`, `last_name`, `email`, `phone` | Beschäftigtendaten | Beraterverwaltung |
| `ssw_appointments` | `student_name`, `notes` | Schülerdaten (sensibel) | Beratungstermine |
| `feedback` | `message` | Pseudonym/anonym | Rückmeldungen |

### 9b – Automatische Datenlöschung (Speicherfristkonzept)

- [ ] **Admin-Settings-Tabelle** – Neue Migration: `settings`-Tabelle mit Key-Value-Paaren für Retention-Zeiträume (z. B. `booking_retention_days = 90`, `ssw_retention_days = 365`)
- [ ] **Superadmin-UI: Speicherfristen** – Neuer Tab "Datenschutz" im Superadmin-Bereich: Eingabefelder für Aufbewahrungsfristen pro Datentyp (Buchungen, SSW-Termine, Feedback), Mindest-/Maximalwerte
- [ ] **Cleanup-Cronjob** – `node-cron`-Job im Backend (täglich 02:00 Uhr): Löscht/anonymisiert abgelaufene Datensätze basierend auf `created_at` + konfigurierter Frist
- [ ] **Anonymisierung statt Löschung** – Option: Statt `DELETE` werden PII-Felder durch Platzhalter ersetzt (`parent_name → 'Gelöscht'`, `email → NULL`), damit Statistiken erhalten bleiben
- [ ] **Audit-Log** – Löschvorgänge protokollieren: Wann, welche Tabelle, wie viele Datensätze, durch wen/was ausgelöst (Cronjob vs. manuell)
- [ ] **Manueller Lösch-Button** – Admin-UI: "Alte Daten jetzt bereinigen" mit Vorschau (X Datensätze betroffen) und Bestätigungsdialog

Empfohlene Standard-Fristen (konfigurierbar):
- Buchungsdaten (`slots`, `booking_requests`): **90 Tage** nach Event-Datum
- SSW-Termine (`ssw_appointments`): **365 Tage** (besondere Kategorie, schulrechtliche Aufbewahrungspflicht)
- Feedback: **180 Tage**
- Benutzerkonten: Manuell durch Admin (kein Auto-Delete für Beschäftigte)

### 9c – Betroffenenrechte (Art. 15–21 DSGVO)

- [ ] **Datenauskunft (Art. 15)** – API-Endpoint `GET /api/admin/data-export?email=` durchsucht alle PII-Tabellen nach einer E-Mail-Adresse und liefert alle gespeicherten Daten als JSON oder CSV
- [ ] **Recht auf Löschung (Art. 17)** – API-Endpoint `DELETE /api/admin/data-deletion?email=` löscht/anonymisiert alle Datensätze einer Person (mit Bestätigung und Audit-Log)
- [ ] **Admin-UI: Datenschutz-Anfragen** – Formular im Admin-Bereich: E-Mail eingeben → Vorschau aller Treffer in allen Tabellen → Buttons "Daten exportieren (CSV)" / "Daten löschen"
- [ ] **Datenportabilität (Art. 20)** – Export als maschinenlesbares JSON (bereits durch Art.-15-Export abgedeckt)
- [ ] **Widerspruchsrecht (Art. 21)** – Bei automatisierten E-Mail-Erinnerungen (Phase 10): Opt-Out-Link in jeder E-Mail, Flag `email_opt_out` in `booking_requests`

### 9d – Datenschutzhinweise & Einwilligungen

- [ ] **Datenschutzhinweis auf Buchungsseite** – Pflichthinweis vor Buchungsabschluss: Welche Daten werden gespeichert (Name, E-Mail, Terminwunsch), Zweck (Terminkoordination), Speicherdauer (konfiguriert), Verantwortliche Stelle (Schulname aus Branding), Rechte der Betroffenen (Auskunft, Löschung, Beschwerde bei Aufsichtsbehörde)
- [ ] **Einwilligungs-Checkbox** – Pflicht-Checkbox im Buchungsformular: "Ich habe die Datenschutzhinweise gelesen und stimme der Verarbeitung meiner Daten zum Zweck der Terminbuchung zu." (Buchung ohne Häkchen nicht möglich)
- [ ] **Impressum/Datenschutz editierbar** – (verknüpft mit Phase 7c): Superadmin pflegt Impressum und Datenschutzerklärung als Freitext, wird auf `/datenschutz` und `/impressum` angezeigt
- [ ] **Auftragsverarbeitung (AV-Vertrag)** – Muster-AV-Vertrag als PDF/Markdown in `docs/AV-Vertrag-Muster.md`: Gegenstand der Verarbeitung, Art der Daten, Kreis der Betroffenen, TOMs des Auftragsverarbeiters, Unterauftragsverhältnisse, Löschkonzept
- [ ] **Verarbeitungsverzeichnis** – Vorlage für das Verzeichnis der Verarbeitungstätigkeiten (Art. 30 DSGVO) in `docs/Verarbeitungsverzeichnis.md`: Name des Systems, Zweck, Kategorien betroffener Personen, Kategorien personenbezogener Daten, Empfänger, Löschfristen

### 9e – Technische Datenschutzmaßnahmen

- [ ] **Verschlüsselung at Rest** – PostgreSQL-Volume mit LUKS/dm-crypt verschlüsseln (Dokumentation in install.md), alternativ: Managed PostgreSQL mit Encryption at Rest
- [ ] **Verschlüsselung in Transit** – HTTPS-Pflicht dokumentieren (Reverse-Proxy mit TLS), interne Docker-Kommunikation über isoliertes Netzwerk
- [ ] **Minimale Datenerhebung** – Prüfung: Welche Felder sind wirklich nötig? `company_name` und `message` in Slots als optional markieren, nicht-benötigte Felder entfernen
- [ ] **Pseudonymisierung SSW-Daten** – Besonders sensible SSW-Beratungsdaten (`notes`): Verschlüsselung auf Anwendungsebene (AES-256-GCM), Schlüssel pro Schule, nur autorisierte SSW-Berater können entschlüsseln
- [ ] **Backup-Verschlüsselung** – `scripts/backup.sh` erweitern: DB-Dumps mit GPG verschlüsseln, Schlüsselmanagement dokumentieren

## Phase 10 – Automatische Erinnerungen

- [ ] **E-Mail-Erinnerung Eltern** – Cronjob sendet X Stunden vor dem Termin eine Erinnerung an Eltern (konfigurierbar)
- [ ] **Tagesübersicht Lehrkräfte** – Optionale Morgen-Mail mit allen Terminen des Tages
- [ ] **Node-Cron oder externer Cron** – Entscheidung: `node-cron` im Backend-Prozess oder separater Container/Systemd-Timer
- [ ] **Duplikat-Schutz** – Sicherstellen, dass Erinnerungen nicht doppelt gesendet werden (Sent-Flag in DB)

## Phase 11 – CSV-Import Lehrkräfte

- [x] **CSV-Import Endpoint** – `POST /api/admin/teachers/import-csv` (multipart/form-data, multer): Semikolon- oder kommagetrennte CSV mit Kopfzeile, flexibles Column-Mapping (deutsch/englisch: Nachname, Vorname, Email, Anrede, Raum, Fach, Sprechzeit_von, Sprechzeit_bis)
- [x] **CSV-Parser** – Eigener RFC-konformer Parser (Quotes, Escaped Quotes, Semikolon + Komma als Trenner), kein externes Dependency
- [x] **Validierung** – Pflicht-Spalten (Nachname, Email), E-Mail-Validierung, Duplikat-Erkennung (existierende E-Mails werden übersprungen), ungültige Zeilen gesammelt mit Zeilennummer + Grund
- [x] **Bulk-Anlage** – Pro importierter Zeile: Teacher (first_name/last_name), User-Account (auto username: vorname.nachname), Passwort (crypto.randomBytes), Zeitslots fürs aktive Event
- [x] **Frontend: CSV Import Button** – In AdminTeachers: „CSV Import"-Button neben „Neuer Nutzer", Hidden File-Input, Dateiauswahl → sofortiger Upload
- [x] **Frontend: Ergebnis-Dialog** – Zusammenfassung (X importiert, Y übersprungen, Z gesamt), aufklappbare Tabelle mit Zugangsdaten (Name, Email, Username, Passwort, Slots), aufklappbare Liste übersprungener Zeilen mit Gründen
- [x] **Zugangsdaten-Export** – Button „Zugangsdaten als CSV herunterladen" generiert client-seitig eine CSV mit Name/Email/Username/Passwort der importierten Lehrkräfte
- [x] **Format-Hinweis** – Info-Box im Import-Dialog zeigt erwartetes CSV-Format

## Phase 12 – Barrierefreiheit (WCAG 2.1 AA)

- [ ] **Tastaturnavigation** – Alle interaktiven Elemente per Tab/Enter erreichbar
- [ ] **Screenreader** – ARIA-Labels, Rollen und Live-Regions für dynamische Inhalte
- [ ] **Kontraste & Schriftgrößen** – Farbkontraste mindestens 4.5:1, skalierbare Schrift
- [ ] **Audit** – Bestehende Komponenten mit axe/Lighthouse prüfen + Nachbesserung

## Phase 13 – Security Hardening (Angriffsschutz)

> Ziel: Die Anwendung gegen die häufigsten Angriffsvektoren absichern (OWASP Top 10)
> und für den Betrieb an Schulen mit sensiblen Schülerdaten produktionsreif machen.

### Aktueller Sicherheitsstand (Ist-Zustand)

| Maßnahme | Status | Details |
|----------|--------|---------|
| SQL-Injection-Schutz | Implementiert | Alle Queries parametrisiert (`$1`, `$2`, ...) |
| Passwort-Hashing | Implementiert | bcrypt mit 10 Runden |
| httpOnly-Cookies | Implementiert | JWT in Cookie, `SameSite=Lax`, `Secure` in Prod |
| Rate Limiting | Implementiert | Auth: 20/15min, Booking: 30/15min |
| CORS | Implementiert | Dynamisch via `CORS_ORIGINS` Env-Variable |
| Helmet.js | Implementiert | Standard-Security-Headers inkl. CSP |
| Graceful Shutdown | Implementiert | SIGTERM/SIGINT mit 10s Force-Timeout |
| Structured Logging | Implementiert | Pino, keine Stack-Traces in Production |
| Row Level Security | Implementiert | `feedback`, `events`, `booking_requests` |

### 13a – Content Security Policy (CSP)

- [x] **CSP-Header aktivieren** – Helmet.js CSP aktiv mit strikten Direktiven: `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`, `connect-src 'self' + CORS_ORIGINS`, `object-src 'none'`, `frame-ancestors 'none'` (`backend/index.js:34-48`)
- [x] ~~**CSP-Report-Only**~~ – SKIP: CSP ist direkt enforced und funktioniert, Report-Only nicht noetig
- [x] ~~**Nonce-basiertes Script-Loading**~~ – SKIP: Vite generiert statische Module, kein Inline-JS vorhanden
- [x] **CSP fuer Uploads** – Restriktive CSP auf `/uploads`: `default-src 'none'; img-src 'self'; script-src 'none'` + `nosniff` (`backend/index.js:91-95`)
- [ ] **Nginx-Template** – CSP-Header in `../deployment/reverse-proxy-examples.md` als Referenz-Config ergänzen

### 13b – Cross-Site Request Forgery (CSRF)

- [x] **CSRF-Risikobewertung** – SameSite=Lax + CORS Origin-Pruefung bieten ausreichenden Schutz. Kein Shared-Hosting, kein Subdomain-Szenario. Designentscheidung dokumentiert in `../security/security-baseline.md` Abschnitt 4
- [x] ~~**Double-Submit-Cookie**~~ – SKIP: SameSite=Lax + CORS reicht fuer unser Deployment-Szenario. Siehe `../security/security-baseline.md` fuer Begruendung
- [x] **Origin/Referer-Validierung** – CORS-Middleware prueft Origin gegen `CORS_ORIGINS` Whitelist (`backend/index.js:50-57`)

### 13c – Cross-Site Scripting (XSS)

- [ ] **Input-Sanitization** – Empfohlen: `sanitize-html` serverseitig fuer Freitext-Felder (`message`, `feedback`, `notes`). Prioritaet: Mittel (React escaped bereits alle Outputs)
- [x] **Output-Encoding** – React escaped standardmaessig. 1x `dangerouslySetInnerHTML` in EmailBrandingTab (admin-only, escaped Input) – sicher
- [x] **E-Mail-Template-Escaping** – `esc()`-Funktion auf allen User-Inputs in `backend/emails/template.js:35-41`
- [x] **HTTP-Header** – `X-Content-Type-Options: nosniff` via Helmet + explizit auf /uploads. CSP aktiv

### 13d – Authentifizierung & Session-Management

- [x] **JWT-Secret Rotation** – Dokumentiert in `../security/security-baseline.md` Abschnitt 11 (Vorgehensweise, Rhythmus, Auswirkungen)
- [x] **Token-Lebensdauer** – 8h konfiguriert (`backend/middleware/auth.js:20`), Cookie-maxAge synchron (`backend/routes/auth.js:16`)
- [x] **Cookie-Security** – httpOnly, secure (Prod), sameSite=lax. Bearer-Header-Extraktion entfernt (`backend/middleware/auth.js:63-68`)
- [ ] **Token-Lebensdauer verkürzen** – Von 8h auf 4h (Standard) / 2h (Admin) reduzieren
- [ ] **Refresh-Token-Mechanismus** – Access-Token 15min + Refresh-Token 7d in separatem httpOnly-Cookie
- [ ] **Account-Lockout** – Nach 5 Fehlversuchen: 15min Sperre auf Account-Ebene
- [ ] **Passwort-Richtlinien** – Min. 10 Zeichen, Komplexitaetspruefung
- [ ] **Passwort-Änderung erzwingen** – `force_password_change`-Flag in `users`-Tabelle

### 13e – API-Sicherheit

- [x] **Rate Limiting** – Auth 20/15min, Booking 30/15min, Admin 100/15min, Public/SA 60/15min (`backend/index.js:64-86`, `backend/routes/superadmin.js:13-19`)
- [x] **Request-Size-Limits** – JSON auf 100kb begrenzt (`backend/index.js:61`), Uploads separat: Logo/Tile 2MB, Hintergrund 5MB
- [x] **File-Upload-Validierung** – MIME-Type + Extension-Pruefung, SVG blockiert, Dateinamen sanitiert (Prefix+Timestamp), isoliertes Upload-Verzeichnis (`backend/routes/superadmin.js:26-51`)
- [x] **Request-Logging** – Pino mit Method+URL (`backend/index.js:98-100`), JSON in Production, Pretty in Dev
- [x] **SQL-Parametrisierung** – Durchgehend `$1, $2` in allen Queries
- [ ] **API-Versionierung** – Langfristig: `/api/v1/` Prefix (niedrige Prioritaet)

### 13f – Infrastruktur-Sicherheit

- [x] **Health Checks** – Backend + PostgreSQL mit Health Checks konfiguriert (`Dockerfile.backend:14-15`, `docker-compose.yml:13-17`)
- [x] **Multi-Stage Build** – Frontend: node -> nginx, reduziert Image-Groesse (`Dockerfile.frontend`)
- [x] **Dependency-Scanning** – GitHub Dependabot konfiguriert (`.github/dependabot.yml`) fuer npm + Docker
- [ ] **Docker non-root** – `USER node` in `Dockerfile.backend` ergaenzen
- [ ] **Netzwerk-Isolation** – Explizite Docker-Netzwerke (frontend, backend) definieren
- [ ] **PostgreSQL-Port** – Port 5432 in Produktion nicht exponieren (siehe `../security/security-baseline.md` Abschnitt 10)
- [ ] **Secrets-Management** – Docker Secrets statt Env-Variablen fuer sensitive Werte
- [ ] **Security-Headers Audit** – Regelmaessig mit securityheaders.com pruefen
- [ ] **PostgreSQL SSL** – CA-Zertifikat konfigurieren, `rejectUnauthorized: true` setzen

### 13g – Monitoring & Incident Response

- [x] **Incident-Response-Plan** – Dokumentiert in `../security/security-baseline.md` Abschnitt 13 (Meldekette, 72h DSGVO-Frist, Sofortmassnahmen, Backup/Restore)
- [x] **Penetration-Test-Checkliste** – Dokumentiert in `../security/security-baseline.md` Abschnitt 14 (14 automatisierte + 5 manuelle Testfaelle)
- [ ] **Security-Event-Logging** – Fehlgeschlagene Logins + 403/401 in separatem Log-Stream erfassen
- [ ] **Alerting** – Benachrichtigung bei auffaelligen Mustern (>10 Failed Logins/Minute)

### Mögliche Module (Ideen)

| Modul                  | Beschreibung                                                       |
|------------------------|--------------------------------------------------------------------|
| **Elternsprechtag**    | ✅Bestehendes System (Kern)                                          |
| **Schulsozialarbeit**  | ✅ Terminbuchung für Beratungsgespräche, vertrauliche Notizen      |
| **Beratungslehrer**    | ✅ Sprechstunden, Themenkategorien                                    |
| **Berufsorientierung** | Betriebsbesuche, Praktikumsplätze, Matching                       |
| **Fächerwahl** | Fächer/Kurse für eine Jahrgangsstufe wählen, , Matching der Fächer, Ausgabe von Liste von schülern die ein fach belegt haben     |

---

> **Nächster konkreter Schritt:** Phase 1 – Dockerfile + docker-compose.yml erstellen und lokal testen.

---

## Phase 12 – Modul Schulsozialarbeit

- [x] **Migration 022** – `ssw_counselors`, `ssw_categories`, `ssw_appointments` Tabellen + 5 Default-Kategorien geseedet
- [x] **Backend-Modul** – `backend/modules/schulsozialarbeit/index.js` (Manifest mit `register()`)
- [x] **Public API** – `GET /api/ssw/counselors`, `GET /api/ssw/categories`, `GET /api/ssw/appointments/:id?date=`, `POST /api/ssw/appointments/:id/book`
- [x] **Counselor API** – Authentifizierte Routen: eigene Termine, Slots generieren, bestätigen/absagen/Notizen
- [x] **Admin API** – CRUD für Berater/innen und Kategorien, Statistik-Endpoint
- [x] **Service-Layer** – `appointmentService.js` mit Zeitslot-Generierung, Buchungslogik
- [x] **Frontend BookingApp** – 4-Schritt-Wizard (Berater → Datum/Zeit → Formular → Bestätigung) mit Vertraulichkeitshinweis
- [x] **Frontend Admin** – Berater-CRUD, Kategorien-CRUD, Slot-Generierung, Statistik-Dashboard (Tabs)
- [x] **Modul-Manifest** – `src/modules/schulsozialarbeit/index.ts` (ModuleDefinition mit lazy-loading)
- [x] **Registry** – In `src/modules/registry.ts` registriert
- [x] **Docker Build** – Erfolgreich gebaut, Migration 022 automatisch angewandt, Modul geladen

## Phase 14 – UX & Responsive (Mobile/Tablet)

> Ziel: Alle Seiten auf Mobile (<640px) und Tablet (<768px) nutzbar machen.
> Touch-Targets mindestens 44px (WCAG 2.5.5). Kein horizontales Scrollen.

### 14a – Buchungstool (oeffentliche Seiten)

- [x] **CounselorBookingApp.css** – Media Queries fuer Tablet (768px), Mobile (640px), Small (480px): Touch-Targets 44px, full-width Buttons, responsive Padding, overflow-wrap
- [x] **BookingApp.css** – Sidebar sticky top-Offset (`calc(var(--globalTopHeaderHeight) + 0.75rem)`), iOS `background-attachment: scroll` Workaround, tote CSS-Klassen entfernt (`.header-filters`, `.filter-actions`)
- [x] **LandingPage.css** – iOS background-attachment Fix, Steps column-Layout auf <480px, responsive Subtitle
- [x] **CounselorBookingLayout.css** – iOS background-attachment Fix

### 14b – Adminbereich

- [x] **AdminDashboard.tsx** – Inline `width`-Styles von `<th>` entfernt (CSS-Override moeglich)
- [x] **AdminDashboard.css** – Touch-Targets 44px, ev-cell-date word-break, Teacher-Bookings Padding <480px
- [x] **BLAdmin.tsx** – `data-label` auf alle 4 Tabellen (Anfragen, Berater, Themen, Kalender-Detail), `flexWrap` auf Schedule-Rows und Date-Range-Input
- [x] **SSWAdmin.tsx** – `data-label` auf alle 4 Tabellen (Schedule, Berater, Kalender-Detail, Kategorien), `flexWrap` auf Tab-Buttons und Aktions-Buttons
- [x] **SuperadminPage.css** – Background-Card column-Layout auf <600px

### 14c – Lehrerbereich

- [x] **TeacherHome.css** – CSS-Syntaxfehler behoben (ueberfluessige `}`)
- [x] **TeacherRequestsTableSandbox.css** – Modal-Pfeile 44px Touch-Target, Slot-Picker min-height 44px, tote `min-width: 1160px` entfernt
- [x] **TeacherBookings.tsx** – stat-card flex von `0 0 220px` auf `1 1 220px` fuer Mobile-Umbrechen

### 14d – Backlog (noch offen)

- [ ] **BLAdmin/SSWAdmin Wochenplan** – CSS-Card-Ansicht statt Tabelle auf Mobile
- [ ] **AdminEvents Datumsstrings** – Langere Strings auf Tablet weiter optimieren
- [ ] **Inline-Styles in BLAdmin/SSWAdmin** – Schrittweise durch CSS-Klassen ersetzen (aktuell ~44/43 inline-styles)
- [ ] **Lighthouse Mobile-Audit** – Alle Seiten mit Lighthouse Mobile-Profil testen
