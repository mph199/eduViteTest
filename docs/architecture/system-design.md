# Architecture – eduViteTest

> Source of truth for system design. Read this BEFORE making changes.

## System Overview

Self-hosted school management platform. Docker Compose with 3 services:
- **Frontend**: React 19 SPA (Vite, TypeScript, port 5173)
- **Backend**: Node.js 20 ESM + Express (port 4000)
- **Database**: PostgreSQL 16

## Module System

Plugin architecture. Modules are independently toggleable via `ENABLED_MODULES` / `VITE_ENABLED_MODULES` (startup) and via the Superadmin UI at runtime (DB-based `module_config` table).

### Backend Module Loading

`backend/moduleLoader.js` scans `backend/modules/*/index.js`. Each module exports:
```js
export function register(app, { rateLimiters }) {
  app.use('/api/<prefix>/admin', adminRouter);
  app.use('/api/<prefix>/counselor', counselorRouter);
  app.use('/api/<prefix>', publicRouter);  // rate limited
}
```

### Frontend Module Loading

`src/modules/registry.ts` imports all modules. Filtered by `VITE_ENABLED_MODULES`.

Each module implements `ModuleDefinition`:
```ts
{
  id: string;              // unique key, matches ENABLED_MODULES
  title: string;           // display name on landing page
  description: string;     // landing page card text
  basePath: string;        // public route (e.g. '/beratungslehrer')
  PublicPage: LazyComponent;
  adminRoutes?: AdminRoute[];
  sidebarNav?: SidebarNavGroup;  // drives hamburger menu navigation
  requiredModule?: string;       // key for user_module_access check
  teacherLayout?: LazyComponent;
  teacherRoutes?: TeacherRoute[];
}
```

### Active Modules

| Module | ID | Backend Prefix | Public Path | DB Prefix |
|--------|-----|---------------|-------------|-----------|
| Elternsprechtag | `elternsprechtag` | `/api/` (core routes) | `/elternsprechtag` | `slots`, `bookings`, `events`, `teachers` |
| Schulsozialarbeit | `schulsozialarbeit` | `/api/ssw` | `/schulsozialarbeit` | `ssw_*` |
| Beratungslehrer | `beratungslehrer` | `/api/bl` | `/beratungslehrer` | `bl_*` |

## Authentication & Authorization

### JWT Flow
1. Login: `POST /api/auth/login` → sets httpOnly cookie `token`
2. Verify: `GET /api/auth/verify` → returns user with role, teacherId, modules
3. Every request: cookie extracted by `extractToken()` in `backend/middleware/auth.js`
4. Frontend: `AuthContext` + `useAuth()` hook, `ProtectedRoute` component
5. Post-login redirect: `LoginPage.tsx` navigates all roles to `/teacher` after successful login

### Roles

| Role | Access |
|------|--------|
| `admin` | All admin routes, all modules |
| `superadmin` | Everything admin + superadmin panel + school settings |
| `teacher` | Teacher area (`/teacher/*`) |
| `ssw` | SSW admin routes |

### Module-Based Access

Beyond roles, users can have module access via `user_module_access` table:
- `requireModuleAccess(moduleKey)` middleware checks `user.modules` array in JWT
- Admin/Superadmin always have access to all modules
- Teachers with module access (e.g. `beratungslehrer`) see module-specific admin views

### Auth Middleware Stack

| Middleware | Allows |
|------------|--------|
| `requireAuth` | Any authenticated user |
| `requireAdmin` | admin, superadmin |
| `requireSuperadmin` | superadmin only |
| `requireSSW` | ssw, admin, superadmin |
| `requireBeratungslehrer` | users with beratungslehrer module access, admin, superadmin |
| `requireModuleAccess(key)` | Factory for custom module checks |

## Database

PostgreSQL 16. DB name: `sprechtag`. Migrations in `backend/migrations/` (auto-run by `migrate.js`).

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (username, role, password hash) |
| `user_module_access` | Module access per user (user_id, module_key) |
| `teachers` | Teacher profiles (name, subject, room, email) |
| `slots` | Time slots for parent-teacher conferences |
| `bookings` | Direct bookings (legacy) |
| `booking_requests` | Request-based booking flow (primary) |
| `events` | Parent-teacher conference events (draft/published/closed) |
| `settings` | Global app settings |
| `feedback` | User feedback messages |
| `site_branding` | School branding (colors, name, logo) |
| `module_config` | Per-module enable/disable state (module_id, enabled, updated_at) |

