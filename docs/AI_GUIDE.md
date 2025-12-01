# BKSB Eltern-/Ausbildersprechtag – AI Guide

Dieser Leitfaden hilft KI-Assistenzsystemen (und neuen Entwickler:innen), sich schnell im Projekt zurechtzufinden, sichere Änderungen vorzunehmen und konsistent zu arbeiten.

## Projektüberblick
- Frontend: React + Vite (`src/`), React Router, Context-basiertes Auth, zentraler API-Client.
- Backend: Node.js + Express (`backend/`), Supabase als DB, JWT-Auth.
- Deployment: Vercel (Frontend), Render (Backend) – siehe `vercel.json`, `backend/render.yaml`.

## Lokales Setup
- Voraussetzungen: Node 18+ und npm.
- Frontend starten:
  ```bash
  cd /workspaces/elternsprechtagNavi_01_12_2025
  npm install
  npm run dev   # Standard Port 5173, weicht bei Konflikt aus
  ```
- Backend starten:
  ```bash
  cd /workspaces/elternsprechtagNavi_01_12_2025/backend
  npm install
  # .env mit Supabase-Keys und JWT-Secret notwendig (siehe `backend/config/supabase.js`)
  npm run dev   # Port 4000
  ```

## Architektur & Schlüsseldateien
- `src/App.tsx`: Routing-Setup, Protected-Routes für Admin/Teacher.
- `src/main.tsx`: Root-Render; aktuell ohne globalen Toast-/Error-Provider.
- `src/components/BookingApp.tsx`: Haupt-UI, Lehrerfilter, Slotliste, Booking-Flow.
- `src/components/BookingForm.tsx`: Formular für Buchungen; validiert je nach Besuchertyp.
- `src/hooks/useBooking.ts`: State-Management für Slots, Auswahl und Buchungslogik; liefert `message` für UI-Hinweise.
- `src/services/api.ts`: Zentraler API-Client; setzt Auth-Header, robustes JSON-Parsen, 401 → `auth:logout`-Event.
- `src/components/ProtectedRoute.tsx`: Gate für geschützte Bereiche; leitet nicht authentifizierte Nutzer um.
- Backend:
  - `backend/index.js`: Express-App, öffentliche/Admin/Teacher-Routen.
  - `backend/routes/auth.js`: Login/Logout/Verify, JWT-Issuance (mit `teacherId` bei Lehrern).
  - `backend/routes/teacher.js`: Geschützte Lehrer-Endpoints (Bookings, Slots, Cancel).
  - `backend/middleware/auth.js`: JWT-Validierung, Rollen-Checks.

Hinweis: Ein globaler Toast-Provider und ErrorBoundary sind aktuell nicht implementiert. UI-Hinweise laufen über `useBooking().message`. Falls benötigt, kann ein `ToastProvider` später ergänzt und in `main.tsx` um App gelegt werden.

## Routing
- Öffentlich: `/` (BookingApp), `/login`, `/impressum`, `/datenschutz`
- Geschützt: `/admin/*` (Dashboard, Lehrer, Slots, Settings), `/teacher/*` (Buchungen der Lehrkraft)
- Catch-All: `*` → Redirect auf `/`

## Authentifizierung
- JWT (HS256) im `localStorage` als `auth_token`.
- Bei 401 sendet der API-Client ein globales `auth:logout` Event → Logout-Flow in der App (siehe `src/services/api.ts`).
- `GET /api/auth/verify` liefert Auth-Zustand inkl. `role` und ggf. `teacherId`.

## API-Verträge (vereinheitlichte Antworten)
- Öffentlich:
  - `GET /api/teachers` → `{ teachers: Teacher[] }`
  - `GET /api/slots?teacherId=...` → `{ slots: Slot[] }`
  - `POST /api/bookings` → `{ success: boolean, updatedSlot?: Slot, message?: string }`
- Admin:
  - `GET /api/admin/bookings` → `{ bookings: Booking[] }`
  - `DELETE /api/admin/bookings/:slotId` → `{ success: boolean }`
  - `POST /api/admin/slots` | `PUT /api/admin/slots/:id` | `DELETE /api/admin/slots/:id`
  - `GET/POST/PUT/DELETE /api/admin/teachers` → CRUD für Lehrkräfte
  - `GET/PUT /api/admin/settings` → Admin-Einstellungen
- Teacher:
  - `GET /api/teacher/bookings` → `{ bookings: Booking[] }`
  - `GET /api/teacher/slots` → `{ slots: Slot[] }`
  - `DELETE /api/teacher/bookings/:slotId` → `{ success: boolean }`

## UX-Patterns
- Breadcrumb-Header: „BKSB Navi / Elternsprechtag“ (in `BookingApp`-Header/Breadcrumbs abbilden).
- Hinweise/Toasts:
  - Aktuell: Anzeigen über `useBooking().message` im UI.
  - Optional/Geplant: `showToast(text, type?, durationMs?)` – Typ: `success|error|info`. Standard 5s; sticky via `durationMs=0`.
- Fehlerbehandlung: Globaler ErrorBoundary ist derzeit nicht aktiv; komponentenlokale Fehlerbehandlung nutzen.

## Häufige Aufgaben für KI-Agents
- Buchungsflow anpassen:
  - Änderungen in `useBooking.ts` (Logik) und `BookingForm.tsx` (UI/Validierung).
  - Erfolg/Fehler im UI über `message` anzeigen; optional künftige Toast-API nutzen.
- Admin-Slots:
  - CRUD in `src/pages/AdminSlots.tsx`; nutze `api.admin.*` Methoden.
  - Erfolg/Fehler via klare UI-Meldungen (später Toaster möglich).
- Teacher-Dashboard:
  - `src/pages/TeacherDashboard.tsx`; Storno via `api.teacher.cancelBooking` und danach `load()`.

## Commit-Hygiene (Konventionen)
- Verwende konventionelle Nachrichten:
  - `feat(scope): ...`
  - `fix(scope): ...`
  - `ui(scope): ...`
  - `style(scope): ...`
- Beispiele:
  - `feat(toast): add provider scaffold (inactive)`
  - `fix(booking): improve error mapping for API` 
  - `ui(admin,teacher): surface success/error states in UI`

## Schnellbefehle
```bash
# Frontend starten
cd /workspaces/elternsprechtagNavi_01_12_2025
npm run dev

# Backend starten
cd /workspaces/elternsprechtagNavi_01_12_2025/backend
npm run dev

# Git
cd /workspaces/elternsprechtagNavi_01_12_2025
git status
git add -A && git commit -m "feat: …"
git push origin main
```

## Sicherheit & Qualität
- Verändere nur relevante Dateien, halte Änderungen minimal und konsistent.
- Prüfe API-Verträge; normalisiere Responses zu Arrays, um UI-Fehler (map/filter) zu vermeiden.
- Bei Auth-Änderungen: Token-Handling (`localStorage`, `verify`), `auth:logout`-Events testen.

## Kontaktpunkte für Erweiterung
- CI (optional): Lint/Typecheck/Build Workflows.
- Design Tokens & Dark Mode (optional).
- Erweiterte Toast-Details: Zeit/Datum/Name in Meldungen.

---
Bei Unsicherheit: Suche zuerst in `src/services/api.ts`, `src/components/BookingApp.tsx`, `src/hooks/useBooking.ts` und den jeweiligen Seiten (`AdminSlots.tsx`, `TeacherDashboard.tsx`). Diese spiegeln die Kernlogik der App.