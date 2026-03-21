# Modul-Anleitung – Neues Modul erstellen

Dieses Projekt nutzt eine modulare Plugin-Architektur. Jedes Funktionsmodul
(z.B. Elternsprechtag, Schulsozialarbeit) lebt in einem eigenen Ordner und
wird über eine zentrale Registry registriert.

---

## Architektur-Überblick

```
backend/
├── config/           ← Shared Kernel (DB, E-Mail, Logger)
├── middleware/        ← Shared Kernel (Auth, Audit-Log)
├── routes/            ← Shared Kernel (Auth, Admin, Superadmin)
├── shared/            ← Wiederverwendbare Modul-Bausteine (counselorService, etc.)
├── moduleLoader.js   ← Lädt Module dynamisch
└── modules/
    └── elternsprechtag/   ← Beispiel-Modul
        ├── index.js       ← Manifest (Pflicht)
        ├── routes/
        └── services/

src/
├── components/        ← Shared Kernel (Sidebar, Footer, Header …)
├── contexts/          ← Shared Kernel (AuthContext, ModuleConfigContext)
├── services/          ← Shared Kernel (API-Client)
├── types/             ← Shared Kernel (alle Typen)
└── modules/
    ├── registry.ts    ← Zentrale Modul-Registry
    └── elternsprechtag/   ← Beispiel-Modul
        ├── index.ts       ← Manifest (Pflicht)
        ├── components/
        ├── hooks/
        └── pages/
```

**Shared Kernel** = Auth, User-Verwaltung, E-Mail-Service, Branding, API-Client,
ModuleConfigContext, Audit-Log. Diese Dienste stehen allen Modulen zur Verfügung
und werden nicht dupliziert.

---

## Schritt 1 – Backend-Modul anlegen

### 1.1 Ordnerstruktur erstellen

```bash
mkdir -p backend/modules/meinmodul/routes
mkdir -p backend/modules/meinmodul/services   # optional
```

### 1.2 Route(n) schreiben

Erstelle `backend/modules/meinmodul/routes/public.js` (oeffentliche Routen):

```js
import express from 'express';
import { query } from '../../../config/db.js';

const router = express.Router();

router.get('/termine', async (_req, res) => {
  const { rows } = await query('SELECT * FROM meinmodul_termine ORDER BY id');
  res.json({ termine: rows });
});

export default router;
```

Erstelle `backend/modules/meinmodul/routes/admin.js` (geschuetzte Routen):

```js
import express from 'express';
import { query } from '../../../config/db.js';
import { writeAuditLog } from '../../../middleware/audit-log.js';

const router = express.Router();

router.get('/liste', async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM meinmodul_termine WHERE restricted IS NOT TRUE ORDER BY id'
  );
  writeAuditLog(req.user?.id, 'READ', 'meinmodul_termine', null, {}, req.ip);
  res.json({ termine: rows });
});

export default router;
```

**Wichtig:** Relative Imports zum Shared Kernel nutzen drei Ebenen (`../../../`),
weil die Datei unter `backend/modules/meinmodul/routes/` liegt.

### 1.3 Manifest erstellen

Erstelle `backend/modules/meinmodul/index.js`:

```js
import publicRouter from './routes/public.js';
import adminRouter from './routes/admin.js';
import { requireAuth, requireModuleAccess } from '../../middleware/auth.js';

export default {
  id: 'meinmodul',
  name: 'Mein Modul',

  register(app, { rateLimiters }) {
    // Geschuetzte Routen ZUERST mounten (spezifischere Pfade)
    // Defense in depth: auth auf Mount-Ebene + per-Route
    app.use('/api/meinmodul/admin', rateLimiters.admin,
      requireModuleAccess('meinmodul'), adminRouter);

    // Oeffentliche Routen ZULETZT (mit Rate Limiter, keine Auth)
    app.use('/api/meinmodul', rateLimiters.booking, publicRouter);
  },
};
```

Die Funktion `register(app, ctx)` erhaelt:
- `app` – die Express-App-Instanz
- `ctx.rateLimiters` – vorkonfigurierte Rate Limiter:
  - `.booking` – fuer oeffentliche Buchungs-Endpunkte
  - `.auth` – fuer authentifizierte Endpunkte
  - `.admin` – fuer Admin-Endpunkte

