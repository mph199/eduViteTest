# CLAUDE.md – eduViteTest

Modulares Schulverwaltungssystem (Elternsprechtage, Schulsozialarbeit, weitere Module).
Selbstgehostet als Docker-Container fuer Schulen, Traeger oder IT-Dienstleister.

## Tech-Stack

| Schicht    | Technologie                                      |
|------------|--------------------------------------------------|
| Frontend   | React 19, TypeScript 5.9, Vite 7, React Router 7 |
| Backend    | Node.js 20 (ESM), Express.js, JWT (httpOnly Cookie) |
| Datenbank  | PostgreSQL 16 (Alpine)                           |
| Deployment | Docker Compose (3 Services), GitHub Actions CI/CD |
| E-Mail     | Nodemailer (Ethereal Dev / SMTP Produktion)      |

## Schnellstart

```bash
docker compose up -d                                              # Docker Stack
cd /workspaces/eduViteTest && npm install && npm run dev          # Frontend :5173
cd /workspaces/eduViteTest/backend && npm install && npm run dev  # Backend  :4000
```

## Architektur

### Modul-System

Plugin-artiges System, aktiviert ueber Env-Variablen:
- **Backend:** `backend/moduleLoader.js` laedt aus `backend/modules/*/index.js`
- **Frontend:** `src/modules/registry.ts`, gefiltert durch `VITE_ENABLED_MODULES`
- **Aktive Module:** `elternsprechtag` (Kern), `schulsozialarbeit` (SSW)

### Authentifizierung

- JWT in httpOnly Cookies (`SameSite=Lax`, `Secure`)
- Rollen: `admin`, `teacher`, `superadmin`, `ssw`
- Middleware: `requireAuth`, `requireAdmin`, `requireTeacher`, `requireSuperadmin`, `requireSSW`
- Frontend: `AuthContext` + `useAuth()`, `ProtectedRoute` mit `allowedRoles`

### Datenbank

- DB/User: `sprechtag`, Migrationen in `backend/migrations/` (automatisch via `migrate.js`)
- Naechste Migration: Nummer in `backend/migrations/` pruefen

### Env-Variablen (wichtigste)

- `DATABASE_URL` – PostgreSQL Connection String
- `SESSION_SECRET` – JWT-Secret
- `ENABLED_MODULES` / `VITE_ENABLED_MODULES` – Kommaseparierte Modulliste
- `CORS_ORIGINS` – Erlaubte Origins
- `MAIL_TRANSPORT` – `ethereal` (Dev) oder `smtp` (Prod)

## Agent-Team

Spezialisierte Sub-Agents in `.claude/agents/`:

| Agent | Datei | Einsatz |
|-------|-------|---------|
| **Erkunder** | `.claude/agents/erkunder.md` | Vor Aenderungen: Abhaengigkeiten, Datenfluss, betroffene Dateien |
| **Architekt** | `.claude/agents/architekt.md` | Neue Features/Module: Schema, API-Vertraege, Migrationsplan |
| **Pruefer** | `.claude/agents/pruefer.md` | Vor Commits: Konventionen, Sicherheit, TypeScript |

**Koordinator (Umsetzer)** ist die Haupt-Session und arbeitet so:
1. Erkunder einsetzen (Kontext verstehen)
2. Bei Bedarf: Architekt fuer Planung
3. Implementieren (Backend vor Frontend)
4. `npm run build` (TypeScript-Pruefung)
5. Pruefer einsetzen
6. Commit nach Konvention

## Konventionen

Detaillierte Regeln in `.claude/rules/`:
- `backend.md` – ESM, parametrisierte Queries, Auth-Middleware
- `frontend.md` – TypeScript strict, `credentials: 'include'`, CSS Custom Properties
- `workflows.md` – Modul-Erstellung, Feature-Erweiterung, Commit-Format

### Kern-Regeln (immer beachten)

- Backend: ESM (`import`/`export`), alle Queries parametrisiert ($1, $2)
- Frontend: `credentials: 'include'` bei fetch, API-Responses zu Array normalisieren
- CSS: `var(--brand-*)` statt Hardcoded-Farben, keine Emojis in der UI
- Commits: `feat(scope):`, `fix(scope):`, `ui(scope):`, `docs(scope):`

## Weiterführende Dokumentation

- `docs/AI_GUIDE.md` – Ausfuehrlicher Entwicklerleitfaden
- `docs/MODULE_GUIDE.md` – Anleitung fuer neue Module
- `docs/ToDo_Docker` – Projekt-Roadmap (Phasen 1–13)
- `docs/INSTALL.md` – Installationsanleitung