### SSW Tables (prefix: `ssw_`)

| Table | Purpose |
|-------|---------|
| `ssw_counselors` | Social worker profiles. Includes `requires_confirmation BOOLEAN NOT NULL DEFAULT TRUE` – when FALSE, bookings are confirmed immediately without manual approval. |
| `ssw_categories` | Consultation categories |
| `ssw_appointments` | Appointment slots and bookings |
| `ssw_weekly_schedule` | Recurring weekly availability |

### BL Tables (prefix: `bl_`)

| Table | Purpose |
|-------|---------|
| `bl_counselors` | Guidance counselor profiles. Includes `requires_confirmation BOOLEAN NOT NULL DEFAULT TRUE` – when FALSE, bookings are confirmed immediately without manual approval. |
| `bl_topics` | Consultation topics |
| `bl_appointments` | Appointment slots and bookings |
| `bl_weekly_schedule` | Recurring weekly availability |

### DSGVO / Audit Tables

| Table | Purpose |
|-------|---------|
| `audit_log` | Append-only PII-Zugriffs- und Security-Event-Log (Art. 30 DSGVO) |
| `consent_receipts` | Einwilligungsnachweise pro Modul/Termin |

### DSGVO-Spalten auf bestehenden Tabellen

| Spalte | Tabellen | Zweck |
|--------|----------|-------|
| `restricted` (BOOLEAN) | `booking_requests`, `ssw_appointments`, `bl_appointments` | Art. 18 Verarbeitungseinschraenkung. `WHERE restricted IS NOT TRUE` filtert in Admin-Listen. |
| `verification_token_hash` | `slots`, `booking_requests` | Gehashter Token fuer E-Mail-Verifikation (Klartext-Token entfernt) |

### Row-Level Security (RLS)

RLS ist auf `users`, `ssw_appointments`, `bl_appointments`, `audit_log` aktiviert (Migration 040). Da die Applikation einen einzelnen Pool-User nutzt, dient RLS als Defense-in-Depth. Permissive `app_full_access`-Policies erlauben vollen Zugriff fuer den Pool-User. Bei Wechsel zu Multi-Tenancy werden diese durch tenant_id-basierte Policies ersetzt.

## Frontend Architecture

### Routing (`App.tsx`)

| Area | Routes | Protection |
|------|--------|------------|
| Public | `/`, `/login`, `/impressum`, `/datenschutz`, `/verify` | None |
| Module public | `/{module.basePath}` per module | None |
| Teacher | `/teacher/*` (layout + sub-routes from modules) | `requireAuth` |
| Admin | `/admin`, `/admin/teachers`, `/admin/events`, `/admin/feedback` | `requireAdmin` |
| Module admin | `{mod.adminRoutes[].path}` per module | `requireModuleAccess` |
| Superadmin | `/superadmin` (Tabs: Module, Branding, Hintergruende, E-Mail, Texte, Datenschutz) | `requireSuperadmin` |

### Navigation

Hamburger slide-out menu (`GlobalTopHeader.tsx` + `Sidebar.tsx`):
- Groups built from module registry's `sidebarNav` property
- Role-filtered via `SidebarNavItem.roles`
- Core admin items (Benutzer & Rechte, Feedback) hardcoded
- Teacher items hardcoded when user has `teacherId`

#### Header right-side login indicator (public pages only)

On public pages (`isPublic = true`, i.e. not `/login`, not `/admin/*`, not `/teacher/*`), `GlobalTopHeader` shows a login indicator in the top-right corner:

| State | Element | CSS class | Behaviour |
|-------|---------|-----------|-----------|
| Authenticated | Round SVG user-icon button | `.globalTopHeader__loginStatus` | `<Link to="/teacher">` – navigates to teacher area |
| Not authenticated | "Login" text link | `.globalTopHeader__login` | `<Link to="/login">` |

`.globalTopHeader__loginStatus` is a 36 × 36 px circle with `border-radius: 50%`, branded background (`rgba(var(--brand-primary-rgb), 0.12)`), and a stroke-only SVG person icon.

### State Management

No global store. Component-local state + context:
- `AuthContext` – auth state, user, login/logout
- `BrandingContext` – school branding (name, colors, logo)
- Module pages manage their own state via `useState`/`useEffect`

### API Client (`src/services/api.ts`)

