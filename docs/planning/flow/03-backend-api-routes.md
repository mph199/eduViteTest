# Flow Modul – Phase 3: Backend API Routes

> Abhaengigkeiten: Phase 1 (Schema), Phase 2 (Auth)
> Neue Dateien:
> - `backend/modules/flow/index.js`
> - `backend/modules/flow/routes/bildungsgang.js`
> - `backend/modules/flow/routes/arbeitspaket.js`
> - `backend/modules/flow/routes/aufgabe.js`
> - `backend/modules/flow/routes/tagung.js`
> - `backend/modules/flow/routes/dashboard.js`
> - `backend/modules/flow/routes/abteilung.js`
> - `backend/modules/flow/routes/kalender.js`
> - `backend/modules/flow/services/flowService.js`

## Backend-Manifest

```js
// backend/modules/flow/index.js
import { requireAuth, requireModuleAccess } from '../../middleware/auth.js';
import { requireFlowAbteilungsleitung } from './middleware/flowAuth.js';
import bildungsgangRouter from './routes/bildungsgang.js';
import arbeitspaketRouter from './routes/arbeitspaket.js';
import aufgabeRouter from './routes/aufgabe.js';
import tagungRouter from './routes/tagung.js';
import dashboardRouter from './routes/dashboard.js';
import abteilungRouter from './routes/abteilung.js';
import kalenderRouter from './routes/kalender.js';

export default {
    id: 'flow',
    name: 'Flow – Kollaborationsformat',
    register(app, { rateLimiters }) {
        const auth = [requireAuth, requireModuleAccess('flow')];

        // Reihenfolge: spezifischere Pfade zuerst!
        app.use('/api/flow/abteilung', ...auth, requireFlowAbteilungsleitung, abteilungRouter);
        app.use('/api/flow/dashboard', ...auth, dashboardRouter);
        app.use('/api/flow/kalender', rateLimiters.booking, kalenderRouter); // Token-Auth, kein JWT
        app.use('/api/flow/aufgaben', ...auth, aufgabeRouter);  // /meine-aufgaben etc.
        app.use('/api/flow/tagungen', ...auth, tagungRouter);   // /tagungen/:id
        app.use('/api/flow/arbeitspakete', ...auth, arbeitspaketRouter);
        app.use('/api/flow/bildungsgaenge', ...auth, bildungsgangRouter);
        app.use('/api/flow/dateien', ...auth, dateiRouter);     // /dateien/:id/download
    },
};
```

**Entscheidung (2026-03-20): Rein internes Modul.** Alle Routen erfordern `requireAuth` + `requireModuleAccess('flow')`. Es gibt keine oeffentlichen Endpunkte (kein `rateLimiters.booking` ohne Auth). Einzige Ausnahme: der Kalender-Feed nutzt Token-Auth statt JWT.

## Route-Aufteilung

### Abweichung vom Fachkonzept

Das Fachkonzept definiert API-Pfade ohne Modul-Praefix (`/api/bildungsgaenge`). Im bestehenden System haben alle Module einen Praefix. Daher:

| Fachkonzept | Implementierung |
|---|---|
| `/api/bildungsgaenge` | `/api/flow/bildungsgaenge` |
| `/api/arbeitspakete/:id` | `/api/flow/arbeitspakete/:id` |
| `/api/aufgaben/:id` | `/api/flow/aufgaben/:id` |
| `/api/tagungen/:id` | `/api/flow/tagungen/:id` |
| `/api/meine-aufgaben` | `/api/flow/aufgaben/meine` |
| `/api/dashboard` | `/api/flow/dashboard` |
| `/api/abteilung/arbeitspakete` | `/api/flow/abteilung/arbeitspakete` |
| `/api/kalender/feed/:token.ics` | `/api/flow/kalender/feed/:token.ics` |

### bildungsgang.js

```
GET    /                    → Eigene Bildungsgaenge
GET    /:id                 → Detail mit Arbeitspaketen
POST   /:id/arbeitspakete   → Neues Arbeitspaket anlegen
```

Middleware:
- `GET /` – `requireAuth` (filtert auf User-Mitgliedschaft)
- `GET /:id` – `requireFlowBildungsgangRolle('mitglied')`
- `POST /:id/arbeitspakete` – `requireFlowPaketAnlage`

### arbeitspaket.js

```
GET    /:id                     → Detail
PATCH  /:id                     → Aktualisieren
PATCH  /:id/status              → Statusuebergang
DELETE /:id                     → Loeschen (nur entwurf)
POST   /:id/abschliessen        → Abschluss
POST   /:id/wiederaufnehmen     → Wiederaufnahme
GET    /:id/mitglieder          → Mitglieder
POST   /:id/mitglieder          → Mitglied hinzufuegen
PATCH  /:id/mitglieder/:uid     → Rolle aendern
DELETE /:id/mitglieder/:uid     → Mitglied entfernen
GET    /:id/dateien             → Dateien
POST   /:id/dateien             → Datei hochladen (Multer)
GET    /:id/aktivitaeten        → Aktivitaets-Feed
GET    /:id/zusammenfassung     → Abschlussdokumentation
```

