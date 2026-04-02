# SKILLS.md

> Bevorzugte Arbeitsweisen für Claude Code in diesem Projekt.
> Detaillierte Skills liegen in `.claude/skills/`.

## Skill-Dateien

| Datei | Inhalt |
|-------|--------|
| `project-context.md` | Stack, Ordnerstruktur, Namensschema, Auth-Middleware, Kysely-Migrationspfad, Docker-Compose |
| `debugging.md` | Fehleranalyse in React, Express, Kysely, Auth, Docker |
| `testing.md` | Tests für Frontend- und Backend-Verhalten |
| `reviewing.md` | Code Review, PR-Review, Risikoanalyse |
| `refactoring.md` | Refactoring von Komponenten, Routen, Services, Datenzugriff |
| `kysely-postgres.md` | PostgreSQL, Kysely, Migrationen, Transaktionen |
| `auth-validation.md` | Auth, Cookies, Session-Flows, Zod-Validierung |
| `deployment.md` | Docker Compose, Rollout, Konfiguration, Migrationsarbeit |
| `workflows.md` | Slash-Command-Workflows (/migrate-file, /test-run, /security-scan, etc.) |

## Globale Regeln

1. Bevorzugt die kleinste sichere Änderung, die das Problem tatsächlich löst.
2. Trennt klar zwischen Frontend, Routing, Backend, Geschäftslogik und Datenzugriff.
3. Behandelt Auth, Cookies, Validierung, Migrationen und Tenant-Isolation als Hochrisikobereiche.
4. Führt keine breiten Architekturänderungen durch, wenn ein lokaler Fix ausreicht.
5. Berücksichtigt immer, dass der Datenzugriff aktuell teilweise migriert ist:
   - Kysely ist nur in etwa 50 Prozent der relevanten Dateien eingeführt.
   - Legacy-Zugriffe und Kysely-Zugriffe können nebeneinander existieren.
   - Änderungen am Datenzugriff müssen angrenzende Altpfade mitdenken.
6. Erzwingt Autorisierung serverseitig, niemals nur im Frontend.
7. Nutzt Zod an Backend-Grenzen für Request-Validierung.
8. Nutzt Logs gezielt zur Ursachenanalyse, ohne sensitive Daten offenzulegen.
9. Beachtet immer den Single-Tenant-Betrieb:
   - Jede Schule ist ein separates Deployment.
   - Jede Schule hat ihre eigene Datenbank.
   - Konfigurationsfehler, die auf die falsche DB oder falsche Umgebung zeigen, sind kritisch.
10. Wenn Änderungen Migrationen oder Deployments berühren, beschreibt Reihenfolge, Risiken und Verifikation explizit.

## Arbeitsstil

1. Bei unklaren Fehlern zuerst eingrenzen, dann ändern.
2. Bei DB-nahen Änderungen immer auch an Migrationen, Typen und angrenzende Legacy-Pfade denken.
3. Bei Auth-Änderungen immer Frontend Request, Cookie-Verhalten, Express Middleware, Token-Prüfung und serverseitige Autorisierung zusammen betrachten.
4. Bei Reviews und Refactors Tenant-Isolation aktiv als Prüfpunkte aufnehmen.
5. Bei Tests Verhalten priorisieren: Frontend sichtbar, Backend fachlich, Auth und Fehlerpfade robust.
6. Bei Logging mit Pino: Logs zur Ursachenanalyse nutzen, keine sensiblen Daten leaken.
7. Bei Deployment- oder Migrationsarbeit: Reihenfolge, Risiken, Verifikation und Rollback benennen.

## Standard-Ausgabepräferenzen

1. Erst kurz Problem oder Ziel benennen.
2. Dann Root Cause oder Risikobereich erklären.
3. Dann die kleinste sinnvolle Änderung vorschlagen.
4. Danach betroffene Randbereiche und mögliche Regressionen nennen.
5. Wenn sinnvoll, passende Tests oder Verifikation ergänzen.

## Nicht bevorzugt

- unnötig breite Refactors
- neue Abstraktionen ohne klaren Nutzen
- rein frontend-seitige Sicherheitsannahmen
- implizite DB-Annahmen trotz Teilmigration
- Deployments ohne explizite Reihenfolge
- "magische" Änderungen ohne Erklärung des Risikos
