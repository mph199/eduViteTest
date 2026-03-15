# Plan: Generisches Multi-Rollen-System

## Zusammenfassung

Lehrkraefte sollen zusaetzliche Modul-Berechtigungen erhalten koennen (z.B. Beratungslehrer),
ohne ihren primaeren Login/Rolle zu verlieren. View-Umschaltung im Menue ermoeglicht den Wechsel
zwischen Teacher-Bereich und Modul-Bereichen. SSW bleibt eigenstaendig (kein Lehrer).

## Konzept

- `users.role` bleibt als **primaere Identitaet**: `admin`, `teacher`, `superadmin`, `ssw`
- Neue Tabelle `user_module_access` speichert **zusaetzliche Modul-Berechtigungen**
- `beratungslehrer` wird von einer eigenstaendigen Rolle zu einem **Modul-Zugang**
- JWT-Payload bekommt `modules: string[]` Array
- Middleware prueft sowohl `role` als auch `modules`
- Admin/Superadmin haben implizit Zugriff auf alles (brauchen keine module_access-Eintraege)

### Rollen-Matrix (nach Umbau)

| Primaere Rolle | Kann Modul-Zugang haben? | Teacher-View? | Modul-Views? |
|---|---|---|---|
| `teacher` | Ja (z.B. `beratungslehrer`) | Ja | Ja, per module_access |
| `admin` | Implizit alles | Ja (wenn teacherId) | Ja (immer) |
| `superadmin` | Implizit alles | Ja (wenn teacherId) | Ja (immer) |
| `ssw` | Nein (eigenstaendig) | Nein | Nur SSW |

### Einschraenkungen

- SSW-User (`role='ssw'`) bekommen **keine** Teacher-View (kein Lehrer)
- Teacher bekommen keinen Zugang zu SSW (nur zu Modulen, die per `user_module_access` freigeschaltet sind)
- Bestehende `beratungslehrer`-User werden migriert: role -> `teacher` oder bleiben als eigenstaendige User

---

## Schritt-fuer-Schritt

### Schritt 1: Migration `028_user_module_access.sql`

```sql
-- Neue Tabelle fuer zusaetzliche Modul-Berechtigungen
CREATE TABLE IF NOT EXISTS user_module_access (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_key VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_uma_user_id ON user_module_access(user_id);
CREATE INDEX IF NOT EXISTS idx_uma_module_key ON user_module_access(module_key);

-- Bestehende beratungslehrer-User migrieren:
-- Fuer User mit role='beratungslehrer' UND teacher_id:
--   → role auf 'teacher' setzen, module_access 'beratungslehrer' eintragen
-- Fuer User mit role='beratungslehrer' OHNE teacher_id:
--   → module_access 'beratungslehrer' eintragen, role bleibt (als Fallback)
INSERT INTO user_module_access (user_id, module_key)
SELECT id, 'beratungslehrer' FROM users WHERE role = 'beratungslehrer'
ON CONFLICT DO NOTHING;

UPDATE users SET role = 'teacher' WHERE role = 'beratungslehrer' AND teacher_id IS NOT NULL;

-- Role-Constraint aktualisieren: 'beratungslehrer' entfernen
-- (nur wenn keine beratungslehrer-User ohne teacher_id uebrig sind)
-- Sicherheitshalber behalten wir den Constraint vorerst mit 'beratungslehrer'
```

### Schritt 2: Backend – Auth-Middleware (`backend/middleware/auth.js`)

**Aenderungen:**
- `generateToken()`: `modules`-Array ins JWT aufnehmen
- Neue Hilfsfunktion `hasModuleAccess(user, moduleKey)` → prueft `role` (admin/superadmin = immer) ODER `modules`-Array
- `requireBeratungslehrer` umschreiben: nutzt `hasModuleAccess(user, 'beratungslehrer')`
- Optional: generische `requireModuleAccess(moduleKey)` Factory-Funktion

### Schritt 3: Backend – Login-Route (`backend/routes/auth.js`)

**Aenderungen:**
- Nach erfolgreichem DB-Login: `user_module_access` abfragen
- `modules`-Array an `generateToken()` uebergeben
- `/api/auth/verify` gibt `modules` im Response zurueck

```js
// Beim Login:
const { rows: moduleRows } = await query(
  'SELECT module_key FROM user_module_access WHERE user_id = $1',
  [dbUser.id]
);
const modules = moduleRows.map(r => r.module_key);
// → in JWT und Response aufnehmen
```

### Schritt 4: Backend – Admin-Routen (`backend/routes/admin.js`)

**Neue Endpoints:**
- `GET /api/admin/users/:id/modules` → Liste der Modul-Zugaenge eines Users
- `PUT /api/admin/users/:id/modules` → Modul-Zugaenge setzen (Array von module_keys)

**Geaenderte Endpoints:**
- `GET /api/admin/users` → `modules`-Array pro User mitzuliefern (JOIN oder Subquery)

