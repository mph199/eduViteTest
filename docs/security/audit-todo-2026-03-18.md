# Konsolidierte Audit-ToDos (Stand 2026-03-19)

> **Quellen:** `audit-2026-03-18.md`, `audit-2026-03-18-nachtpruefung.md`
> **Bereits erledigt:** ~50 Befunde (siehe Quell-Audits) + 11 Restbefunde (19.03.)
> **Offen:** 0 Punkte

---

## Mittel (naechster Sprint) – ALLE ERLEDIGT

| # | Quelle | Befund | Fix |
|---|--------|--------|-----|
| ~~T-01~~ | S-M4 | Docker-Container laeuft als Root | **ERLEDIGT** – su-exec Pattern dokumentiert, `USER root` explizit + Drop via `su-exec node` |
| ~~T-02~~ | S-M5 | PostgreSQL-Port in docker-compose.yml exponiert | **ERLEDIGT** – Port auf `127.0.0.1:5432:5432` gebunden |
| ~~T-03~~ | I-01/S-H2 | Keine Schema-Validierung fuer Request-Bodies | **ERLEDIGT** – Zod v4 installiert, `validate()` Middleware, Schemas fuer login, booking-requests, counselor-book, consent-withdraw |
| ~~T-04~~ | MOD-M1 | `moduleLoader.js` ohne Path-Traversal Guard | **ERLEDIGT** – Regex-Guard `/^[a-z][a-z0-9_-]*$/` + `register()` Interface-Check |
| ~~T-05~~ | MOD-M2 | sidebarNav referenziert Core-Route `/admin/events` | **ERLEDIGT** – Als Core-Route formalisiert und dokumentiert (App.tsx + Modul-Kommentar) |
| ~~T-06~~ | H-M6 | `AdminEvents.tsx` 600+ Zeilen | **ERLEDIGT** – Bereits auf 309 Zeilen + 3 Sub-Komponenten refactored |

## Niedrig (Backlog) – ALLE ERLEDIGT

| # | Quelle | Befund | Fix |
|---|--------|--------|-----|
| ~~T-07~~ | R-01/K-H2 | Domain-Typen ausserhalb `types/index.ts` | **ERLEDIGT** – `TeacherOutletContext` nach `src/types/index.ts` verschoben; restliche Dateien waren bereits Re-Exports (kein Verstoss) |
| ~~T-08~~ | O-03 | `github.dev` CORS-Origin im Dev-Modus | **ERLEDIGT** – `NODE_ENV=production` in docker-compose.yml + Code-Kommentar verstaerkt |
| ~~T-09~~ | I-02 | DB-SSL ohne CA-Zertifikat | **ERLEDIGT** – `DB_SSL_CA` Support in db.js + .env.example dokumentiert |
| ~~T-10~~ | I-04/S-M6 | Kein `npm audit` in CI/CD | **ERLEDIGT** – `.github/workflows/security-audit.yml` (Push, PR, woechentlich) |
| ~~T-11~~ | K-M3 | Public-Routes ohne individuelles Rate Limiting | **ERLEDIGT** – `bookingLimiter` als Factory-Parameter in counselorPublicRoutes (10 req/15min fuer POST /book) |

## Akzeptierte Ausnahmen (kein Handlungsbedarf)

| # | Quelle | Befund | Begruendung |
|---|--------|--------|-------------|
| A-01 | S-M1 | SameSite=Lax statt Strict | Bewusste Designentscheidung, dokumentiert |
| A-02 | S-M7 | CSRF nur via SameSite+CORS | Dokumentiert, akzeptables Restrisiko |
| A-03 | R-02/K-M2 | Hex-Farben in Email-HTML-Template | CSS-Vars nicht moeglich in Email-HTML |
| A-04 | H-N6 | Hardcoded Hex in Email-Template | Gleicher Grund wie A-03 |

---

## Erledigte Highlights (Referenz)

Folgende Hoch/Kritisch-Befunde wurden in den Audit-Sessions vom 18.03. behoben:

- **S-01** Default Secrets in docker-compose.yml → `:?` Syntax
- **S-02/S-H5** Token Revocation → Migration 043, `token_version`
- **S-03/S-M2** Passwort-Komplexitaet → `validatePassword()` zentral
- **S-04** `error.message` an Clients → generische Fehlermeldungen
- **S-H1** Account-Lockout → Migration 042, `failed_login_attempts`
- **S-H3/S-11** `dangerouslySetInnerHTML` → `<iframe sandbox>`
- **S-H4** clearCookie → `cookieOptions()` mit allen Attributen
- **S-M3/I-03** Request-ID Middleware → implementiert
- **S-M8** SSW/BL Admin Rate-Limiter → `rateLimiters.admin` ergaenzt
- **S-M9** CSV fileFilter → MIME + Extension Check
- **H-H1-H5** Grosse Refactorings (teacher.js, BLAdmin, AdminDashboard.css, counselor.js)
- **K-01-K-07** Konventions-Drift behoben (fetch→api.ts, alert→flash, Hex→CSS-Vars)
- **O-01** force_password_change → Migration 044
