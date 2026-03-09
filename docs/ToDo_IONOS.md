# Migration auf IONOS – ToDo-Liste

## Ausgangslage
- **Vorher:** Frontend auf Vercel (Static SPA), Backend auf Render (Node.js), Datenbank auf Supabase (PostgreSQL).
- **Ziel:** Frontend über **IONOS Deploy Now** (statisches SPA), Backend + PostgreSQL auf **IONOS VPS**.
- **VPS-IP:** `217.154.146.101`
- **Backend-Pfad auf VPS:** `/var/www/eduViteTest/backend`

## Entscheidungen
- **Frontend:** IONOS Deploy Now (Git-basiertes Deployment für Static Sites)
- **Backend:** IONOS VPS/Cloud-Server (Node.js-Runtime mit PM2 + Nginx)
- **Datenbank:** PostgreSQL auf dem VPS (Schema bleibt unverändert)

---

## Phase 1: IONOS-Umgebung vorbereiten

- [x] **1.1 IONOS VPS eingerichtet** ✅
  - Ubuntu 24.04, Node.js v20.20.0, PostgreSQL 16.13 installiert
  - PM2 als Prozessmanager aktiv

- [x] ~~**1.2 Datenbank-Typ klären**~~ ✅
  - **Entscheidung:** PostgreSQL beibehalten → VPS
  - Schema + Queries sind bereits darauf ausgelegt

- [ ] **1.3 Domain / Subdomain einrichten**
  - z.B. `sprechtag.meineschule.de` (Frontend via Deploy Now)
  - API: `api.sprechtag.meineschule.de` (Backend auf VPS)