**Routing-Reihenfolge:** Geschuetzte Routen (admin, counselor) ZUERST mounten,
oeffentliche Routen ZULETZT. Express matched top-down – der allgemeinere
oeffentliche Pfad wuerde sonst geschuetzte Sub-Pfade abfangen.

**Das Backend ist fertig.** Der `moduleLoader.js` findet den Ordner automatisch
und ruft `register()` beim Start auf. Modul-IDs muessen `/^[a-z][a-z0-9_-]*$/`
matchen (nur Kleinbuchstaben, Ziffern, `_`, `-`).

### 1.4 (Optional) Eigene Migration

Falls das Modul eigene Tabellen braucht, eine nummerierte SQL-Datei anlegen.
**Aktuelle hoechste Nummer pruefen** (aktuell: 051).

```sql
-- backend/migrations/048_meinmodul_tabellen.sql

CREATE TABLE IF NOT EXISTS meinmodul_termine (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  restricted BOOLEAN NOT NULL DEFAULT FALSE,    -- Art. 18 DSGVO
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meinmodul_termine_created
  ON meinmodul_termine (created_at);
```

**Migrations-Konventionen:**
- Dateiname: `<NNN>_<beschreibung>.sql` (3-stellig, fuehrende Null)
- Alle Tabellen mit `CREATE TABLE IF NOT EXISTS`
- Alle Indizes mit `CREATE INDEX IF NOT EXISTS`
- Spalten-Erweiterungen mit `ADD COLUMN IF NOT EXISTS`
- Zeitstempel: `TIMESTAMPTZ NOT NULL DEFAULT NOW()` (nie `TIMESTAMP` ohne Zone)
- Fremdschluessel: `ON DELETE CASCADE` (harte FK) oder `ON DELETE SET NULL` (weiche FK)
- PII-Tabellen mit `restricted BOOLEAN NOT NULL DEFAULT FALSE` (Art. 18 DSGVO)
- PII-Tabellen mit Row-Level Security:

```sql
ALTER TABLE meinmodul_termine ENABLE ROW LEVEL SECURITY;
ALTER TABLE meinmodul_termine FORCE ROW LEVEL SECURITY;
CREATE POLICY meinmodul_termine_policy ON meinmodul_termine
  FOR ALL USING (true);
```

- Generated Columns fuer Berater-Module:

```sql
name VARCHAR(511) GENERATED ALWAYS AS (TRIM(first_name || ' ' || last_name)) STORED
```

Die Migration wird beim naechsten Start automatisch ausgefuehrt.

---

## Schritt 2 – Frontend-Modul anlegen

### 2.1 Ordnerstruktur erstellen

```bash
mkdir -p src/modules/meinmodul/components
mkdir -p src/modules/meinmodul/pages      # optional
mkdir -p src/modules/meinmodul/hooks       # optional
```

### 2.2 Hauptkomponente schreiben

Erstelle `src/modules/meinmodul/components/MeinModulApp.tsx`:

```tsx
import { useState, useEffect } from 'react';
import api from '../../../services/api';

export function MeinModulApp() {
  const [termine, setTermine] = useState([]);

  useEffect(() => {
    // API-Aufruf an das eigene Backend-Modul
    fetch('/api/meinmodul/termine', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setTermine(data.termine || []));
  }, []);

  return (
    <div>
      <h1>Mein Modul</h1>
      {termine.map((t: any) => (
        <p key={t.id}>{t.title}</p>
      ))}
    </div>
  );
}
```

### 2.3 Manifest erstellen

Erstelle `src/modules/meinmodul/index.ts`:

