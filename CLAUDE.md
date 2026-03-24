# CLAUDE.md – eduViteTest

> Directive file. Every instruction here is a RULE, not a suggestion.

## Identity

Modulares Schulverwaltungssystem. Docker-deployed. PostgreSQL + Express + React 19.

## Mandatory Workflow

**EVERY non-trivial task MUST follow this sequence. No exceptions.**

### 1. ANALYZE (Erkunder)
Before touching code, spawn the `erkunder` agent to map:
- Affected files and their dependencies
- Existing patterns that solve similar problems
- Potential side effects

Skip ONLY for single-file, < 10-line changes where the impact is obvious.

### 2. PLAN (Architekt)
For new features, modules, schema changes, or multi-file changes, spawn the `architekt` agent to produce:
- File list (create / modify / delete)
- Implementation order
- API contracts or schema DDL

Skip ONLY for bug fixes or UI tweaks confined to one component.

### 3. IMPLEMENT
- Backend before Frontend. Always.
- One logical change per commit.
- Run `npm run build` after frontend changes.

### 4. REVIEW (Pruefer)
Before committing, spawn the `pruefer` agent. Fix every finding rated "Kritisch" or "Hoch" before proceeding.

## Hard Rules

| # | Rule | Rationale |
|---|------|-----------|
| 1 | ESM only (`import`/`export`). No `require()`. | Project standard |
| 2 | All DB queries parametrized (`$1`, `$2`). No string interpolation. | SQL injection prevention |
| 3 | Every `fetch` uses `credentials: 'include'`. | Cookie-based JWT auth |
| 4 | API responses normalized to arrays before `.map()`. | Prevents runtime crashes |
| 5 | Colors via `var(--brand-*)`. No hardcoded hex/rgb. | Theming support |
| 6 | No emojis in UI text. | Design guideline |
| 7 | New types go in `src/types/index.ts`. | Single source of truth |
| 8 | New API methods go in `src/services/api.ts`. | Centralized client |
| 9 | New modules registered in `src/modules/registry.ts`. | Module system |
| 10 | Auth middleware on every non-public route. Public routes get rate limiting. | Security baseline |
| 11 | Migrations use `IF NOT EXISTS`, `TIMESTAMPTZ`. Check next number in `backend/migrations/`. | Safe migrations |
| 12 | Commit format: `feat(scope):`, `fix(scope):`, `ui(scope):`, `docs(scope):` | Conventional commits |
| 13 | Deutsche Texte immer mit echten Umlauten (ä, ö, ü, Ä, Ö, Ü, ß). Keine Ersatzschreibungen (ae, oe, ue, ss). Ausnahme: technische Identifier (DB-Spalten, API-Parameter, URL-Slugs). | Lesbarkeit & Korrektheit |

## Tech Stack (reference only)

| Layer | Tech |
|-------|------|
| Frontend | React 19, TypeScript 5.9, Vite 7, React Router 7 |
| Backend | Node.js 20 (ESM), Express, JWT (httpOnly Cookie) |
| Database | PostgreSQL 16 |
| Deploy | Docker Compose (3 services) |
| Email | Nodemailer (Ethereal dev / SMTP prod) |

## Key Entry Points

| What | Where |
|------|-------|
| Documentation hub | `docs/index.md` |
| Architecture doc | `docs/architecture/system-design.md` |
| Module guide | `docs/architecture/module-guide.md` |
| Frontend types | `src/types/index.ts` |
| API client | `src/services/api.ts` |
| Module registry | `src/modules/registry.ts` |
| Auth middleware | `backend/middleware/auth.js` |
| Module loader | `backend/moduleLoader.js` |
| Rule files | `.claude/rules/backend.md`, `frontend.md`, `workflows.md` |

## Agents

### Core Workflow (Pflicht)

| Agent | When to spawn | File |
|-------|---------------|------|
| **Erkunder** | Before any non-trivial change | `.claude/agents/erkunder.md` |
| **Architekt** | New features, modules, schema changes | `.claude/agents/architekt.md` |
| **Pruefer** | Before every commit | `.claude/agents/pruefer.md` |
| **Modulwaechter** | When working on any module (create, modify, extend) | `.claude/agents/modulwaechter.md` |

### Code Hygiene (regelmaessig einsetzen)

| Agent | When to spawn | File |
|-------|---------------|------|
| **Waechter** | Before deploys, after dependency updates, security-relevant changes | `.claude/agents/waechter.md` |
| **Hygieniker** | Before major refactorings, regularly for dead code and duplication | `.claude/agents/hygieniker.md` |
| **Konsistenzpruefer** | During code reviews, regularly for convention drift | `.claude/agents/konsistenzpruefer.md` |
| **Testmeister** | After feature implementation, to plan test coverage | `.claude/agents/testmeister.md` |
| **Dokumentar** | After feature completion, schema changes, release prep | `.claude/agents/dokumentar.md` |
| **DB-Analyst** | Before migrations, for DB hygiene, DSGVO data inventory | `.claude/agents/db-analyst.md` |

## Quick Start

```bash
docker compose up -d
cd /workspaces/eduViteTest && npm install && npm run dev    # Frontend :5173
cd /workspaces/eduViteTest/backend && npm install && npm run dev  # Backend :4000
```
