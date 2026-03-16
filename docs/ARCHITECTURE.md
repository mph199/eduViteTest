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
| `ssw_counselors` | Social worker profiles |
| `ssw_categories` | Consultation categories |
| `ssw_appointments` | Appointment slots and bookings |
| `ssw_weekly_schedule` | Recurring weekly availability |

### BL Tables (prefix: `bl_`)

| Table | Purpose |
|-------|---------|
| `bl_counselors` | Guidance counselor profiles |
| `bl_topics` | Consultation topics |
| `bl_appointments` | Appointment slots and bookings |
| `bl_weekly_schedule` | Recurring weekly availability |

## Frontend Architecture

### Routing (`App.tsx`)

| Area | Routes | Protection |
|------|--------|------------|
| Public | `/`, `/login`, `/impressum`, `/datenschutz`, `/verify` | None |
| Module public | `/{module.basePath}` per module | None |
| Teacher | `/teacher/*` (layout + sub-routes from modules) | `requireAuth` |
| Admin | `/admin`, `/admin/teachers`, `/admin/events`, `/admin/feedback` | `requireAdmin` |
| Module admin | `{mod.adminRoutes[].path}` per module | `requireModuleAccess` |
| Superadmin | `/superadmin` | `requireSuperadmin` |

### Navigation

Hamburger slide-out menu (`GlobalTopHeader.tsx` + `Sidebar.tsx`):
- Groups built from module registry's `sidebarNav` property
- Role-filtered via `SidebarNavItem.roles`
- Core admin items (Benutzer & Rechte, Feedback) hardcoded
- Teacher items hardcoded when user has `teacherId`

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

All calls use `credentials: 'include'`. 401 responses dispatch `auth:logout` event.

### Types (`src/types/index.ts`)

Core interfaces: `Teacher`, `TimeSlot`, `BookingFormData`, `BookingRequest`, `Settings`, `FeedbackItem`, `UserAccount`.

Shared domain types (consolidated from previously duplicated local definitions):
- `AdminEvent`, `EventStatus`, `EventStats` – event management
- `Counselor`, `ScheduleEntry`, `CounselorAppointment`, `CounselorTopic` – SSW/BL shared
- `AppointmentSlot`, `CounselorBookingConfig` – counselor booking UI

Component-local `Props` interfaces remain in their component files.

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
    superadmin.js       # Superadmin endpoints (branding, backgrounds, email, text, module config)
    teacher.js          # Teacher endpoints (bookings, requests, password)
  shared/               # Shared factories for SSW/BL deduplication
    counselorService.js       # createCounselorService(config) – DB queries
    counselorPublicRoutes.js  # createCounselorPublicRoutes(service, config) – 4 endpoints
    counselorAdminRoutes.js   # createCounselorAdminRoutes(config) – full CRUD
  modules/
    elternsprechtag/    # Core module (teacher schedule, events)
    schulsozialarbeit/  # SSW module (thin wrappers around shared factories)
      routes/public.js, counselor.js, admin.js
      services/appointmentService.js  # Wrapper around shared counselorService
    beratungslehrer/    # BL module (thin wrappers around shared factories)
      routes/public.js, counselor.js, admin.js
      services/appointmentService.js  # Wrapper around shared counselorService
  middleware/
    auth.js             # JWT extraction, role checks
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
1. **public.js** – Rate-limited. Counselor list, topics, available slots, booking → `createCounselorPublicRoutes()`
2. **counselor.js** – `requireAuth` + local counselor check. Own appointments, schedule (module-specific, not shared)
3. **admin.js** – `requireModuleAccess`. Full CRUD for counselors, topics, appointments → `createCounselorAdminRoutes()`

Module differences are handled via config parameters (table prefix, topic schema, auth middleware, user creation/deletion callbacks).

### Email System

- Dev: `MAIL_TRANSPORT=ethereal` → test emails with preview URL
- Prod: SMTP via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Used for: booking request verification, acceptance confirmations

## Key Design Decisions

1. **Request-based booking** (not direct slot booking) – parents request, teachers accept/decline
2. **Module access via JWT** – `user.modules[]` array baked into token at login time
3. **No global state library** – React context + local state only
4. **SSW/BL share identical architecture** – same 3-router backend (via shared factories), same admin page structure
5. **Flat admin routes** – no nested layout, hamburger menu for navigation
6. **Lazy loading** – all module pages loaded via `React.lazy()`
7. **Directory-based page components** – large pages split into `Page/index.tsx` + sub-components (AdminTeachers, AdminEvents, SuperadminPage)
8. **Shared booking UI** – `src/shared/components/CounselorBookingApp.tsx` used by both SSW and BL modules via config
9. **Structured logging** – Pino logger (`backend/config/logger.js`) for all production backend code; seed/test scripts keep console
10. **Runtime module toggling** – Superadmin can enable/disable modules via UI (`module_config` table). Backend routes stay mounted (loaded at startup), but frontend hides disabled modules. Public API only exposes enabled modules to non-superadmin callers.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` / `JWT_SECRET` | Yes | JWT signing secret |
| `ENABLED_MODULES` | No | Backend: comma-separated module IDs |
| `VITE_ENABLED_MODULES` | No | Frontend: comma-separated module IDs |
| `CORS_ORIGINS` | No | Allowed CORS origins |
| `MAIL_TRANSPORT` | No | `ethereal` (dev) or `smtp` (prod) |
| `VITE_API_URL` | No | Frontend API base URL (default: `/api`) |
| `VITE_MAINTENANCE_MODE` | No | `true`/`1`/`yes` to enable maintenance page |