```ts
import { lazy } from 'react';
import type { ModuleDefinition } from '../registry';

// Lazy-Loading: Named Exports werden auf default gemappt
const MeinModulApp = lazy(() =>
  import('./components/MeinModulApp').then(m => ({ default: m.MeinModulApp }))
);

const MeinModulAdmin = lazy(() =>
  import('./pages/MeinModulAdmin').then(m => ({ default: m.MeinModulAdmin }))
);

const meinModul: ModuleDefinition = {
  id: 'meinmodul',
  title: 'Mein Modul',
  description: 'Kurze Beschreibung fuer die Landing Page.',
  icon: '',                          // Leer lassen (keine Emojis in der UI)
  basePath: '/meinmodul',

  // Accent-Farbe (CSS Custom Property + RGB-Triplet fuer rgba)
  accent: 'var(--module-accent-meinmodul)',
  accentRgb: '100, 150, 200',       // Anpassen

  PublicPage: MeinModulApp,

  // Zugangskontrolle: nur Benutzer mit module_access 'meinmodul'
  requiredModule: 'meinmodul',

  // Admin-Routen (in ProtectedRoute mit allowedModules eingebettet)
  adminRoutes: [
    { path: '/admin/meinmodul', label: 'Mein Modul', Component: MeinModulAdmin },
  ],

  // Sidebar-Navigation
  sidebarNav: {
    label: 'Mein Modul',
    items: [
      { path: '/admin/meinmodul', label: 'Verwaltung', roles: ['admin', 'superadmin'] },
      { path: '/meinmodul', label: 'Uebersicht' },   // Ohne roles = fuer alle sichtbar
    ],
  },

  // Optional: Lehrkraft-Bereich
  // teacherLayout: lazy(() => import('./components/TeacherLayout').then(m => ({ default: m.TeacherLayout }))),
  // teacherRoutes: [
  //   { index: true, Component: lazy(() => import('./components/TeacherDashboard').then(m => ({ default: m.TeacherDashboard }))) },
  //   { path: 'termine', Component: lazy(() => ...) },
  // ],
};

export default meinModul;
```

**Wichtige Felder:**

| Feld | Wirkung |
|------|---------|
| `requiredModule` | Aktiviert Zugangssteuerung ueber `user_module_access`. Module MIT `requiredModule` sind in allen Sidebar-Views sichtbar. Module OHNE sind nur im Admin-View sichtbar. |
| `accent` / `accentRgb` | Modul-Akzentfarbe fuer Sidebar und UI-Elemente |
| `sidebarNav.items[].roles` | Filtert Sidebar-Eintraege nach Benutzerrolle. Ohne `roles` = fuer alle mit Zugang sichtbar. |

### 2.4 In der Registry registrieren

In `src/modules/registry.ts` **zwei Zeilen** hinzufügen:

```ts
import elternsprechtagModule from './elternsprechtag/index';
import meinModul from './meinmodul/index';              // ← NEU

const allModules: ModuleDefinition[] = [
  elternsprechtagModule,
  meinModul,                                             // ← NEU
];
```

**Das Frontend ist fertig.** Die Landing Page zeigt automatisch eine neue Kachel,
und die Route `/meinmodul` wird dynamisch registriert.

---

## Schritt 3 – Testen

```bash
# Container neu bauen
docker compose up -d --build

# Backend-Logs prüfen – Modul sollte geladen werden
docker compose logs backend --tail 10
# Erwartete Ausgabe:
#   Modul geladen: Mein Modul
#   Aktive Module: ["elternsprechtag", "meinmodul"]

# API testen
curl http://localhost:3000/api/meinmodul/termine

# Frontend im Browser öffnen
# → Landing Page zeigt neue Kachel
# → Klick führt zu /meinmodul
```

---

## Modul aktivieren / deaktivieren

Über Umgebungsvariablen können einzelne Module gezielt ein-/ausgeschaltet werden.

### Backend

```env
# In .env oder docker-compose.yml
# Leer = alle Module laden (Standard)
ENABLED_MODULES=

# Nur bestimmte Module:
ENABLED_MODULES=elternsprechtag

# Mehrere Module:
ENABLED_MODULES=elternsprechtag,schulsozialarbeit
```

### Frontend

```env
# Build-Arg in docker-compose.yml oder .env
VITE_ENABLED_MODULES=

# Nur bestimmte Module:
VITE_ENABLED_MODULES=elternsprechtag
```

**Wichtig:** Frontend wird zur **Build-Zeit** konfiguriert (Vite baked die
Env-Variable ein). Nach Änderung muss der Frontend-Container neu gebaut werden.
Das Backend reagiert sofort auf Änderungen beim Neustart.

---

## Shared Kernel – Verfuegbare Imports

Module koennen diese geteilten Dienste nutzen:

### Backend (von `backend/modules/<id>/routes/` oder `/services/`)