### Schritt 5: Backend – BL-Modul Counselor-Routes anpassen

**Datei:** `backend/modules/beratungslehrer/routes/counselor.js`

Die lokale `requireBLCounselor`-Middleware muss angepasst werden:
- Statt nur `role === 'beratungslehrer'` auch `modules.includes('beratungslehrer')` pruefen
- Teacher mit BL-Modul-Zugang muss auf seine `bl_counselors`-Daten zugreifen koennen

### Schritt 6: Frontend – Types (`src/types/index.ts`, `src/contexts/AuthContextBase.ts`)

**Aenderungen:**
- `User`-Interface: `modules?: string[]` hinzufuegen
- `ActiveView` erweitern: `'admin' | 'teacher' | 'beratungslehrer'` (spaeter auch `'ssw'`)
- `UserAccount`-Interface: `modules?: string[]`

### Schritt 7: Frontend – AuthContext (`src/contexts/AuthContext.tsx`)

**Aenderungen:**
- `computeInitialView()`: Wenn teacher mit BL-Zugang → stored view oder `'teacher'`
- `setActiveView()`: `'beratungslehrer'` als gueltige View erlauben wenn `modules.includes('beratungslehrer')`
- `isAdminLike()`: Bleibt fuer admin/superadmin. Neue Hilfsfunktion `hasModule(key)`

### Schritt 8: Frontend – GlobalTopHeader (`src/components/GlobalTopHeader.tsx`)

**Aenderungen:**
- `canSwitchView` erweitern: Auch fuer Teacher mit Modul-Zugang
- View-Switcher zeigt dynamisch alle verfuegbaren Views:
  - "Lehrkraft" (wenn teacherId)
  - "Beratungslehrer" (wenn modules.includes('beratungslehrer'))
  - "Admin" (wenn admin/superadmin)
- Menue-Inhalt je nach `activeView` anpassen:
  - `'beratungslehrer'` → BL-spezifische Navigation (wie bisher fuer role=beratungslehrer)

### Schritt 9: Frontend – Benutzerverwaltung (`src/pages/AdminTeachers.tsx`)

**Aenderungen:**
- Modul-Zugaenge als Checkboxen pro User anzeigen (z.B. "Beratungslehrer"-Toggle)
- Nur fuer User mit `role = 'teacher'` relevant (SSW/Admin brauchen es nicht)
- API-Call bei Aenderung: `PUT /api/admin/users/:id/modules`
- In der User-Tabelle eine Spalte/Badge "BL" wenn Modul-Zugang aktiv

### Schritt 10: Frontend – ProtectedRoute (`src/components/ProtectedRoute.tsx`)

**Aenderungen:**
- Redirect-Logik fuer `beratungslehrer` anpassen: Nicht mehr nach Rolle, sondern View-basiert
- Teacher mit BL-Zugang der `/admin/beratungslehrer` aufruft → erlauben

### Schritt 11: Frontend – App.tsx Routen

**Aenderungen:**
- BL-Admin-Routen: `allowedRoles` oder neue `allowedModules`-Prop hinzufuegen
- Teacher mit `beratungslehrer`-Modul-Zugang darf `/admin/beratungslehrer` betreten

---

## Betroffene Dateien (Zusammenfassung)

| Datei | Art der Aenderung |
|---|---|
| `backend/migrations/028_user_module_access.sql` | **Neu** |
| `backend/middleware/auth.js` | JWT-Payload, neue Hilfsfunktionen |
| `backend/routes/auth.js` | Login: modules laden, verify: modules zurueckgeben |
| `backend/routes/admin.js` | Neue Endpoints, Users-Liste erweitern |
| `backend/modules/beratungslehrer/routes/counselor.js` | Middleware anpassen |
| `backend/modules/beratungslehrer/routes/admin.js` | Middleware anpassen |
| `src/types/index.ts` | `modules` zu UserAccount |
| `src/contexts/AuthContextBase.ts` | `modules` zu User, ActiveView erweitern |
| `src/contexts/AuthContext.tsx` | View-Logik, hasModule |
| `src/components/GlobalTopHeader.tsx` | View-Switcher, Menue-Logik |
| `src/components/ProtectedRoute.tsx` | Module-basierter Zugang |
| `src/pages/AdminTeachers.tsx` | Modul-Checkboxen in Benutzerverwaltung |
| `src/services/api.ts` | Neue API-Methoden |
| `src/App.tsx` | Route-Guards anpassen |

## Reihenfolge

1. Migration (028)
2. Backend: Auth-Middleware + Login-Route
3. Backend: Admin-Endpoints
4. Backend: BL-Modul-Routes
5. Frontend: Types + AuthContext
6. Frontend: GlobalTopHeader + ProtectedRoute
7. Frontend: AdminTeachers (Benutzerverwaltung)
8. Build pruefen (`npm run build`)
9. Pruefer-Agent einsetzen
