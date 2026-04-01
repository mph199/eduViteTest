# Skill: deploying-single-tenant-school-stack

> Deployment-, Rollout-, Docker-Compose-, Konfigurations- oder Migrationsarbeit.

## Wichtiger Hinweis

Deployment-Arbeit ist bewusst und risikobehaftet. Beschreibe Schritte explizit und vermeide implizite Annahmen.

## Projektbesonderheiten

- Docker Compose mit Frontend, Backend und PostgreSQL
- jede Schule läuft separat
- jede Schule hat eigenen VPS und eigene DB
- Fehler können Verfügbarkeit, Auth oder DB-Zuordnung beschädigen

## Regeln

1. Rollout-Schritte explizit formulieren.
2. Env Vars und Secrets klar benennen.
3. Migrationsreihenfolge vor Deployment prüfen.
4. Tenant-spezifische Konfiguration als Hochrisiko behandeln.
5. Wenn möglich immer Rollback-Pfad nennen.

## Prüfschritte

### 1. Betroffene Services
- Frontend
- Backend
- Datenbank

### 2. Konfiguration
- Env Vars
- Host-/Netzwerkannahmen
- Cookie-/Domain-Verhalten
- DB-Connection
- Mail-Konfiguration

### 3. Migrationen
- ist eine Migration nötig?
- muss Code vor oder nach Migration deployt werden?
- braucht es Backfill oder manuelle Verifikation?

### 4. Tenant-Sicherheit
- richtige Schule / richtige Umgebung
- richtige DB
- keine versehentliche Wiederverwendung tenant-fremder Konfiguration

### 5. Ausgabe
- Deployment-Zusammenfassung
- exakte Rollout-Schritte
- Verifikationsschritte
- Rollback-Hinweise