| Import | Beschreibung |
|--------|-------------|
| `import { query } from '../../../config/db.js'` | DB-Abfragen |
| `import { requireAuth, requireAdmin, requireSuperadmin } from '../../../middleware/auth.js'` | Auth-Middleware (Rollen) |
| `import { requireSSW, requireModuleAccess } from '../../../middleware/auth.js'` | Auth-Middleware (Modul-Zugang) |
| `import { sendMail, isEmailConfigured } from '../../../config/email.js'` | E-Mail-Versand |
| `import { buildEmail, getEmailBranding } from '../../../emails/template.js'` | E-Mail-Templates |
| `import { mapSlotRow } from '../../../utils/mappers.js'` | Daten-Mapper |
| `import logger from '../../../config/logger.js'` | Pino Logger |
| `import { writeAuditLog, logSecurityEvent } from '../../../middleware/audit-log.js'` | Audit-/Security-Logging |
| `import { generateUsername } from '../../../shared/generateUsername.js'` | Benutzernamen-Generierung (Umlaut-Transliteration) |

### Frontend (von `src/modules/<id>/components/`)

| Import | Beschreibung |
|--------|-------------|
| `import api from '../../../services/api'` | API-Client (mit Cookies) |
| `import type { Teacher } from '../../../types'` | TypeScript-Typen |
| `import { useAuth } from '../../../contexts/useAuth'` | Auth-Hook |
| `import { useModuleConfig } from '../../../contexts/ModuleConfigContext'` | Modul-Aktivierungs-Check |
| `import { useActiveView } from '../../../hooks/useActiveView'` | View-Wechsel |
| `import { useFlash } from '../../../hooks/useFlash'` | Flash-Meldungen mit Auto-Reset |
| `import { AdminPageWrapper } from '../../../shared/components/AdminPageWrapper'` | Standard-Wrapper fuer Admin-Seiten |
| `import { WEEKDAY_LABELS } from '../../../shared/constants/weekdays'` | Wochentag-Beschriftungen (DE) |

---

## ModuleDefinition – Vollstaendige Typ-Referenz

```ts
interface ModuleDefinition {
  // ── Pflichtfelder ──
  id: string;           // Eindeutige ID (z.B. 'schulsozialarbeit')
  title: string;        // Anzeigename auf der Landing Page
  description: string;  // Kurze Beschreibung
  icon: string;         // Leer lassen ('') – keine Emojis in der UI
  basePath: string;     // URL-Pfad (z.B. '/schulsozialarbeit')
  PublicPage: LazyExoticComponent<ComponentType>;  // Lazy-geladene oeffentliche Seite

  // ── Optionale Felder ──
  accent?: string;      // CSS Custom Property (z.B. 'var(--module-accent-ssw)')
  accentRgb?: string;   // RGB-Triplet fuer rgba() (z.B. '26, 127, 122')

  adminRoutes?: AdminRoute[];        // Admin-Seiten
  sidebarNav?: SidebarNavGroup;      // Sidebar-Navigationsgruppe
  requiredModule?: string;           // Key fuer user_module_access-Zugangskontrolle

  teacherLayout?: LazyExoticComponent<ComponentType>;  // Lehrkraft-Layout-Wrapper
  teacherRoutes?: TeacherRoute[];    // Lehrkraft-Unterseiten
}

interface AdminRoute {
  path: string;       // z.B. '/admin/beratung'
  label: string;      // z.B. 'Beratung'
  Component: LazyExoticComponent<ComponentType>;
}

interface TeacherRoute {
  path?: string;      // z.B. 'termine' (relativ zu /teacher)
  index?: boolean;    // true = Startseite unter /teacher
  Component: LazyExoticComponent<ComponentType>;
}

interface SidebarNavItem {
  path: string;       // z.B. '/admin/meinmodul'
  label: string;      // z.B. 'Verwaltung'
  roles?: string[];   // Nur fuer diese Rollen sichtbar (optional)
}

interface SidebarNavGroup {
  label: string;           // Gruppen-Label in der Sidebar
  items: SidebarNavItem[];
}
```

### Wie Module in der App registriert werden