Centralized fetch wrapper. Namespaced:
- `api.auth.*` – login, verify, logout
- `api.admin.*` – teachers, bookings, events, slots, settings, feedback, users
- `api.teacher.*` – bookings, slots, requests, password, feedback
- `api.bl.*` – beratungslehrer module endpoints
- `api.ssw.*` – schulsozialarbeit module endpoints
- `api.events.*`, `api.bookings.*` – public endpoints
- `api.superadmin.*` – school management, module config (enable/disable)
- `api.dataSubject.*` – DSAR-Endpunkte: `search`, `exportData`, `deleteData`, `correctData`, `restrict`, `getAuditLog`, `exportAuditLog`

All calls use `credentials: 'include'`. 401 responses dispatch `auth:logout` event.

### Types (`src/types/index.ts`)

Core interfaces: `Teacher`, `TimeSlot`, `BookingFormData`, `BookingRequest`, `Settings`, `FeedbackItem`, `UserAccount`.

Auth types:
- `ActiveView` – union `'admin' | 'teacher'` for dual-role users
- `User` – authenticated user (username, role, modules, teacherId, forcePasswordChange)

Event types:
- `AdminEvent`, `EventStatus`, `EventStats` – event management

Counselor types (SSW/BL shared):
- `Counselor`, `ScheduleEntry`, `CounselorAppointment`, `CounselorTopic` – SSW/BL shared. `Counselor.requires_confirmation` controls whether bookings need manual approval.
- `AppointmentSlot`, `CounselorBookingConfig` – counselor booking UI. `CounselorBookingConfig.moduleId` identifiziert das Modul fuer die `ConsentCheckbox`

Branding types:
- `SiteBranding` – school visual branding (colors, logo, hero text, tile/background images)
- `TextBranding` – customizable UI text strings (booking page, event banner, modal)
- `EmailBranding` – email template branding (school name, logo, primary color, footer)
- `BrandingData` – DSGVO responsible party, DSB contact fields, Aufsichtsbehoerde (`supervisory_authority`)

Teacher admin types:
- `TeacherInfo` – lightweight teacher record for lists
- `TeacherFormData` – teacher create/edit form fields
- `TeacherLoginResponse` – response with temp credentials after teacher creation

BL admin types:
- `BlFormData` – BL counselor profile form (schedule, specializations, slot duration)

CSV import types:
- `CsvImportResult`, `CsvImportedTeacher`, `CsvSkippedRow` – bulk teacher import response

Slot generation:
- `GenerateSlotsResponse` – Antworttyp fuer Slot-Generierungs-Endpunkte (AdminSlots, AdminEvents)

DSGVO types:
- `ConsentReceipt` – Einwilligungsnachweis (module, appointment, consent version, IP, user agent)
- `DataSubjectSearchResult` – DSAR-Suchergebnis
- `AuditLogEntry`, `AuditLogResponse` – Audit-Log-Datenstrukturen

Component-local `Props` interfaces remain in their component files.

### Shared Components (`src/components/`)

Globale wiederverwendbare Komponenten ausserhalb des Modulsystems:

| Komponente | Datei | Genutzt von |
|-----------|-------|-------------|
| `ConsentCheckbox` | `src/components/ConsentCheckbox.tsx` | `BookingForm.tsx` (Elternsprechtag), `CounselorBookingApp.tsx` (SSW + BL) |
| `Footer` | `src/components/Footer.tsx` | App-Layout |

`ConsentCheckbox` rendert modulspezifischen Einwilligungstext und Link zur `/datenschutz`-Seite. Blockiert Form-Submit solange nicht angehakt.

### Shared Utilities (`src/shared/`)

Wiederverwendbare Komponenten, Konstanten und Hilfsfunktionen fuer Admin-Seiten:

