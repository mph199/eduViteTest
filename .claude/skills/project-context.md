# Projektkontext

> Stack, Ordnerstruktur, Namenskonventionen und Infrastruktur dieses Projekts.

## Tech Stack

### Frontend
- React 19, TypeScript 5.9, Vite 7, React Router 7
- Vitest, @testing-library/react
- CSS Custom Properties (kein Tailwind)

### Backend
- Node.js 20 (ESM), Express 4, PostgreSQL 16, Kysely
- JWT Auth mit httpOnly Cookie
- Zod für Validierung, Pino für Logging, Nodemailer für E-Mail

### Deployment
- Docker Compose: 3 Services (Frontend, Backend, PostgreSQL)
- Single-Tenant pro Schule (eigener VPS, eigene DB)

## Ordnerstruktur

```
eduViteTest/
├── backend/
│   ├── config/          # Logger (Pino), Konfiguration
│   ├── db/              # database.js (Kysely), types.ts, migrator.js, migrations/
│   ├── middleware/       # auth.js, audit-log.js
│   ├── migrations/      # SQL-Dateien (001...062), dreistellig nummeriert
│   ├── modules/         # elternsprechtag, schulsozialarbeit, beratungslehrer, flow
│   ├── routes/          # globale Routen
│   ├── schemas/         # Zod-Schemas (auth.js, booking.js, counselor.js)
│   ├── services/        # auth.js, booking.js, counselor.js, oauthService.js
│   └── shared/          # wiederverwendbare Route-Factories
├── src/
│   ├── components/, contexts/, hooks/, pages/, utils/
│   ├── modules/         # Frontend-Module (gleiche Namen wie backend/modules/)
│   ├── services/        # api.ts, apiBase.ts, mediaUtils.ts
│   └── types/           # index.ts
└── .claude/
    ├── agents/          # erkunder.md, architekt.md, pruefer.md, ...
    ├── rules/           # backend.md, frontend.md, workflows.md
    └── skills/          # Skill-Definitionen (diese Dateien)
```

## Namensschema

| Bereich | Muster | Beispiel |
|---------|--------|----------|
| Zod-Schemas | `backend/schemas/<domain>.js`, Export als `<action>Schema` | `loginSchema`, `bookingSchema` |
| Services | `backend/services/<domain>.js`, flache Dateien, kein Repository-Muster | `auth.js`, `booking.js` |
| DB-Zugriff | Kysely via `import { db } from '../db/database.js'` | Kein `SELECT *`, immer explizite Spalten |
| Frontend-API | Alle Methoden in `src/services/api.ts`, Basis in `apiBase.ts` | `fetchBookings()`, `createBooking()` |
| Module | Gleiche Namen in `backend/modules/` und `src/modules/` | `elternsprechtag`, `schulsozialarbeit` |

## Auth-Middleware-Muster

Token liegt im httpOnly-Cookie (`req.cookies.token`), kein Bearer-Header.
Token enthält `{ username, role, id, teacherId, modules, tv, fpc }`.
Token-Version wird gegen DB geprüft (Revocation).

| Middleware | Verwendung |
|---|---|
| `requireAuth` | Jeder eingeloggte User |
| `requireAdmin` | Rolle admin oder superadmin |
| `requireSuperadmin` | Nur superadmin |
| `requireModuleAccess(key)` | Factory — prüft `user.modules[]` |
| `requireModuleAdmin(key)` | Factory — prüft `user_admin_access`-Tabelle |

Einbindung:
```js
import { requireModuleAccess } from '../../../middleware/auth.js';
router.get('/...', requireModuleAccess('schulsozialarbeit'), handler);
```

## Kysely-Migrationspfad

- Verzeichnis: `backend/migrations/` — derzeit 062 SQL-Dateien
- Nummerierung: `NNN_beschreibender_name.sql` (dreistellig, nullgepaddet)
- Nächste Nummer ermitteln: `ls backend/migrations/ | sort | tail -1`
- Migrator: `backend/db/migrator.js` führt Migrationen beim Start aus
- JS-Migrationen für Datenhygiene: `backend/db/migrations/*.js` mit `up(db)` und `down(db)`
- Pflicht: `IF NOT EXISTS`, `TIMESTAMPTZ`, RLS-Policies direkt in der Migration

## Docker-Compose-Startlogik

Startreihenfolge: `postgres` (healthcheck: pg_isready) → `backend` → `frontend`

| Service | Details |
|---------|---------|
| postgres | `postgres:16-alpine`, Port `127.0.0.1:5432`, Volume `pg_data` |
| backend | `Dockerfile.backend`, Port `127.0.0.1:4000`, Volume `uploads/` |
| frontend | `Dockerfile.frontend`, Build-Arg `VITE_ENABLED_MODULES`, Port via `FRONTEND_BIND`/`FRONTEND_PORT` |

Pflicht-Env-Vars Backend: `POSTGRES_PASSWORD`, `SESSION_SECRET`, `JWT_SECRET`
Module doppelt aktivieren: `ENABLED_MODULES` (Backend-Runtime) + `VITE_ENABLED_MODULES` (Frontend-Build-Zeit)
