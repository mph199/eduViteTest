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

## Datei-Upload-Verzeichnis

Flow braucht ein Upload-Verzeichnis fuer Dateien. Im bestehenden System:

```
backend/uploads/
├── logos/
├── tiles/
└── backgrounds/
```

Neues Verzeichnis fuer Flow:

```
backend/uploads/flow/
```

### Dockerfile (Backend)

Falls das Verzeichnis im Container erstellt werden muss:

```dockerfile
RUN mkdir -p /app/uploads/flow
```

### docker-compose.yml (Volume)

Das bestehende Upload-Volume muss `flow/` mit abdecken:

```yaml
volumes:
    - ./backend/uploads:/app/uploads
```

Falls noch kein Volume fuer Uploads existiert, muss es hinzugefuegt werden. Pruefen ob `backend/uploads` bereits als Volume gemountet ist.

## Neue Dependency: TanStack Query

Falls TanStack Query hinzugefuegt wird:

```bash
# Im Frontend-Container oder beim Build
npm install @tanstack/react-query
```

Dies muss in `package.json` (Frontend-Root) ergaenzt und der Docker-Build neu ausgefuehrt werden.

## Multer-Konfiguration

Multer ist bereits im Projekt (genutzt fuer Logo-Uploads). Fuer Flow wird ein eigener Multer-Handler benoetigt:

```js
// backend/modules/flow/middleware/upload.js
import multer from 'multer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
    destination: join(__dirname, '../../../uploads/flow'),
    filename: (req, file, cb) => {
        const unique = crypto.randomBytes(16).toString('hex');
        const ext = file.originalname.split('.').pop();
        cb(null, `${unique}.${ext}`);
    },
});

export const flowUpload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },  // 10 MB, konfigurierbar
    fileFilter: (req, file, cb) => {
        // Erlaubte MIME-Types
        const allowed = [
            'application/pdf',
            'image/jpeg', 'image/png', 'image/gif',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
        ];
        cb(null, allowed.includes(file.mimetype));
    },
});
```

## Checkliste vor Deployment

- [ ] Migration `049_flow.sql` ausgefuehrt (`docker compose exec db psql -f ...`)
- [ ] `ENABLED_MODULES` in `.env` um `flow` erweitert
- [ ] `VITE_ENABLED_MODULES` in `.env` um `flow` erweitert
- [ ] `docker compose up --build` (Frontend muss neu gebaut werden)
- [ ] Upload-Verzeichnis `backend/uploads/flow/` existiert
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
- **Datei-Storage:** Migration von lokal auf S3-kompatiblen Storage (MinIO im Docker-Setup)
- **iCal-Feed-Caching:** 5-Minuten-Cache serverseitig, Rate-Limiting 60/h pro Token
- **Schulkalender-Polling:** Hintergrund-Job (z.B. node-cron), nicht bei jedem Request
