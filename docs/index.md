# Dokumentation

> Stand: 2026-03-18

## Architektur

- [System Design](architecture/system-design.md) -- Modulsystem, DB-Schema, Datenfluss, API-Vertraege
- [Module Guide](architecture/module-guide.md) -- Schritt-fuer-Schritt Anleitung zur Modulerstellung
- [Email Flows](architecture/email-flows.md) -- E-Mail-Trigger, Templates, Konfiguration
- [Multi-Tenancy](architecture/multi-tenancy.md) -- VPS + separate DB pro Schule (keine Shared DBs)

## Deployment

- [Installation](deployment/install.md) -- Docker-Compose-Deployment, Ersteinrichtung
- [Reverse Proxy](deployment/reverse-proxy-examples.md) -- Nginx, Caddy, Traefik Konfigurationen

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

## Planung

- [IONOS Migration](planning/ionos-migration.md) -- Migrationsfahrplan Supabase → IONOS
- [Docker Roadmap](planning/docker-roadmap.md) -- Docker-Infrastruktur, Phasen 1-4
- [Slot-Vorschlaege UX](planning/slot-suggestions-ux.md) -- Terminanzeige: 5 Vorschlaege + "Weitere anzeigen"
- [DSGVO Consent-Checkbox](planning/dsgvo-consent-checkbox.md) -- Datenverarbeitungs-Einwilligung fuer Buchungsmodule
- [P0 Sprint-Plan](planning/p0-sprint-plan.md) -- 4 Sprints fuer Go-Live-Blocker (DSGVO P0)
- [DSAR-Endpunkte](api/dsar-endpoints.md) -- API-Referenz Betroffenenrechte Art. 15-21 + Audit-Log

## UX

- [Responsive Admin](ux/responsive-admin.md) -- Admin-Bereich Responsive-Audit
- [Responsive Buchungstool](ux/responsive-buchungstool.md) -- Buchungstool Responsive-Audit
- [Responsive Lehrer](ux/responsive-lehrer.md) -- Lehrer-Bereich Responsive-Audit