- [ ] **1.4 SSL-Zertifikat**
  - Deploy Now: SSL automatisch (Let's Encrypt)
  - VPS: Let's Encrypt via Certbot für API-Subdomain

---

## Phase 2: Datenbank migrieren (Supabase → IONOS VPS)

- [x] **2.1 Schema auf VPS angelegt** ✅
  - Datenbank `sprechtag` existiert (Owner: `sprechtag`)
  - Tabellen: `teachers`, `slots`, `booking_requests`, `events`, `users`, `feedback`, `settings`

- [ ] **2.2 Daten importieren**
  - Falls noch Produktivdaten auf Supabase liegen → `pg_dump` + Import auf VPS
  - ```bash
    pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" \
      --data-only --inserts > supabase_data.sql
    # Auf VPS:
    sudo -u sprechtag psql sprechtag < supabase_data.sql
    ```

- [x] **2.3 Datenbank auf IONOS VPS läuft** ✅
  - PostgreSQL 16.13 aktiv seit 24.02.2026
  - DB-Benutzer: `sprechtag`
  - Verbindung über `localhost:5432`

- [x] **2.4 DB-Client im Backend austauschen** ✅ ERLEDIGT
  - ~~Supabase-JS-Client durch direkten `pg`-Client ersetzt~~
  - Neuer DB-Pool: `backend/config/db.js` (nutzt `DATABASE_URL` oder einzelne `DB_*`-Variablen)
  - **93 Supabase-Aufrufe** in **12 Dateien** zu native SQL migriert

- [x] **2.5 Supabase-spezifische Logik entfernt** ✅ ERLEDIGT
  - ~~`backend/config/supabase.js`~~ → ersetzt durch `backend/config/db.js`
  - `@supabase/supabase-js` aus `package.json` entfernt, `pg` hinzugefügt
  - `PGRST116`-Error-Codes durch `rows.length === 0`-Checks ersetzt
  - `.env.example` aktualisiert: `DATABASE_URL` statt Supabase-Keys

---

## Phase 3: Backend auf IONOS VPS deployen

- [x] **3.1 Node.js-Laufzeit** ✅
  - Node.js v20.20.0, npm 10.8.2
  - PM2 aktiv: `sprechtag-api` → Status `online` (61.7 MB)
  - Backend-Pfad: `/var/www/eduViteTest/backend`

- [x] **3.2 Reverse Proxy (Nginx)** ✅
  - Nginx aktiv seit 24.02.2026 (4 Worker-Prozesse)
  - Reverse Proxy konfiguriert für Backend

- [x] **3.3 Environment-Variablen** ✅
  - `.env` auf dem VPS konfiguriert (Backend läuft)

- [ ] **3.4 E-Mail-Konfiguration**
  - IONOS bietet eigene SMTP-Server → Zugangsdaten in IONOS Hosting-Panel
  - Alternativ: Bestehende SMTP-Config beibehalten
  - Absender-Adresse auf die Domain setzen (SPF/DKIM in DNS konfigurieren)

---

## Phase 4: Frontend auf IONOS Deploy Now deployen

- [ ] **4.1 Deploy Now einrichten**
  - GitHub-Repository mit IONOS Deploy Now verbinden
  - Framework-Erkennung: Vite/React (Static Build)
  - Build-Befehl: `npm run build`
  - Output-Verzeichnis: `dist`
  - Environment-Variable setzen: `VITE_API_URL=https://api.sprechtag.meineschule.de/api`

- [ ] **4.2 SPA-Routing konfigurieren**
  - Deploy Now: `.htaccess` im `public/`-Ordner oder Deploy-Now-Config:
    ```apache
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
    ```

- [ ] **4.3 CORS anpassen**
  - Backend: `FRONTEND_URL` auf `https://sprechtag.meineschule.de` setzen
  - Wird automatisch in die CORS-Whitelist aufgenommen (über `backend/index.js`)

---

## Phase 5: Testen & Umschalten

- [ ] **5.1 Smoke-Tests**
  - [ ] Frontend erreichbar, SPA-Routing funktioniert
  - [ ] Login funktioniert (JWT)
  - [ ] Lehrkräfte werden geladen
  - [ ] Buchungsanfrage absenden → Verifizierungs-E-Mail kommt an
  - [ ] Lehrkraft kann Anfrage annehmen → Bestätigungs-E-Mail kommt an
  - [ ] Admin: Events anlegen, Slots generieren, Status setzen

- [ ] **5.2 DNS umstellen**
  - Domain auf IONOS-Server zeigen lassen (A-Record / CNAME)
  - TTL vorher auf 300s senken für schnelle Umschaltung

- [ ] **5.3 Alte Services abschalten**
  - Vercel-Projekt deaktivieren/löschen
  - Render-Service stoppen
  - Supabase-Projekt ggf. als Backup behalten, dann später löschen

---

## Aufwandschätzung (aktualisiert)

| Aufgabe | Geschätzter Aufwand | Status |
|---|---|---|
| DB-Client austauschen (Supabase → pg) | 4–8h | ✅ Erledigt |
| VPS-Setup (Node, Nginx, PM2, PostgreSQL) | 2–3h | ✅ Erledigt |
| Schema-Migration + DB auf VPS | 1–2h | ✅ Erledigt |
| Backend-Deployment auf VPS | 1–2h | ✅ Erledigt |
| Datenimport (Supabase → VPS) | 0.5–1h | ⬜ Offen (falls noch Altdaten benötigt) |
| Domain + SSL einrichten | 1–2h | ⬜ Offen |
| E-Mail-Konfiguration (SMTP) | 0.5–1h | ⬜ Offen |
| Frontend-Deploy (IONOS Deploy Now) | 0.5–1h | ⬜ Offen |
| Testing | 2–3h | ⬜ Offen |
| Alte Services abschalten | 0.5h | ⬜ Offen |
| **Gesamt** | **~14–24h** | **~5–8h verbleibend** |

---

## Migrierte Dateien (Referenz)

| Datei | Änderung |
|---|---|
| `backend/config/db.js` | **NEU** – PostgreSQL Connection Pool |
| `backend/config/supabase.js` | Nicht mehr verwendet (Legacy) |
| `backend/index.js` | 48 Supabase → pg Queries |
| `backend/routes/teacher.js` | 22 Supabase → pg Queries |
| `backend/routes/auth.js` | 1 Supabase → pg Query |
| `backend/services/slotsService.js` | 10 Supabase → pg Queries |
| `backend/services/teachersService.js` | 2 Supabase → pg Queries |
| `backend/seed-teachers-from-stdin.js` | Supabase → pg |
| `backend/reset-teachers.js` | Supabase → pg + `.rpc()` → direkte SQL |
| `backend/reset-users.js` | Supabase → pg |
| `backend/create-teacher-user.js` | Supabase → pg |
| `backend/create-test-booking-requests.js` | Supabase → pg |
| `backend/create-test-confirmed-booking.js` | Supabase → pg |
| `backend/upsert-herrhuhn.js` | Supabase → pg |
| `backend/apply-teacher-salutations.js` | Supabase → pg |
| `backend/package.json` | `@supabase/supabase-js` → `pg` |
| `backend/.env.example` | `SUPABASE_*` → `DATABASE_URL` / `DB_*` |
