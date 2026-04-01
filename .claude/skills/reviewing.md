# Skill: reviewing-fullstack-school-platform

> Code Review, PR-Review, Risikoanalyse oder Architekturprüfung.

## Review-Prioritäten

1. Korrektheit
2. Auth- und Datensicherheit
3. Tenant-Isolation
4. Wartbarkeit
5. Performance
6. Nebenaspekte / Politur

## Prüfkatalog

### 1. Korrektheit
- Löst die Änderung das eigentliche Problem?
- Sind Null-, leer-, invalid- und unauthorized-Fälle behandelt?
- Entstehen Seiteneffekte in benachbarten Pfaden?

### 2. Frontend
- Ist das Routing korrekt?
- Ist Formularverhalten klar und robust?
- Ist die Komponentenverantwortung sauber?
- Wurde unnötige Komplexität eingeführt?

### 3. Backend
- Ist Validierung vorhanden und am richtigen Ort?
- Ist Middleware-Reihenfolge korrekt?
- Werden Async-Fehler sauber behandelt?
- Ist Geschäftslogik von Route-Glue getrennt?

### 4. Auth und Sicherheit
- Wird Autorisierung serverseitig erzwungen?
- Sind Cookie-Flows korrekt?
- Werden sensitive Daten geschützt?
- Wird nichts allein im Frontend abgesichert, was Backend-Schutz braucht?

### 5. Datenbank und Kysely
- Ist die Query fachlich korrekt?
- Sind Joins, Filter, Limits, Pagination und Sortierung plausibel?
- Wurde der teilweise migrierte Zustand berücksichtigt?
- Fehlen Transaktionen?
- Gibt es Risiko für falsche DB-Ziele oder Tenant-Verwechslung?

### 6. Betrieb und Deployment
- Braucht die Änderung neue Env Vars?
- Braucht sie Migrationen?
- Muss die Reihenfolge von Deploy und Migration beachtet werden?
- Gibt es Risiko für ein einzelnes Schul-Deployment?

## Review-Ausgabeformat

- Kritische Probleme
- Wichtige Korrekturen
- Mittlere Risiken
- Kleine Verbesserungen
