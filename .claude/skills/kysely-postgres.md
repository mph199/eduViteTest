# Skill: working-with-kysely-postgres-changes

> Änderungen an PostgreSQL, Kysely, Migrationen, Query-Verhalten, Indizes, Transaktionen oder Daten-Backfills.

## Projektbesonderheiten

- PostgreSQL 16
- Kysely nur teilweise eingeführt
- Falsche DB-Änderungen können einzelne Schulsysteme brechen
- Tenant-Isolation ist wichtiger als Geschwindigkeit

## Regeln

1. DB-Änderungen explizit, klein und überprüfbar halten.
2. Teilmigration als Risikofaktor behandeln.
3. Schema, Runtime-Code und Typen synchron halten.
4. Niemals stillschweigend annehmen, dass alle Tenant-Umgebungen identisch sind.

## Prüfschritte

### 1. Änderungsart bestimmen
- Schemaänderung
- Migration
- Query-Rewrite
- Transaktionsänderung
- Index-/Performance-Änderung
- Backfill

### 2. Schemaänderungen
- genaue Form definieren
- Nullability prüfen
- Defaults prüfen
- Rückwärtskompatibilität prüfen
- Backfill-Bedarf benennen

### 3. Migrationen
- wenn möglich reversibel
- destruktive Änderungen nur mit klarer Begründung
- Reihenfolge zwischen Migration und Anwendungscode nennen
- Rollout- oder Verifikationsschritte notieren

### 4. Kysely-Queries
- Query-Absicht soll klar lesbar sein
- Joins dürfen nicht unbemerkt Zeilen multiplizieren
- Filter, Sortierung, Limits und Pagination prüfen
- Selektion muss zur späteren Nutzung passen
- Transaktionen bei mehrteiligen Schreibvorgängen prüfen

### 5. Teilmigration
- angrenzende Legacy-Pfade berücksichtigen
- keine inkonsistenten Zugriffs-Patterns einführen
- berührte Bereiche wenn möglich vereinheitlichen, ohne Scope unnötig aufzublähen

## Erwartetes Ergebnis

- sichere Änderung
- betroffene Routen/Services identifiziert
- Typen angepasst
- Tests ergänzt oder Lücken benannt
- Deployment-/Migrationsreihenfolge dokumentiert