**Admin-Routen** (`App.tsx`): Jede `adminRoute` wird in eine `ProtectedRoute` eingebettet.
Wenn `requiredModule` gesetzt ist, wird `allowedModules` an `ProtectedRoute` uebergeben.
Admin/Superadmin-Rollen umgehen alle Modul-Checks (Bypass in `ProtectedRoute`).

**Lehrkraft-Routen** (`App.tsx`): Module mit `teacherLayout` + `teacherRoutes` registrieren
Routen unter `/teacher`. Aktuell nutzt nur `elternsprechtag` den Lehrkraft-Bereich.

**Sidebar** (`GlobalTopHeader.tsx`): Iteriert ueber `activeModules`, prueft `hasModuleAccess(mod.requiredModule)`,
filtert `sidebarNav.items` nach `user.role`. Module mit `requiredModule` sind in allen Views sichtbar;
Module ohne `requiredModule` nur im Admin-View.

**Superadmin-Bereich**: Wird NICHT ueber Module gesteuert. Der Superadmin-Bereich ist ein Core-Feature
mit eigener Route (`/superadmin`) und `requireSuperadmin`-Middleware.

---

## Checkliste – Neues Modul

### Backend
- [ ] `backend/modules/<id>/index.js` – Manifest mit `export default { id, name, register(app, { rateLimiters }) }`
- [ ] `backend/modules/<id>/routes/public.js` – Oeffentliche Routen mit `rateLimiters.booking`
- [ ] `backend/modules/<id>/routes/admin.js` – Admin-Routen mit Auth-Middleware
- [ ] `backend/migrations/<NNN>_<id>_*.sql` – Falls eigene Tabellen noetig (`IF NOT EXISTS`, `TIMESTAMPTZ`)
- [ ] Auth-Middleware auf allen nicht-oeffentlichen Routen
- [ ] Routing-Reihenfolge: geschuetzte Routen ZUERST, oeffentliche ZULETZT
- [ ] Alle DB-Queries parametrisiert (`$1`, `$2`)
- [ ] PII-Tabellen mit `restricted`-Spalte und RLS

### Frontend
- [ ] `src/modules/<id>/index.ts` – Frontend-Manifest mit `ModuleDefinition`
- [ ] `src/modules/<id>/components/` – Mindestens eine Komponente
- [ ] `src/modules/registry.ts` – Import + Eintrag in `allModules`
- [ ] `requiredModule` gesetzt wenn Zugangskontrolle noetig
- [ ] `sidebarNav` definiert mit passenden `roles`-Filtern
- [ ] `accent` / `accentRgb` fuer Modul-Akzentfarbe
- [ ] Modul-spezifische Typen in `src/types/index.ts`
- [ ] API-Methoden in `src/services/api.ts`
- [ ] Lazy-Loading mit Named-Export-Mapping: `.then(m => ({ default: m.Component }))`
- [ ] Farben via `var(--brand-*)` – keine hardcodierten Hex/RGB

### Env + Config
- [ ] `ENABLED_MODULES` / `VITE_ENABLED_MODULES` erweitern (`.env`, `docker-compose.yml`)
- [ ] `module_config`-Tabelle: INSERT analog bestehender Module (Migration 033)

### Testen
- [ ] `docker compose up -d --build`
- [ ] Backend-Logs pruefen: Modul wird geladen
- [ ] Landing Page: Kachel erscheint
- [ ] Route erreichbar: `/<id>` zeigt die Seite
- [ ] Admin-Route erreichbar und geschuetzt
- [ ] Sidebar-Eintraege korrekt gefiltert nach Rolle

---

## Audit-Logging in Modulen

Wenn ein Modul personenbezogene Daten (PII) verarbeitet, muss der Zugriff protokolliert werden.

### writeAuditLog

```js
import { writeAuditLog } from '../../../middleware/audit-log.js';

// Fire-and-forget – blockiert die Response nicht
writeAuditLog(
  req.user?.id,       // userId (null fuer System-Events)
  'READ',             // action: READ | WRITE | DELETE | EXPORT | RESTRICT
  'ssw_appointments', // tableName
  appointment.id,     // recordId (optional)
  { email },          // details (JSONB, optional)
  req.ip              // ipAddress
);
```

### logSecurityEvent

Fuer sicherheitsrelevante Events (fehlgeschlagene Logins, 403-Zugriffe):

