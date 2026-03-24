# Dokumentation

> Stand: 2026-03-24

## Architektur

- [System Design](architecture/system-design.md) -- Modulsystem, DB-Schema, Datenfluss, API-Vertraege
- [Module Guide](architecture/module-guide.md) -- Schritt-fuer-Schritt Anleitung zur Modulerstellung
- [CSS-Variablen](architecture/color-variables.md) -- Farb- und Design-Token Referenz
- [Email Flows](architecture/email-flows.md) -- E-Mail-Trigger, Templates, Konfiguration
- [Multi-Tenancy](architecture/multi-tenancy.md) -- VPS + separate DB pro Schule (keine Shared DBs)

## Deployment

- [Installation](deployment/install.md) -- Docker-Compose-Deployment, Ersteinrichtung
- [Reverse Proxy](deployment/reverse-proxy-examples.md) -- Nginx, Caddy, Traefik Konfigurationen
- [VPS Launch Checklist](deployment/vps-launch-checklist.md) -- Go-Live Checkliste fuer VPS-Deployment

## Compliance (DSGVO)

- [DSGVO-Anforderungen](compliance/dsgvo-anforderungen.md) -- Vollstaendiger Anforderungskatalog (Art. 5-49)
- [Dateninventar](compliance/dsgvo-dateninventar.md) -- PII-Verzeichnis aller Tabellen, Datenfluss, Loeschkonzept
- [SaaS-ToDo](compliance/dsgvo-saas-todo.md) -- 68 priorisierte Aufgaben (P0-P3) fuer DSGVO-Konformitaet
- [Verarbeitungsverzeichnis](compliance/verarbeitungsverzeichnis.md) -- Art. 30 Abs. 1 DSGVO
- [AV-Verzeichnis](compliance/av-verzeichnis.md) -- Art. 30 Abs. 2 DSGVO (Vorlage pro Schule)

## Security

- [Security Baseline](security/security-baseline.md) -- Auth, CSRF, XSS, Rate Limiting, Haertung
- [DB-Audit](security/db-audit-2026-03-17.md) -- Schema-Inventar, Hygiene-Befunde, DSGVO-Gaps
- [Audit 2026-03-18](security/audit-2026-03-18.md) -- Security, Hygiene, Modul, Konventionen (38 Befunde)
- [Nachtpruefung 2026-03-18](security/audit-2026-03-18-nachtpruefung.md) -- Folge-Audit mit 38 Befunden, Token-Revocation, Lockout
- [Audit-Todo 2026-03-18](security/audit-todo-2026-03-18.md) -- Offene Security-Aufgaben
- [DB-Audit 2026-03-19](security/db-audit-2026-03-19.md) -- Folge-DB-Audit
- [Buchungstool-Audit 2026-03-22](security/audit-booking-2026-03-22.md) -- Buchungstool Security/Hygiene/Doku-Audit

## Planung

- [IONOS Migration](planning/ionos-migration.md) -- Migrationshistorie: Supabase → VPS-Docker
- [Docker Roadmap](planning/docker-roadmap.md) -- Docker-Infrastruktur, Phasen 1-14
- [OAuth Integration](planning/oauth-integration.md) -- OAuth/OIDC-Anbindung (Logineo, MS365, OX)
- [WebDAV Integration](planning/webdav-integration.md) -- WebDAV-Anbindung fuer Schul-Cloudspeicher
- [Slot-Vorschlaege UX](planning/slot-suggestions-ux.md) -- Terminanzeige: 5 Vorschlaege + "Weitere anzeigen"
- [DSGVO Consent-Checkbox](planning/dsgvo-consent-checkbox.md) -- Datenverarbeitungs-Einwilligung fuer Buchungsmodule
- [P0 Sprint-Plan](planning/p0-sprint-plan.md) -- 4 Sprints fuer Go-Live-Blocker (DSGVO P0)
- [DSAR-Endpunkte](api/dsar-endpoints.md) -- API-Referenz Betroffenenrechte Art. 15-21 + Audit-Log

- [Kalender-Abo (ICS)](planning/calendar-subscription.md) -- Token-geschützte ICS-Feed-URL für Lehrkräfte, Sicherheitskonzept, DSGVO

### Flow-Modul Planung

- [DB-Schema](planning/flow/01-datenbank-schema.md) -- DDL, Designentscheidungen
- [Backend Auth](planning/flow/02-backend-auth-middleware.md) -- flowAuth Middleware, Rollenhierarchie
- [Backend API](planning/flow/03-backend-api-routes.md) -- Alle Endpunkte + Middleware-Ketten
- [Frontend Types+API](planning/flow/04-frontend-types-api.md) -- TypeScript-Interfaces, api.flow.*
- [Frontend Komponenten](planning/flow/05-frontend-komponenten-modul.md) -- Komponentenstruktur
- [Docker Integration](planning/flow/06-docker-integration.md) -- Module-Config, TanStack Query
- [UI-Architektur](planning/flow/07-ui-architektur-abgleich.md) -- CSS Custom Properties, Layout

## UX

- [Responsive Admin](ux/responsive-admin.md) -- Admin-Bereich Responsive-Audit
- [Responsive Buchungstool](ux/responsive-buchungstool.md) -- Buchungstool Responsive-Audit
- [Responsive Lehrer](ux/responsive-lehrer.md) -- Lehrer-Bereich Responsive-Audit

## Intern

- [Vertriebsanalyse](company/vertriebsanalyse.md) -- Vertriebsstrategie und Marktanalyse
