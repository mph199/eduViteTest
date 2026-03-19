# Konsolidierte Audit-ToDos (Stand 2026-03-19)

> **Quellen:** `audit-2026-03-18.md`, `audit-2026-03-18-nachtpruefung.md`
> **Bereits erledigt:** ~50 Befunde (siehe Quell-Audits)
> **Offen:** 11 Punkte (0 Kritisch, 0 Hoch)

---

## Mittel (naechster Sprint)

| # | Quelle | Befund | Datei(en) | Empfehlung |
|---|--------|--------|-----------|------------|
| T-01 | S-M4 | Docker-Container laeuft als Root | `Dockerfile.backend` | `USER node` hinzufuegen |
| T-02 | S-M5 | PostgreSQL-Port in docker-compose.yml exponiert | `docker-compose.yml` | Port-Mapping fuer Prod entfernen oder nur auf 127.0.0.1 binden |
| T-03 | I-01/S-H2 | Keine Zod/Joi Schema-Validierung fuer Request-Bodies | Diverse Route-Handler | Schema-Validierung als Middleware fuer Public-Endpunkte |
| T-04 | MOD-M1 | `module_config` ist nur UI-Guard – deaktivierte Module bleiben serverseitig erreichbar | `backend/moduleLoader.js` | Middleware die `module_config.enabled` prueft, oder als bewusste Entscheidung dokumentieren |
| T-05 | MOD-M2 | `elternsprechtag` sidebarNav referenziert `/admin/events` (Core-Route, nicht im Modul-Manifest) | `src/modules/elternsprechtag/index.ts` | Als `adminRoute` im Modul-Manifest oder als Core-Route formalisieren |
| T-06 | H-M6 | `AdminEvents.tsx` 600+ Zeilen monolithisch | `src/pages/admin/AdminEvents.tsx` | Sub-Komponenten extrahieren |

## Niedrig (Backlog)

| # | Quelle | Befund | Datei(en) | Empfehlung |
|---|--------|--------|-----------|------------|
| T-07 | R-01/K-H2 | ~11 Domain-Typen in 5 Dateien ausserhalb `types/index.ts` (Regel 7) | `AuthContextBase.ts`, `BrandingContext.tsx`, `TextBrandingContext.tsx`, `AdminTeachers/types.ts`, `TeacherLayout.tsx` | Domain-Typen nach `src/types/index.ts` verschieben (~20 Import-Updates) |
| T-08 | O-03 | `github.dev` CORS-Origin im Dev-Modus | `backend/index.js:54` | Sicherstellen dass `NODE_ENV=production` im Deployment |
| T-09 | I-02 | DB-SSL ohne CA-Zertifikat | `backend/config/db.js` | CA fuer Produktion hinterlegen |
| T-10 | I-04/S-M6 | Kein `npm audit` in CI/CD | CI-Pipeline | Als CI-Job hinzufuegen |
| T-11 | K-M3 | `counselorPublicRoutes.js`: Public-Routes ohne individuelles Rate Limiting | `backend/shared/counselorPublicRoutes.js` | Rate-Limiter als Factory-Parameter uebergeben |

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
