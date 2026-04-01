# Skill: debugging-react-express-kysely

> Fehleranalyse in React, React Router, Express, PostgreSQL, Kysely, Auth, Docker Compose oder Tenant-spezifischer Konfiguration.

## Typische Trigger

- Runtime Error
- kaputte Navigation
- fehlerhafte API-Response
- Cookie/Auth-Probleme
- Zod-Validierungsfehler
- DB-Schema-Mismatch
- Docker-Compose- oder Env-Probleme
- tenant-spezifischer Fehler

## Vorgehen

1. Fehler reproduzieren, bevor Änderungen vorgeschlagen werden.
2. Definieren, in welcher Schicht der Fehler liegt:
   - React-Komponente
   - React-Router-Route / Navigation
   - Frontend-API-Client
   - Express-Route oder Middleware
   - Auth-/Cookie-Handling
   - Zod-Validierung
   - Kysely-Query oder Migrationszustand
   - PostgreSQL-Schema oder Daten
   - Docker-Compose / Environment / Service-Kommunikation
3. Root Cause klar benennen.
4. Die kleinste sichere Korrektur bevorzugen.
5. Mögliche Regressionen im Umfeld prüfen.

## Besonders prüfen

- React Router params, redirects, navigation state
- fehlerhafte Effects oder Render-Schleifen
- falsche API-Base-URL
- fehlende `credentials`-Konfiguration bei Cookie-Auth
- JWT-Cookie wird nicht gesetzt, nicht gesendet, falsch gelöscht oder falsch geprüft
- Middleware-Reihenfolge in Express
- fehlende Async-Fehlerbehandlung
- Zod-Schema stimmt nicht mit Payload überein
- Kysely-Resultat passt nicht zur erwarteten Verwendung
- Code und Migrationen sind nicht synchron
- falsche Tenant-Konfiguration oder falsche Ziel-DB
- Docker-Service-Reihenfolge, Netzwerk oder Env Vars

## Erwartetes Ergebnis

- Klare Root-Cause-Erklärung
- kleiner, gezielter Fix
- kurze Risikoprüfung
- wenn sinnvoll: Regressionstest ergänzen
