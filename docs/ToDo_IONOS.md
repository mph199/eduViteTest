# Migration auf IONOS – ToDo-Liste

## Ausgangslage
- **Aktuell:** Frontend auf Vercel (Static SPA), Backend auf Render (Node.js), Datenbank auf Supabase (PostgreSQL).
- **Ziel:** Frontend über **IONOS Deploy Now** (statisches SPA), Backend + PostgreSQL auf **IONOS VPS**.

## Entscheidungen
- **Frontend:** IONOS Deploy Now (Git-basiertes Deployment für Static Sites)
- **Backend:** IONOS VPS/Cloud-Server (Node.js-Runtime mit PM2 + Nginx)
- **Datenbank:** PostgreSQL auf dem VPS (Schema bleibt unverändert)

---

## Phase 1: IONOS-Umgebung vorbereiten

- [ ] **1.1 IONOS VPS buchen**
  - Mindestens 2 GB RAM, Ubuntu 22/24
  - Node.js 20+ installieren (`nvm` oder Distro-Pakete)
  - PostgreSQL installieren

- [x] ~~**1.2 Datenbank-Typ klären**~~
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

- [ ] **2.1 Schema exportieren**
  - Alle Tabellen aus Supabase exportieren: `teachers`, `slots`, `booking_requests`, `events`, `users`, `feedback`, `settings`
  - Migrations aus `backend/migrations/` in korrekter Reihenfolge anwenden
  - RLS-Policies entfallen (die laufen nur auf Supabase; unser Backend nutzt Service-Role-Key)

- [ ] **2.2 Daten exportieren**
  - `pg_dump` von Supabase (Connection-String aus Supabase Dashboard → Settings → Database)
  - ```bash
    pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" \
      --data-only --inserts > supabase_data.sql
    ```

- [ ] **2.3 Datenbank auf IONOS VPS anlegen**
  - PostgreSQL installieren + DB erstellen:
    ```bash
    sudo apt install postgresql postgresql-contrib
    sudo -u postgres createdb sprechtag
    sudo -u postgres psql sprechtag < backend/schema.sql
    # Migrations anwenden:
    for f in backend/migrations/*.sql; do sudo -u postgres psql sprechtag < "$f"; done
    # Daten importieren:
    sudo -u postgres psql sprechtag < supabase_data.sql
    ```
  - Testabfrage: `SELECT count(*) FROM teachers;`

- [x] **2.4 DB-Client im Backend austauschen** ✅ ERLEDIGT
  - ~~Supabase-JS-Client durch direkten `pg`-Client ersetzt~~
  - Neuer DB-Pool: `backend/config/db.js` (nutzt `DATABASE_URL` oder einzelne `DB_*`-Variablen)
  - **93 Supabase-Aufrufe** in **12 Dateien** zu native SQL migriert:
    - `backend/index.js` (48 Queries)
    - `backend/routes/teacher.js` (22 Queries)
    - `backend/services/slotsService.js` (10 Queries)
    - `backend/seed-teachers-from-stdin.js` (10 Queries)
    - `backend/routes/auth.js` (1 Query)
    - `backend/services/teachersService.js` (2 Queries)
    - + 6 weitere Utility-Scripts

- [x] **2.5 Supabase-spezifische Logik entfernt** ✅ ERLEDIGT
  - ~~`backend/config/supabase.js`~~ → ersetzt durch `backend/config/db.js`
  - `@supabase/supabase-js` aus `package.json` entfernt, `pg` hinzugefügt
  - `PGRST116`-Error-Codes durch `rows.length === 0`-Checks ersetzt
  - `.env.example` aktualisiert: `DATABASE_URL` statt Supabase-Keys

---

## Phase 3: Backend auf IONOS VPS deployen

- [ ] **3.1 Node.js-Laufzeit**
  - Node 20+ installieren (`nvm` oder Distro-Pakete)
  - Prozessmanager einrichten: `pm2`
  - ```bash
    npm install -g pm2
    cd /var/www/backend
    npm install
    pm2 start index.js --name sprechtag-api
    pm2 save && pm2 startup
    ```

- [ ] **3.2 Reverse Proxy (Nginx)**
  - Nginx als Reverse Proxy vor die Node-App:
    ```nginx
    server {
        listen 443 ssl;
        server_name api.sprechtag.meineschule.de;

        ssl_certificate /etc/letsencrypt/live/api.sprechtag.meineschule.de/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/api.sprechtag.meineschule.de/privkey.pem;

        location / {
            proxy_pass http://127.0.0.1:4000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```

- [ ] **3.3 Environment-Variablen**
  - `.env` auf dem Server anlegen (siehe `backend/.env.example`):
    - `DATABASE_URL=postgresql://user:pass@localhost:5432/sprechtag`
    - `SESSION_SECRET` / `JWT_SECRET`
    - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (IONOS SMTP)
    - `PUBLIC_BASE_URL=https://sprechtag.meineschule.de`
    - `FRONTEND_URL=https://sprechtag.meineschule.de`
    - `PORT=4000`

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
| Schema-Migration + Datenimport | 1–2h | ⬜ Offen |
| VPS-Setup (Node, Nginx, PM2, PostgreSQL) | 2–3h | ⬜ Offen |
| Frontend-Deploy (IONOS Deploy Now) | 0.5–1h | ⬜ Offen |
| E-Mail + DNS + SSL | 1–2h | ⬜ Offen |
| Testing | 2–3h | ⬜ Offen |
| **Gesamt** | **~10–19h** | **~6–8h verbleibend** |

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
