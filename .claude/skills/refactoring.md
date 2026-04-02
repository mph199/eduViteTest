# Skill: refactoring-react-express-kysely

> Refactoring von React-Komponenten, Express-Routen, Services, Validierung oder Datenzugriff.

## Ziele

- Komplexität senken
- Lesbarkeit verbessern
- Typensicherheit erhöhen
- Duplikate reduzieren
- Testbarkeit verbessern
- schrittweise Kysely-Migration erleichtern

## Regeln

1. Verhalten zuerst erhalten.
2. Kleine, reviewbare Schritte bevorzugen.
3. Keine cleveren Abstraktionen ohne klaren Nutzen.
4. Geschäftslogik aus Express-Routen herausziehen.
5. React-Komponenten auf Rendering und Interaktion fokussieren.
6. Wiederholte Validierungs-, Auth- oder Query-Logik gezielt zentralisieren.
7. Risiko bei Teilmigration aktiv mitdenken.

## Typische Refactor-Ziele

- zu große React-Komponenten
- gemischte UI- und Datenlogik
- wiederholte Fetch-/Form-Patterns
- Express-Routen mit zu viel Logik
- wiederholte Zod-Schemas oder Parsing-Muster
- unklare Tenant-Auflösung
- inkonsistente DB-Zugriffe
- schwach typisierte Rückgabeformen

## Bevorzugte Richtung

- UI bleibt im Frontend
- Routing bleibt dünn
- Business-Logik liegt in Services
- DB-Logik ist explizit und konsistent
- Auth und Tenant-Auflösung sind wiederverwendbar und klar sichtbar