| Pfad | Inhalt | Genutzt von |
|------|--------|-------------|
| `src/shared/components/AdminPageWrapper.tsx` | Wrapper-Div fuer alle Admin-Seiten (CSS-Klassen-Stack + Background-Style) | BLAdmin, SSWAdmin |
| `src/shared/components/CalendarPanel.tsx` | Kalender-UI fuer Terminuebersichten (extrahiert aus BLAdmin + SSWTermineTab) | BLAdmin, SSWTermineTab |
| `src/shared/constants/weekdays.ts` | `WEEKDAY_LABELS`, `WEEKDAY_LABELS_FULL`, `WEEKDAY_SHORT`, `WEEKDAY_SHORT_FULL` | SSWCounselorsTab, AdminTeachers, BLAdmin, CalendarPanel |
| `src/shared/utils/appointmentDate.ts` | `normalizeDate()` – normalisiert Datumswerte auf YYYY-MM-DD | CalendarPanel, BLAdmin |
| `src/shared/utils/statusLabel.ts` | `statusLabel()` – uebersetzt Status-Codes in deutsche Labels | CalendarPanel, TeacherBookings, CounselorAnfragenTab |
| `src/utils/bookingSort.ts` | `parseDateValue()`, `parseStartMinutes()`, `visitorLabel()` – Booking-Sort/Parse-Utilities | AdminDashboard, TeacherBookings |

### Hooks (`src/hooks/`)

| Hook | Datei | Beschreibung |
|------|-------|-------------|
| `useActiveView` | `src/hooks/useActiveView.ts` | Setzt aktive Ansicht (admin/teacher) fuer Dual-Role-User |
| `useFlash` | `src/hooks/useFlash.ts` | Flash-Meldung mit Auto-Reset nach konfigurierbarer Dauer |
| `useBgStyle` | `src/hooks/useBgStyle.ts` | Inline-Style fuer Hintergrundbild aus BrandingContext |

### Background Image System

Superadmin kann pro Seite ein Hintergrundbild hochladen (Superadmin-Panel > Tab "Hintergründe"). Bilder werden in `site_branding.background_images` als JSON-Objekt gespeichert und ueber `BrandingContext` im Frontend bereitgestellt.

#### Verfuegbare Branding-Slots

| Slot-Key | Seite | Anzeige-Label |
|----------|-------|---------------|
| `landing` | Startseite / Moduluebersicht | Landing Page |
| `admin` | Admin- und Lehrkrafte-Bereich | Lehrkraft & Admin |
| `<module.id>` | Oeffentliche Modulseite (je aktiviertes Modul) | `module.title` |

#### Technische Umsetzung

Das Bild wird als halbtransparentes `::before`-Pseudo-Element hinter den Seiteninhalten angezeigt:

```css
/* AdminDashboard.css */
.admin-dashboard::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--admin-bg);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  opacity: 0.10;
  z-index: 0;
  pointer-events: none;
}
```

Der CSS-Custom-Property `--admin-bg` wird von `AdminDashboard.tsx` und `TeacherLayout.tsx` als Inline-Style gesetzt, wenn `branding.background_images.admin` belegt ist:

```tsx
style={branding.background_images?.admin
  ? { '--admin-bg': `url(${api.superadmin.resolveBgUrl(branding.background_images.admin)})` } as React.CSSProperties
  : undefined}
```

Das Pattern ist identisch zu LandingPage (`--landing-bg`) und den Modul-Buchungsseiten (`--booking-bg`). Die Klasse `.admin-dashboard--admin` traegt ein staerkeres Linienmuster; `.admin-dashboard--teacher` ein weicheres.

Der Wrapper `.admin-dashboard` benoetigt `position: relative`, damit das `::before`-Pseudo-Element korrekt positioniert wird. Alle Kinder-Elemente mit eigenem Stacking-Context erhalten `position: relative; z-index: 1` um ueber dem Pseudo-Element zu liegen.

## Backend Architecture

### Route Structure

