# CLAUDE.md – Projektkontext für Claude Code

## Projektüberblick

**eduViteTest** ist ein modulares Schulverwaltungssystem für Elternsprechtage, Schulsozialarbeit und weitere Schulmodule. Schulen, Träger oder IT-Dienstleister können es als Docker-Container selbst hosten.

### Tech-Stack

| Schicht    | Technologie                                      |
|------------|--------------------------------------------------|
| Frontend   | React 19, TypeScript 5.9, Vite 7, React Router 7 |
| Backend    | Node.js 20 (ESM), Express.js, JWT (httpOnly Cookie) |
| Datenbank  | PostgreSQL 16 (Alpine)                           |
| Deployment | Docker Compose (3 Services), GitHub Actions CI/CD |
| E-Mail     | Nodemailer (Ethereal Dev / SMTP Produktion)      |

### Corporate Design

- Navy-Farbschema: `--brand-primary: #123C73`
- Alle Farben über CSS Custom Properties (`var(--brand-*)`)
- Branding ist über Superadmin-UI + `site_branding`-Tabelle konfigurierbar

---

## Schnellstart

```bash
# Docker Stack starten (bevorzugt)
docker compose up -d

# Oder manuell:
cd /workspaces/eduViteTest && npm install && npm run dev          # Frontend :5173
cd /workspaces/eduViteTest/backend && npm install && npm run dev  # Backend  :4000
```

### Docker Services

| Service    | Port  | Image/Dockerfile         |
|------------|-------|--------------------------|
| postgres   | 5432  | `postgres:16-alpine`     |
| backend    | 4000  | `Dockerfile.backend`     |
| frontend   | 3000  | `Dockerfile.frontend`    |

Volumes: `pg_data` (DB), `uploads` (Datei-Uploads)

### Env-Variablen (wichtigste)