Middleware:
- Alle: `requireFlowPaketRolle(...)` mit passenden Rollen
- `PATCH /:id/status`, `POST /:id/abschliessen`, `POST /:id/wiederaufnehmen`, Mitglieder-CRUD: nur `['koordination']`
- `GET`-Routen: `['koordination', 'mitwirkende', 'lesezugriff']`
- `POST /:id/dateien`: `['koordination', 'mitwirkende']`

### aufgabe.js

```
POST   /arbeitspakete/:apId/aufgaben   → Aufgabe erstellen
GET    /arbeitspakete/:apId/aufgaben   → Alle Aufgaben eines Pakets
PATCH  /:id                            → Aktualisieren
PATCH  /:id/status                     → Status aendern
DELETE /:id                            → Loeschen
GET    /meine                          → Persoenliche Aufgaben
```

Besonderheit: `PATCH /:id/status` prueft bei `mitwirkende`, ob `aufgabe.zustaendig === req.user.id`.

### tagung.js

```
POST   /arbeitspakete/:apId/tagungen       → Tagung anlegen
GET    /arbeitspakete/:apId/tagungen       → Alle Tagungen
GET    /:id                                → Detail mit Agenda
PATCH  /:id                                → Aktualisieren
DELETE /:id                                → Loeschen
POST   /:id/agenda                         → Agenda-Punkt hinzufuegen
PATCH  /:id/agenda/:aid                    → Agenda-Punkt dokumentieren
POST   /:id/agenda/:aid/aufgaben           → Aufgabe aus Agenda-Punkt
```

### dashboard.js

```
GET    /                → Aggregiertes persoenliches Dashboard
```

Response-Struktur:
```json
{
    "statistik": { "offen": 5, "ueberfaellig": 2, "erledigtDiesenMonat": 12 },
    "meineAufgaben": [...],
    "aktiveArbeitspakete": [...],
    "naechsteTagungen": [...],
    "aktivitaeten": [...]
}
```

### abteilung.js

```
GET    /arbeitspakete   → Aggregierte Uebersicht (nur Name, Status, Deadline)
```

**Harte Grenze:** Der SQL-Query selektiert ausschliesslich `id`, `titel`, `status`, `deadline`, `bg.name AS bildungsgang`. Kein JOIN auf Aufgaben, Mitglieder oder Tagungen.

### kalender.js

```
GET    /feed/:token.ics              → iCal-Feed (Token-Auth, kein JWT)
POST   /abonnement                   → Schulkalender-URL hinterlegen (JWT)
GET    /kollisionen?start=&end=      → Kollisionspruefung (JWT)
POST   /token-regenerieren           → Neues Token (JWT)
```

Besonderheit: `/feed/:token.ics` nutzt **kein JWT**, sondern validiert das Token aus `flow_kalender_token`. Rate-Limiting ueber `rateLimiters.booking`.

## Service-Schicht

```
backend/modules/flow/services/flowService.js
```

Alle DB-Queries gebuendelt in einem Service-Objekt. Trennt Route-Handler von SQL.

Kernfunktionen:
- `getArbeitspaketMitRolle(paketId, userId)` – Detail + Rolle in einem Query
- `pruefeStatusUebergang(paketId, zielStatus)` – Statusmaschine serverseitig
- `erstelleAktivitaet(typ, akteur, paketId, details)` – Audit-Trail
- `getDashboardDaten(userId)` – Aggregierter Dashboard-Query
- `getAbteilungsUebersicht()` – Nur aggregierte Felder

## Concurrency

Optimistic Concurrency ueber `updated_at`:

```js
// Bei PATCH-Requests
const { updated_at: expectedVersion, ...daten } = req.body;

const result = await query(
    `UPDATE flow_arbeitspaket SET titel = $1, updated_at = NOW()
     WHERE id = $2 AND updated_at = $3
     RETURNING *`,
    [daten.titel, paketId, expectedVersion]
);

if (result.rows.length === 0) {
    return res.status(409).json({
        error: 'Konflikt: Das Objekt wurde zwischenzeitlich geaendert. Bitte laden Sie die aktuelle Version.'
    });
}
```

## MVP-Scope fuer Routes

| Route-Datei | MVP | Phase 2 | Phase 3 |
|---|---|---|---|
| bildungsgang.js | Ja | - | - |
| arbeitspaket.js | Ja (ohne aktivitaeten, zusammenfassung) | aktivitaeten, zusammenfassung | - |
| aufgabe.js | Ja | - | - |
| tagung.js | Ja (Basis) | Tagungszaehler | - |
| dashboard.js | Ja (ohne aktivitaeten) | aktivitaeten | - |
| abteilung.js | Ja | - | - |
| kalender.js | - | - | Ja |