```
backend/
  index.js              # Express app setup, core route mounting
  routes/
    auth.js             # Login, logout, verify
    admin/              # Admin CRUD (split by resource)
      index.js          # Aggregates all sub-routers
      teacherRoutes.js  # Teacher CRUD, CSV import, BL integration, slot generation
      eventsRoutes.js   # Event CRUD, stats, slot generation (transactional)
      slotsRoutes.js    # Slot CRUD with dynamic filtering
      bookingRoutes.js  # Booking list, cancellation with email
      userRoutes.js     # User management, module access
      settingsRoutes.js # Global settings
      feedbackRoutes.js # Feedback CRUD
      dataSubject.js    # DSAR-Endpunkte Art. 15-21 (Suche, Export, Loeschung, Berichtigung, Einschraenkung)
    superadmin.js       # Superadmin endpoints (branding, backgrounds, email, text, module config)
    teacher.js          # Teacher endpoints (bookings, requests, password)
  shared/               # Shared factories for SSW/BL deduplication
    counselorService.js       # createCounselorService(config) – DB queries
    counselorPublicRoutes.js  # createCounselorPublicRoutes(service, config) – 4 endpoints
    counselorAdminRoutes.js   # createCounselorAdminRoutes(config) – full CRUD
    generateUsername.js       # Umlaut-Transliteration fuer Benutzernamen (dedupliziert)
  modules/
    elternsprechtag/    # Core module (teacher schedule, events)
    schulsozialarbeit/  # SSW module (thin wrappers around shared factories)
      routes/public.js, counselor.js, admin.js
      services/appointmentService.js  # Wrapper around shared counselorService
    beratungslehrer/    # BL module (thin wrappers around shared factories)
      routes/public.js, counselor.js, admin.js
      services/appointmentService.js  # Wrapper around shared counselorService
  middleware/
    auth.js             # JWT extraction, role checks (+ Security-Event-Logging bei 403)
    audit-log.js        # writeAuditLog(), logSecurityEvent() – fire-and-forget PII-Zugriffs-Logging
  config/
    db.js               # PostgreSQL pool (query + getClient for transactions)
    email.js            # Nodemailer config
    logger.js           # Pino logger (JSON in prod, pretty-print in dev)
  utils/
    resolveActiveEvent.js  # Shared active-event resolution logic
    timeWindows.js         # Slot generation helpers
```

### Module Route Pattern (SSW/BL)

Each counseling module follows the same 3-router pattern, built from shared factories in `backend/shared/`:
1. **public.js** – Rate-limited. Counselor list, topics, available slots, booking → `createCounselorPublicRoutes()`. Booking checks `counselor.requires_confirmation`: when `FALSE`, sets status directly to `confirmed` instead of `requested`.
2. **counselor.js** – `requireAuth` + local counselor check. Own appointments (with `?status=` and `?date_from=`/`?date_until=` filters for requests tab), schedule (module-specific, not shared)
3. **admin.js** – `requireModuleAccess`. Full CRUD for counselors (including `requires_confirmation`), topics, appointments → `createCounselorAdminRoutes()`

Module differences are handled via config parameters (table prefix, topic schema, auth middleware, user creation/deletion callbacks).

### Email System

- Dev: `MAIL_TRANSPORT=ethereal` → test emails with preview URL
- Prod: SMTP via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Used for: booking request verification, acceptance confirmations

## Key Design Decisions

1. **Request-based booking** (not direct slot booking) – parents request, teachers accept/decline. For counseling modules (SSW/BL), the `requires_confirmation` flag on each counselor controls this: when `FALSE`, bookings skip the request step and are immediately set to `confirmed` status.
2. **Module access via JWT** – `user.modules[]` array baked into token at login time
3. **No global state library** – React context + local state only
4. **SSW/BL share identical architecture** – same 3-router backend (via shared factories), same admin page structure
5. **Flat admin routes** – no nested layout, hamburger menu for navigation
6. **Lazy loading** – all module pages loaded via `React.lazy()`
7. **Directory-based page components** – large pages split into `Page/index.tsx` + sub-components (AdminTeachers, AdminEvents, SuperadminPage)
8. **Shared booking UI** – `src/shared/components/CounselorBookingApp.tsx` used by both SSW and BL modules via config
9. **Structured logging** – Pino logger (`backend/config/logger.js`) for all production backend code; seed/test scripts keep console
10. **Runtime module toggling** – Superadmin can enable/disable modules via UI (`module_config` table). Backend routes stay mounted (loaded at startup), but frontend hides disabled modules. Public API only exposes enabled modules to non-superadmin callers.
11. **Mobile-first responsive tables** – Admin tables use the `admin-resp-table` CSS pattern with `data-label` attributes on `<td>` elements. On mobile (<768px), `thead` is hidden and rows become cards with label-value pairs via `td::before { content: attr(data-label) }`.
12. **Touch target minimum 44px** – All interactive elements (buttons, slots, navigation arrows) enforce min-height 44px on mobile viewports per WCAG 2.5.5.
13. **iOS Safari compatibility** – `background-attachment: fixed` is replaced with `scroll` on viewports <768px to prevent flicker on iOS Safari.
14. **Background image pattern** – Branding images applied as `::before` pseudo-element with `opacity: 0.10` and `z-index: 0` so they never obscure content. CSS custom property (`--admin-bg`, `--landing-bg`, `--booking-bg`) set via inline style from `useBranding()`. Covers: landing page, admin/teacher area (shared `admin` slot), each module's public booking page.
15. **Universal post-login redirect** – All roles (admin, superadmin, teacher, ssw) are redirected to `/teacher` after login. Role-specific areas are then reachable via the hamburger menu.

