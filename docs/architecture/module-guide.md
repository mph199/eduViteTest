# Modul-Anleitung – Neues Modul erstellen

Dieses Projekt nutzt eine modulare Plugin-Architektur. Jedes Funktionsmodul
(z.B. Elternsprechtag, Schulsozialarbeit) lebt in einem eigenen Ordner und
wird über eine zentrale Registry registriert.

---

## Architektur-Überblick

```
backend/
├── config/           ← Shared Kernel (DB, E-Mail, Logger)
├── middleware/        ← Shared Kernel (Auth)
├── routes/            ← Shared Kernel (Auth, Admin, Superadmin)
├── moduleLoader.js   ← Lädt Module dynamisch
└── modules/
    └── elternsprechtag/   ← Beispiel-Modul
        ├── index.js       ← Manifest (Pflicht)
        ├── routes/
        └── services/

src/
├── components/        ← Shared Kernel (Sidebar, Footer, Header …)
├── contexts/          ← Shared Kernel (AuthContext)
├── services/          ← Shared Kernel (API-Client)
└── modules/
    ├── registry.ts    ← Zentrale Modul-Registry
    └── elternsprechtag/   ← Beispiel-Modul
        ├── index.ts       ← Manifest (Pflicht)
        ├── components/
        ├── hooks/
        └── pages/
```

**Shared Kernel** = Auth, User-Verwaltung, E-Mail-Service, Branding, API-Client.
Diese Dienste stehen allen Modulen zur Verfügung und werden nicht dupliziert.

---

## Schritt 1 – Backend-Modul anlegen

### 1.1 Ordnerstruktur erstellen

```bash
mkdir -p backend/modules/meinmodul/routes
mkdir -p backend/modules/meinmodul/services   # optional
```

### 1.2 Route(n) schreiben

Erstelle `backend/modules/meinmodul/routes/public.js`:

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

**Wichtig:** Relative Imports zum Shared Kernel nutzen drei Ebenen (`../../../`),
weil die Datei unter `backend/modules/meinmodul/routes/` liegt.

### 1.3 Manifest erstellen

Erstelle `backend/modules/meinmodul/index.js`:

```js
import publicRouter from './routes/public.js';

export default {
  id: 'meinmodul',
  name: 'Mein Modul',

  register(app, { rateLimiters }) {
    // Öffentliche Routen mit Rate Limiter
    app.use('/api/meinmodul', rateLimiters.booking, publicRouter);
  },
};
```

Die Funktion `register(app, ctx)` erhält:
- `app` – die Express-App-Instanz
- `ctx.rateLimiters.booking` – vorkonfigurierter Rate Limiter

**Das Backend ist fertig.** Der `moduleLoader.js` findet den Ordner automatisch
und ruft `register()` beim Start auf.

### 1.4 (Optional) Eigene Migration

Falls das Modul eigene Tabellen braucht, eine nummerierte SQL-Datei anlegen:

```bash
# Nächste freie Nummer prüfen
ls backend/migrations/

# Migration erstellen
cat > backend/migrations/020_meinmodul_tabellen.sql << 'SQL'
CREATE TABLE IF NOT EXISTS meinmodul_termine (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
SQL
```

Die Migration wird beim nächsten Start automatisch ausgeführt.

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

const MeinModulApp = lazy(() =>
  import('./components/MeinModulApp').then(m => ({ default: m.MeinModulApp }))
);

const meinModul: ModuleDefinition = {
  id: 'meinmodul',
  title: 'Mein Modul',
  description: 'Kurze Beschreibung für die Landing Page.',
  icon: '📋',
  basePath: '/meinmodul',
  PublicPage: MeinModulApp,

  // Optional: Admin-Routen
  // adminRoutes: [
  //   { path: '/admin/meinmodul', label: 'Mein Modul', Component: lazy(() => ...) },
  // ],

  // Optional: Lehrkraft-Bereich
  // teacherLayout: lazy(() => ...),
  // teacherRoutes: [
  //   { index: true, Component: lazy(() => ...) },
  // ],
};

export default meinModul;
```

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

## Shared Kernel – Verfügbare Imports

Module können diese geteilten Dienste nutzen:

### Backend (von `backend/modules/<id>/routes/` oder `/services/`)

| Import | Beschreibung |
|--------|-------------|
| `import { query } from '../../../config/db.js'` | DB-Abfragen |
| `import { requireAuth, requireAdmin } from '../../../middleware/auth.js'` | Auth-Middleware |
| `import { sendMail, isEmailConfigured } from '../../../config/email.js'` | E-Mail-Versand |
| `import { buildEmail, getEmailBranding } from '../../../emails/template.js'` | E-Mail-Templates |
| `import { mapSlotRow } from '../../../utils/mappers.js'` | Daten-Mapper |
| `import logger from '../../../config/logger.js'` | Pino Logger |

### Frontend (von `src/modules/<id>/components/`)

| Import | Beschreibung |
|--------|-------------|
| `import api from '../../../services/api'` | API-Client (mit Cookies) |
| `import type { Teacher } from '../../../types'` | TypeScript-Typen |
| `import { useAuth } from '../../../contexts/useAuth'` | Auth-Hook |
| `import { useActiveView } from '../../../hooks/useActiveView'` | View-Wechsel |

---

## ModuleDefinition – Vollständige Typ-Referenz

```ts
interface ModuleDefinition {
  id: string;           // Eindeutige ID (z.B. 'schulsozialarbeit')
  title: string;        // Anzeigename auf der Landing Page
  description: string;  // Kurze Beschreibung
  icon: string;         // Emoji-Icon
  basePath: string;     // URL-Pfad (z.B. '/schulsozialarbeit')

  PublicPage: LazyExoticComponent<ComponentType>;  // Lazy-geladene Hauptseite

  adminRoutes?: AdminRoute[];        // Zusätzliche Admin-Seiten
  teacherLayout?: LazyExoticComponent<ComponentType>;  // Lehrkraft-Layout
  teacherRoutes?: TeacherRoute[];    // Lehrkraft-Unterseiten
}

interface AdminRoute {
  path: string;       // z.B. '/admin/beratung'
  label: string;      // z.B. 'Beratung'
  Component: LazyExoticComponent<ComponentType>;
}

interface TeacherRoute {
  path?: string;      // z.B. 'termine'
  index?: boolean;    // true = Startseite
  Component: LazyExoticComponent<ComponentType>;
}
```

---

## Checkliste – Neues Modul

- [ ] `backend/modules/<id>/index.js` – Manifest mit `register()`
- [ ] `backend/modules/<id>/routes/` – Mindestens ein Router
- [ ] `backend/migrations/0XX_<id>_*.sql` – Falls eigene Tabellen nötig
- [ ] `src/modules/<id>/index.ts` – Frontend-Manifest
- [ ] `src/modules/<id>/components/` – Mindestens eine Komponente
- [ ] `src/modules/registry.ts` – Import + Eintrag in `allModules`
- [ ] `docker compose up -d --build` – Testen
- [ ] Backend-Logs prüfen: Modul wird geladen
- [ ] Landing Page: Kachel erscheint
- [ ] Route erreichbar: `/<id>` zeigt die Seite