```js
import { logSecurityEvent } from '../../../middleware/audit-log.js';

logSecurityEvent('LOGIN_FAIL', { username }, req.ip);
```

### restricted-Flag

Tabellen mit `restricted BOOLEAN`-Spalte (Art. 18 DSGVO):
- Admin-Listen filtern standardmaessig mit `WHERE restricted IS NOT TRUE`
- Superadmin sieht alle Daten uneingeschraenkt
- Gesetzt/aufgehoben ueber den Datenschutz-Tab in der Superadmin-Oberflaeche

---

## Shared Utilities (`backend/shared/`)

| Datei | Funktion | Genutzt von |
|-------|----------|-------------|
| `counselorService.js` | DB-Queries fuer Berater-Module | SSW, BL |
| `counselorPublicRoutes.js` | Oeffentliche Routen (Slots, Buchung, Consent) | SSW, BL |
| `counselorAdminRoutes.js` | Admin-CRUD fuer Berater | SSW, BL |
| `generateUsername.js` | `generateUsername(firstName, lastName, fallbackId, prefix)` – Umlaut-Transliteration | teacherRoutes, counselorAdminRoutes |

---

## DSGVO / Datenschutz in Modulen

### Consent-Receipts

Module die Buchungen/Termine mit PII verarbeiten, muessen Einwilligungsnachweise speichern:

```js
await query(
  `INSERT INTO consent_receipts (module, appointment_id, consent_version, consent_purpose, ip_address, user_agent)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [moduleName, appointmentId, 'meinmodul-v1',
   'Terminbuchung und Kontaktaufnahme', req.ip || null, req.get('user-agent') || null]
);
```

- Append-only: Consent-Receipts werden bei Widerruf NICHT geloescht (Nachweispflicht Art. 7 DSGVO)
- `consent_version`: Format `<modul>-v<n>` (z.B. `ssw-v1`, `est-v1`)
- Tabellen-Schema: siehe Migration 036

### Anonymisierung

Module mit PII-Daten sollten Anonymisierungsfunktionen bereitstellen:
- PII-Felder auf NULL setzen + `restricted = TRUE` + `updated_at = NOW()`
- Strukturdaten (Zeitslots, Statistiken) bleiben erhalten
- Referenz: Migrationen 034, 047 (`anonymize_booking_request`, `anonymize_booking_requests_by_email`)

### restricted-Flag (Art. 18 DSGVO)

Tabellen mit `restricted BOOLEAN NOT NULL DEFAULT FALSE`:
- Admin-Listen filtern mit `WHERE restricted IS NOT TRUE`
- Superadmin sieht alle Daten uneingeschraenkt
- Wird gesetzt bei Anonymisierung oder ueber den Datenschutz-Tab

---

## ModuleConfigContext – Laufzeit-Aktivierung

Neben der Build-Zeit-Filterung (`VITE_ENABLED_MODULES`) gibt es eine Laufzeit-Aktivierung
ueber die Superadmin-Oberflaeche.

### Funktionsprinzip
- Laedt beim App-Start von `/superadmin/modules/enabled`
- Liefert `Set<string> | null` – `null` = noch nicht geladen → alle aktiv (graceful degradation)
- `isModuleEnabled(id)`: true wenn `enabledModules === null` ODER `enabledModules.has(id)`

### Verwendung in Komponenten
```ts
import { useModuleConfig } from '../contexts/ModuleConfigContext';

const { isModuleEnabled } = useModuleConfig();
const activeModules = useMemo(
  () => modules.filter((m) => isModuleEnabled(m.id)),
  [isModuleEnabled]
);
```

### Wichtig: Build-Zeit vs. Laufzeit
- `VITE_ENABLED_MODULES` / `ENABLED_MODULES` = Build-Zeit / Start-Zeit Filter
- `ModuleConfigContext` / `module_config`-Tabelle = Laufzeit UI-Guard
- **Sicherheitshinweis:** `ENABLED_MODULES` ist der echte Backend-Guard.
  Die `module_config`-Tabelle blockiert Modul-Endpunkte NICHT auf Backend-Ebene.
- Feature-Gates in Komponenten MUESSEN `isModuleEnabled()` verwenden, NICHT `getModule()` aus der Registry