## Responsive Strategy

### Breakpoints

| Breakpoint | Target | Usage |
|------------|--------|-------|
| 1024px | Desktop → Tablet | Grid collapse (sidebar becomes static) |
| 900px | Events table | Desktop table → mobile cards toggle |
| 768px | Tablet | admin-resp-table card layout, iOS bg-attachment fix, touch targets 44px |
| 640px | Mobile | Full-width buttons, column layouts, single-column grids |
| 480px | Small phones | Reduced padding, steps column layout, smaller font sizes |
| 375px | Very small phones | Minimal padding |

### Patterns

- **Admin tables**: `admin-resp-table` with `data-label` on `<td>` → card layout on mobile
- **Events**: Desktop table / mobile cards toggle via `.events-table-desktop` / `.events-cards-mobile`
- **Booking tool**: Media queries in `CounselorBookingApp.css` (shared by SSW + BL)
- **Landing page**: flex-wrap cards, column steps on small phones
- **Teacher area**: Desktop/mobile toggle in TeacherRequests, responsive stat-cards

## Environment Variables

### Core

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes* | PostgreSQL connection string (*or use `DB_HOST` etc.) |
| `JWT_SECRET` | Yes | JWT signing secret (primary) |
| `SESSION_SECRET` | No | Fallback alias for `JWT_SECRET` |
| `PORT` | No | Backend port (default: `4000`) |
| `HOST` | No | Backend bind address (default: `0.0.0.0`) |
| `NODE_ENV` | No | `production` or `development` |
| `CORS_ORIGINS` | No | Comma-separated allowed CORS origins |

### Database (alternative to `DATABASE_URL`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST` | No | PostgreSQL host (default: `localhost`) |
| `DB_PORT` | No | PostgreSQL port (default: `5432`) |
| `DB_NAME` | No | Database name (default: `sprechtag`) |
| `DB_USER` | No | Database user (default: `postgres`) |
| `DB_PASSWORD` | No | Database password |
| `DB_SSL` | No | `true` to enable SSL for PostgreSQL connection |
| `DB_SSL_REJECT_UNAUTHORIZED` | No | `false` to allow self-signed certs (development only, default: `true`) |

### Modules

| Variable | Required | Description |
|----------|----------|-------------|
| `ENABLED_MODULES` | No | Backend: comma-separated module IDs |
| `VITE_ENABLED_MODULES` | No | Frontend: comma-separated module IDs |

### Email

| Variable | Required | Description |
|----------|----------|-------------|
| `MAIL_TRANSPORT` | No | `ethereal` (dev) or `smtp` (prod) |
| `SMTP_HOST` | Prod | SMTP server hostname |
| `SMTP_PORT` | No | SMTP port (default: `587`) |
| `SMTP_USER` | Prod | SMTP username |
| `SMTP_PASS` | Prod | SMTP password |
| `FROM_EMAIL` | No | Sender address (default: `no-reply@example.com`) |
| `PUBLIC_BASE_URL` | No | Base URL for email links (default: `http://localhost:5173`) |
| `VERIFICATION_TOKEN_TTL_HOURS` | No | Email verification token lifetime in hours |

### Auth

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_USERNAME` | No | Legacy admin username (middleware/auth.js) |
| `ADMIN_PASSWORD_HASH` | No | Legacy admin password hash (middleware/auth.js) |

### Frontend (Vite)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Frontend API base URL (default: `/api`) |
| `VITE_MAINTENANCE_MODE` | No | `true`/`1`/`yes` to enable maintenance page |

### Logging / Limits

| Variable | Required | Description |
|----------|----------|-------------|
| `LOG_LEVEL` | No | Pino log level (default: `info` in prod, `debug` in dev) |
| `RETENTION_BOOKING_REQUESTS_DAYS` | No | Elternsprechtag: Tage nach Event-Schliessung (default: `180`) |
| `RETENTION_SSW_APPOINTMENTS_DAYS` | No | SSW: Tage nach Termindatum (default: `365`) |
| `RETENTION_BL_APPOINTMENTS_DAYS` | No | BL: Tage nach Termindatum (default: `365`) |
| `RETENTION_CANCELLED_DAYS` | No | Abgesagte Termine: Tage nach Absage (default: `30`) |