- `DATABASE_URL` – PostgreSQL Connection String
- `SESSION_SECRET` – JWT-Secret
- `ENABLED_MODULES` / `VITE_ENABLED_MODULES` – Kommaseparierte Modulliste
- `CORS_ORIGINS` – Erlaubte Origins
- `MAIL_TRANSPORT` – `ethereal` (Dev) oder `smtp` (Prod)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` – SMTP-Konfiguration

---

## Architektur

### Modul-System

Das Projekt nutzt ein Plugin-artiges Modul-System. Module werden über Env-Variablen aktiviert.

**Backend:** `backend/moduleLoader.js` lädt Module dynamisch aus `backend/modules/*/index.js`
**Frontend:** `src/modules/registry.ts` registriert Module, `VITE_ENABLED_MODULES` filtert

Aktive Module:
- **elternsprechtag** – Kern-Modul: Buchungsanfragen, Lehrkräfte-Verwaltung, Slot-System, E-Mail-Flows
- **schulsozialarbeit** – SSW-Modul: Beratungstermine, Berater/innen, Themen (ehem. Kategorien)

### Authentifizierung

- JWT in httpOnly Cookies (`SameSite=Lax`, `Secure`)
- 4 Rollen: `admin`, `teacher`, `superadmin`, `ssw`
- Middleware: `requireAuth`, `requireAdmin`, `requireTeacher`, `requireSuperadmin`, `requireSSW`
- Frontend: `AuthContext` + `useAuth()` Hook, `ProtectedRoute` mit `allowedRoles`
- Dual-Rollen-Nutzer (admin+teacher): ViewModeToggle in `localStorage.active_view`

### Datenbank

- DB-Name: `sprechtag`, User: `sprechtag`
- 24 Migrationen (001–024), automatisch via `backend/migrate.js` beim Start
- Migrationen tracken: `applied_migrations`-Tabelle

### E-Mail-System

- Nodemailer mit Ethereal (Dev) oder SMTP (Prod)
- Integriert nur mit Elternsprechtag-Modul (Verifizierung, Bestätigung, Storno)
- SSW-Modul hat **keine** E-Mail-Integration

---

## Agent-Team

Dieses Projekt nutzt spezialisierte Sub-Agents für wiederkehrende Aufgaben.
Jeder Agent hat einen klaren Fokus und arbeitet nur in seinem Zuständigkeitsbereich.
Der **Umsetzer** koordiniert die anderen Agents und führt die eigentliche Implementierung durch.

### Rollen

#### Erkunder (Explore-Agent)

**Wann:** Vor jeder nicht-trivialen Änderung. Immer zuerst einsetzen, wenn der Kontext unklar ist.

**Fokus:**
- Abhängigkeiten zwischen Dateien nachverfolgen (Imports, API-Aufrufe, DB-Queries)
- Bestehende Patterns und Konventionen identifizieren
- Betroffene Dateien und Seiteneffekte auflisten
- Datenfluss nachvollziehen (Frontend → API-Client → Backend-Route → DB)

**Relevante Dateien:**
- `src/services/api.ts` – Alle API-Methoden und Endpunkte
- `src/types/index.ts` – TypeScript-Interfaces
- `src/modules/registry.ts` – Registrierte Module
- `backend/moduleLoader.js` – Modul-Lademechanismus
- `backend/middleware/auth.js` – Rollen und Auth-Middleware
- `docs/AI_GUIDE.md` – Ausführliche Architektur-Dokumentation

**Beispiel-Prompts:**
```
Untersuche als Erkunder: Welche Dateien sind betroffen, wenn ich dem SSW-Modul
E-Mail-Benachrichtigungen hinzufüge? Verfolge den Datenfluss vom Frontend bis zur DB.
```
```
Erkunder: Finde alle Stellen, die requireAdmin verwenden und prüfe,
ob requireSSW dort ebenfalls berücksichtigt werden muss.
```

#### Architekt (Plan-Agent)

**Wann:** Bei neuen Features, neuen Modulen, Schema-Änderungen oder strukturellen Entscheidungen.

**Fokus:**
- Migrationsplan erstellen (nächste Nummer, Abhängigkeiten, Rollback-Strategie)
- Modul-Architektur entwerfen (Backend-Routes, Frontend-Komponenten, Typen)
- API-Verträge definieren (Request/Response-Format, Endpunkt-Benennung)
- Bestehende Module als Referenz nutzen (elternsprechtag, schulsozialarbeit)

**Relevante Dateien:**
- `docs/MODULE_GUIDE.md` – Schritt-für-Schritt-Anleitung für neue Module
- `backend/modules/schulsozialarbeit/index.js` – Referenz: Backend-Modul-Manifest
- `src/modules/schulsozialarbeit/index.ts` – Referenz: Frontend-Modul-Manifest
- `backend/migrations/` – Bestehende Migrationen (aktuell 001–024, nächste: 025)

**Beispiel-Prompts:**
```
Entwirf als Architekt: Ein neues Modul "Beratungslehrer" mit anonymer
Anfrage-Funktion. Definiere DB-Schema, API-Endpunkte und Frontend-Struktur.
Nutze das SSW-Modul als Vorlage.
```
```
Architekt: Plane die Migration für Phase 9 (DSGVO-Datenlöschung).
Welche Tabellen brauchen ein Löschdatum? Welche Abhängigkeiten bestehen?
```

#### Prüfer (Review-Agent)

**Wann:** Vor Commits, nach größeren Änderungen, bei Security-relevanten Bereichen.

**Fokus:**
- Konventionen prüfen (ESM-Imports, `credentials: 'include'`, Array-Normalisierung, keine Emojis)
- Sicherheit: Auth-Middleware korrekt eingesetzt, keine offenen Endpunkte, Rate Limiting
- TypeScript: Strict-Mode-Fehler, fehlende Typen, `any`-Vermeidung
- SQL: Injection-Schutz (parametrisierte Queries), `IF NOT EXISTS` bei CREATE

**Checkliste:**

| Bereich | Prüfpunkte |
|---------|------------|
| Backend-Route | `requireAuth`/`requireAdmin` vorhanden? Rate Limiter? `try/catch`? |
| Frontend-Fetch | `credentials: 'include'`? Response zu Array normalisiert? Fehler-State? |
| Migration | `IF NOT EXISTS`? Nächste Nummer korrekt? Keine destruktiven Änderungen? |
| Modul | In `registry.ts` registriert? `ENABLED_MODULES` dokumentiert? |
| CSS | `var(--brand-*)` statt Hardcoded-Farben? Keine Emojis in der UI? |

**Beispiel-Prompts:**
```
Prüfe als Prüfer: Alle neuen/geänderten Dateien auf Einhaltung der
Projektkonventionen. Achte besonders auf Auth-Middleware und API-Response-Format.
```
```
Prüfer: Security-Audit für das SSW-Modul. Sind alle Admin-Routen
mit requireSSW/requireAdmin geschützt? Gibt es SQL-Injection-Risiken?
```

#### Umsetzer (Koordinator)

**Wann:** Für die eigentliche Implementierung. Koordiniert die anderen Agents.

**Arbeitsablauf:**
1. Erkunder einsetzen → betroffene Dateien und Patterns verstehen
2. Bei komplexen Features: Architekt für Planung einsetzen
3. Implementierung durchführen
4. `npm run build` im Frontend ausführen (TypeScript-Prüfung)
5. Prüfer einsetzen → Konventionen und Sicherheit prüfen
6. Commit erstellen nach Konvention: `feat(scope):`, `fix(scope):`, `ui(scope):`

### Team-Workflows

#### Neues Modul erstellen

```
1. Erkunder: Analysiere bestehende Module (elternsprechtag + schulsozialarbeit)
   als Referenz. Lies docs/MODULE_GUIDE.md.

2. Architekt: Entwirf das Modul-Schema:
   - DB-Tabellen (Migration 025_<name>.sql)
   - Backend: routes/ und index.js mit register()
   - Frontend: components/, pages/, index.ts mit ModuleDefinition
   - API-Endpunkte (öffentlich + admin)

3. Umsetzer: Implementiere in dieser Reihenfolge:
   a) backend/migrations/025_<name>.sql
   b) backend/modules/<name>/routes/*.js
   c) backend/modules/<name>/index.js
   d) src/modules/<name>/components/*.tsx
   e) src/modules/<name>/index.ts
   f) src/modules/registry.ts (Import + allModules-Eintrag)

4. Prüfer: Checkliste abarbeiten. Build prüfen: npm run build
```

#### Bug fixen

```
1. Erkunder: Bug reproduzieren und Datenfluss nachverfolgen.
   Welche Dateien sind betroffen? Wo liegt die Ursache?

2. Umsetzer: Minimalen Fix implementieren.
   Seiteneffekte auf andere Module prüfen.

3. Prüfer: Fix auf Regressionen prüfen.
```

#### Feature erweitern

```
1. Erkunder: Bestehende Implementierung analysieren.
   Alle Dateien auflisten, die das Feature betreffen.

2. Architekt (bei Schema-Änderungen): Migration planen.
   API-Erweiterung entwerfen (abwärtskompatibel).

3. Umsetzer: Implementieren – Backend vor Frontend.
   Neue Typen in src/types/index.ts ergänzen.
   API-Client in src/services/api.ts erweitern.

4. Prüfer: Änderungen gegen Konventionen prüfen. Build ausführen.
```

#### Migration hinzufügen

```
1. Erkunder: Bestehende Tabellen und deren Beziehungen prüfen.
   Letzte Migrationsnummer ermitteln (aktuell: 024).

2. Architekt: SQL entwerfen:
   - IF NOT EXISTS / IF EXISTS verwenden
   - Keine destruktiven Änderungen (DROP nur mit Backup-Plan)
   - Indizes für häufige Queries, TIMESTAMPTZ statt TIMESTAMP

3. Umsetzer: Migration als backend/migrations/025_<beschreibung>.sql anlegen.

4. Prüfer: SQL auf Injection, Performance und Rollback-Fähigkeit prüfen.
```

#### Security/Code Review

```
1. Prüfer: Systematisch prüfen:
   a) Auth: Jede Route hat passende Middleware
   b) SQL: Alle Queries parametrisiert ($1, $2, ...)
   c) CORS: CORS_ORIGINS korrekt konfiguriert
   d) Rate Limiting: Öffentliche Endpunkte haben Limiter
   e) Secrets: Keine Hardcoded-Credentials
   f) Headers: Helmet.js aktiv

2. Erkunder (bei Auffälligkeiten): Betroffene Stellen im Detail analysieren.

3. Umsetzer: Gefundene Probleme beheben.
```

---

## Verzeichnisstruktur (Schlüsseldateien)

```
├── docker-compose.yml
├── Dockerfile.backend / Dockerfile.frontend
├── src/
│   ├── App.tsx                        # Routing, ProtectedRoutes
│   ├── components/
│   │   ├── GlobalTopHeader.tsx         # Haupt-Header + Sidebar-Navigation
│   │   ├── BookingApp.tsx              # Öffentliche Buchungs-UI
│   │   ├── BookingForm.tsx             # Buchungsformular
│   │   └── ProtectedRoute.tsx          # Auth-Gate
│   ├── contexts/AuthContext.tsx        # Auth-Provider
│   ├── services/api.ts                 # Zentraler API-Client
│   ├── types/index.ts                  # TypeScript-Interfaces
│   ├── modules/
│   │   ├── registry.ts                 # Modul-Registry
│   │   ├── elternsprechtag/            # Elternsprechtag-Modul
│   │   └── schulsozialarbeit/          # SSW-Modul
│   └── pages/
│       ├── Admin*.tsx                  # Admin-Seiten
│       └── teacher/                    # Lehrkraft-Bereich
├── backend/
│   ├── index.js                        # Express-App + Middleware
│   ├── migrate.js                      # Auto-Migration Runner
│   ├── moduleLoader.js                 # Modul-Loader
│   ├── config/
│   │   ├── db.js                       # PostgreSQL Pool
│   │   └── email.js                    # Nodemailer Config
│   ├── middleware/auth.js              # JWT + Rollen-Checks
│   ├── routes/
│   │   ├── auth.js                     # Login/Logout/Verify
│   │   └── teacher.js                  # Lehrer-Endpoints
│   ├── migrations/                     # 001–024 SQL Migrationen
│   └── modules/
│       ├── elternsprechtag/            # Elternsprechtag Backend
│       └── schulsozialarbeit/          # SSW Backend
└── docs/
    ├── AI_GUIDE.md                     # Ausführlicher Entwicklerleitfaden
    ├── ToDo_Docker                     # Projekt-Roadmap (Phasen 1–12)
    └── INSTALL.md                      # Installationsanleitung
```

---

## Konventionen

### Code-Stil

- Backend: Node.js ESM (`import`/`export`), kein TypeScript
- Frontend: TypeScript strict, React Functional Components, CSS-Module/Dateien (kein Tailwind)
- Alle `fetch`-Aufrufe mit `credentials: 'include'` (wg. httpOnly Cookies)
- API-Responses normalisieren zu Arrays (verhindert `.map()`-Fehler)
- Keine Emojis in der UI (entfernt aus Sidebar, Tabs, Modulen)

### Commit-Nachrichten

```
feat(scope): Beschreibung
fix(scope): Beschreibung
ui(scope): Beschreibung
style(scope): Beschreibung
```

### Neue Migration anlegen

- Nächste Nummer: `025_*.sql`
- Datei in `backend/migrations/` ablegen
- Wird automatisch beim nächsten Start ausgeführt

### Neues Modul anlegen

1. Backend: `backend/modules/<name>/index.js` mit `register(app, db)` Export
2. Frontend: `src/modules/<name>/index.ts` mit `ModuleDefinition`
3. In `src/modules/registry.ts` registrieren
4. `ENABLED_MODULES` / `VITE_ENABLED_MODULES` erweitern

---

## Projekt-Roadmap (aus `docs/ToDo_Docker`)

### Abgeschlossen ✅

- Phase 1–6: Docker, Config, Production Hardening, CI/CD, Betrieb, httpOnly Cookies
- Phase 7a–b, 7d–e: CSS-Variablen, Site-Branding (DB+API), Header/Landing dynamisch, E-Mail-Sync
- Phase 11: CSV-Import Lehrkräfte
- Phase 12 (Modul): Schulsozialarbeit komplett (Backend, Frontend, Migration 022–024)
- Modulares Plugin-System

### Offen

- **Phase 7c** – Superadmin Texte & System:
  - Impressum/Datenschutz als editierbare Felder über Superadmin
  - Maintenance-Modus per Toggle
  - Superadmin-Rolle an andere User vergeben

- **Phase 8** – Microsoft 365 Login (Azure AD / Entra ID):
  - OAuth 2.0 Authorization Code Flow
  - `@azure/msal-node`, User-Matching per E-Mail
  - "Mit Microsoft anmelden"-Button, Fallback bleibt

- **Phase 9** – DSGVO & Datenhygiene:
  - Automatische Datenlöschung (konfigurierbar)
  - Datenexport (Art. 15 DSGVO)
  - Datenschutzhinweise, AV-Vertrag-Vorlage

- **Phase 10** – Automatische Erinnerungen:
  - E-Mail-Erinnerung an Eltern vor Termin
  - Tagesübersicht für Lehrkräfte
  - Duplikat-Schutz (Sent-Flag)

- **Phase 12** – Barrierefreiheit (WCAG 2.1 AA):
  - Tastaturnavigation, Screenreader, Kontraste
  - axe/Lighthouse Audit

### Modul-Ideen

| Modul              | Beschreibung                                           |
|--------------------|--------------------------------------------------------|
| Beratungslehrer    | Sprechstunden, Themenkategorien, anonyme Anfragen      |
| Berufsorientierung | Betriebsbesuche, Praktikumsplätze, Matching            |
| Fächerwahl         | Fächer/Kurse wählen, Matching, Listenausgabe           |

---

## Wichtige API-Endpunkte (Übersicht)

### Öffentlich
- `GET /api/teachers` – Lehrerliste
- `GET /api/slots?teacherId=&eventId=` – Synthetische Slots (Privacy)
- `POST /api/booking-requests` – Buchungsanfrage (primärer Flow)
- `GET /api/events/active` – Aktives Event
- `GET /api/health` – Healthcheck

### Admin (`requireAdmin`)
- `CRUD /api/admin/teachers`, `/api/admin/slots`, `/api/admin/events`, `/api/admin/users`
- `POST /api/admin/teachers/import-csv` – CSV-Import
- `GET /api/admin/feedback`

### Teacher (`requireTeacher`)
- `GET /api/teacher/requests` – Buchungsanfragen
- `PUT /api/teacher/requests/:id/accept|decline`
- `GET /api/teacher/bookings`, `DELETE .../cancel`

### SSW-Modul
- `GET /api/ssw/counselors`, `/api/ssw/categories`
- `POST /api/ssw/appointments/:id/book`
- `CRUD /api/ssw/admin/counselors`, `/api/ssw/admin/categories`

### Superadmin
- `GET/PUT /api/superadmin/site-branding`
- `GET/PUT /api/superadmin/email-branding`

---

## Sicherheitshinweise

- Stack-Traces nur in Development
- Helmet.js für Security Headers
- Rate Limiting auf Auth (20/15min) und Booking (30/15min)
- CORS über `CORS_ORIGINS` Env-Variable
- Graceful Shutdown (SIGTERM/SIGINT, Force nach 10s)
- Structured Logging via Pino (JSON in Prod, Pretty in Dev)
