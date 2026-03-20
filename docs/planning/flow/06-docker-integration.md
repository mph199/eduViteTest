# Flow Modul – Phase 6: Docker und Infrastruktur

> Abhaengigkeiten: Phase 1-5 abgeschlossen, Code implementiert
> Aenderungen in:
> - `docker-compose.yml`
> - `.env.example`
> - Ggf. `Dockerfile` (falls Multer-Upload-Verzeichnis benoetigt)

## ENABLED_MODULES Konfiguration

### docker-compose.yml

```yaml
# Backend-Service
environment:
    ENABLED_MODULES: elternsprechtag,schulsozialarbeit,beratungslehrer,flow

# Frontend-Service (Build-time!)
args:
    VITE_ENABLED_MODULES: elternsprechtag,schulsozialarbeit,beratungslehrer,flow
```

**Wichtig:** `VITE_ENABLED_MODULES` ist eine Build-time-Variable. Nach Aenderung:
```bash
docker compose up --build frontend
```
Ein einfacher Neustart reicht **nicht**.

### .env.example

```bash
# Module (kommasepariert)
ENABLED_MODULES=elternsprechtag,schulsozialarbeit,beratungslehrer,flow
VITE_ENABLED_MODULES=elternsprechtag,schulsozialarbeit,beratungslehrer,flow
```

## Datei-Storage

**Entscheidung (2026-03-20):** Kein lokaler Datei-Storage fuer Flow. Dateien werden kuenftig ueber WebDAV/OAuth an Schul-Cloudloesungen angebunden:
- Logineo NRW
- OneDrive (Microsoft 365 Education)
- Open-Xchange

Im MVP speichert `flow_datei` nur Metadaten (Name, MIME-Type, Groesse) mit einem `external_url`-Feld. Die eigentliche Storage-Anbindung ist ein separates Feature.

Kein Multer, kein Upload-Verzeichnis, kein Volume fuer Flow-Dateien noetig.

## Neue Dependency: TanStack Query

**Entscheidung (2026-03-20): Wird eingefuehrt.**

```bash
npm install @tanstack/react-query
```

Dies muss in `package.json` (Frontend-Root) ergaenzt und der Docker-Build neu ausgefuehrt werden.

## Checkliste vor Deployment

- [ ] Migration `049_flow.sql` ausgefuehrt (`docker compose exec db psql -f ...`)
- [ ] `ENABLED_MODULES` in `.env` um `flow` erweitert
- [ ] `VITE_ENABLED_MODULES` in `.env` um `flow` erweitert
- [ ] `docker compose up --build` (Frontend muss neu gebaut werden)
- [ ] TanStack Query installiert (`@tanstack/react-query`)
- [ ] `module_config`-Eintrag fuer `flow` vorhanden (wird durch Migration angelegt)
- [ ] Benutzer in `user_module_access` fuer `flow` freigeschaltet (Superadmin-Panel)
- [ ] CSS-Variable `--module-accent-flow` definiert
- [ ] Rauchtest: Flow erscheint in Sidebar, Dashboard laed

## Monitoring und Logging

Flow nutzt den bestehenden Logger (`backend/config/logger.js`):

```js
import logger from '../../../config/logger.js';
const log = logger.child({ module: 'flow' });
```

Audit-Trail:
- Jede PII-relevante Aktion wird in `flow_aktivitaet` geschrieben
- Zusaetzlich `writeAuditLog()` aus dem bestehenden Audit-System aufrufen (wie in SSW/BL)

## Skalierung

Fuer den MVP ist keine besondere Skalierung noetig. Spaeter relevant:
- **Datei-Storage:** WebDAV/OAuth-Anbindung an Logineo, OneDrive, Open-Xchange
- **iCal-Feed-Caching:** 5-Minuten-Cache serverseitig, Rate-Limiting 60/h pro Token
- **Schulkalender-Polling:** Hintergrund-Job (z.B. node-cron), nicht bei jedem Request
