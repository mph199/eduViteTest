# Migration auf IONOS – ToDo-Liste

## Ausgangslage
- **Aktuell:** Frontend auf Vercel (Static SPA), Backend auf Render (Node.js), Datenbank auf Supabase (PostgreSQL).
- **Ziel:** Alles auf IONOS Webspace + IONOS Datenbank (MySQL oder PostgreSQL, je nach Tarif).

---

## Phase 1: IONOS-Umgebung vorbereiten

- [ ] **1.1 Hosting-Tarif prüfen**
  - Node.js-Unterstützung vorhanden? (IONOS Webhosting = PHP-only; für Node.js braucht man einen **VPS/Cloud-Server** oder **Deploy Now**)
  - Falls nur PHP-Webspace: Prüfen ob IONOS Deploy Now (Git-based Deployment) oder ein VPS-Tarif nötig ist
  - Alternativ: Backend als serverless Functions (nicht nativ auf IONOS)

- [ ] **1.2 Datenbank-Typ klären**
  - IONOS Webhosting bietet MySQL/MariaDB (kein PostgreSQL bei Shared Hosting)
  - IONOS VPS/Cloud: PostgreSQL installierbar
  - **Entscheidung:** PostgreSQL beibehalten (empfohlen, da Schema + Queries darauf ausgelegt) → VPS nötig
  - Oder: MySQL-Migration (erfordert Schema-Anpassungen: `SERIAL` → `AUTO_INCREMENT`, Datumsformate, etc.)

- [ ] **1.3 Domain / Subdomain einrichten**
  - z.B. `sprechtag.meineschule.de` (Frontend)
  - API entweder unter gleicher Domain (`/api/...`) oder Subdomain (`api.sprechtag.meineschule.de`)

- [ ] **1.4 SSL-Zertifikat**
  - IONOS bietet kostenloses SSL (Let's Encrypt) → aktivieren

---

## Phase 2: Datenbank migrieren (Supabase → IONOS)

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

- [ ] **2.3 Datenbank auf IONOS anlegen**
  - PostgreSQL installieren (VPS) oder MySQL-DB anlegen (Shared Hosting)
  - Schema + Daten importieren
  - Testabfrage: `SELECT count(*) FROM teachers;`

- [ ] **2.4 DB-Client im Backend austauschen**
  - **Option A (PostgreSQL beibehalten):** Supabase-JS-Client durch direkten `pg`-Client oder Knex/Drizzle ersetzen
    - `npm install pg` (oder `npm install knex pg`)
    - Alle `supabase.from('table').select/insert/update/delete` Aufrufe umschreiben
    - Betrifft: `backend/index.js`, `backend/routes/*.js`, `backend/services/*.js`
  - **Option B (MySQL):** Zusätzlich Schema-Anpassungen
    - `npm install mysql2` (oder `knex` + `mysql2`)

- [ ] **2.5 Supabase-spezifische Logik entfernen**
  - `backend/config/supabase.js` → durch neue DB-Config ersetzen
  - `@supabase/supabase-js` aus `package.json` entfernen
  - Error-Codes wie `PGRST116` durch Standard-SQL-Fehlerbehandlung ersetzen

---

## Phase 3: Backend auf IONOS deployen

- [ ] **3.1 Node.js-Laufzeit**
  - VPS: Node 20+ installieren (`nvm` oder Distro-Pakete)
  - Prozessmanager einrichten: `pm2` (empfohlen) oder `systemd`-Service
  - ```bash
    npm install -g pm2
    cd /var/www/backend
    pm2 start index.js --name sprechtag-api
    pm2 save && pm2 startup
    ```

- [ ] **3.2 Reverse Proxy (Nginx)**
  - Nginx als Reverse Proxy vor die Node-App:
    ```nginx
    server {
        listen 443 ssl;
        server_name api.sprechtag.meineschule.de;

        location / {
            proxy_pass http://127.0.0.1:4000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
    ```

- [ ] **3.3 Environment-Variablen**
  - `.env` auf dem Server anlegen mit:
    - `DATABASE_URL` (neue DB-Connection)
    - `SESSION_SECRET` / `JWT_SECRET`
    - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (IONOS SMTP oder externer Anbieter)
    - `PUBLIC_BASE_URL` (neue öffentliche URL)
    - `PORT=4000`

- [ ] **3.4 E-Mail-Konfiguration**
  - IONOS bietet eigene SMTP-Server → Zugangsdaten in IONOS Hosting-Panel
  - Alternativ: Bestehende SMTP-Config beibehalten
  - Absender-Adresse auf die Domain setzen (SPF/DKIM in DNS konfigurieren)

---

## Phase 4: Frontend auf IONOS deployen

- [ ] **4.1 Build erstellen**
  - ```bash
    VITE_API_URL=https://api.sprechtag.meineschule.de/api npm run build
    ```
  - Output: `dist/`-Ordner (statische Dateien)

- [ ] **4.2 Dateien hochladen**
  - `dist/`-Inhalt per SFTP/SSH in den Webspace-Ordner (z.B. `/var/www/html/` oder IONOS DocumentRoot)
  - Alternativ: Git-basiertes Deployment mit IONOS Deploy Now

- [ ] **4.3 SPA-Routing konfigurieren**
  - Nginx (VPS):
    ```nginx
    location / {
        try_files $uri $uri/ /index.html;
    }
    ```
  - Apache (Shared Hosting) – `.htaccess`:
    ```apache
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
    ```

- [ ] **4.4 CORS anpassen**
  - Backend-CORS-Config auf die neue Frontend-Domain setzen
  - In `backend/index.js`: `cors({ origin: 'https://sprechtag.meineschule.de' })`

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
  - Supabase-Projekt ggf. als Backup behalten, dann later löschen

---

## Aufwandschätzung

| Aufgabe | Geschätzter Aufwand |
|---|---|
| DB-Client austauschen (Supabase → pg/mysql) | 4–8h (größter Posten) |
| Schema-Migration + Datenimport | 1–2h |
| Server-Setup (Node, Nginx, PM2) | 2–3h |
| Frontend-Deploy + SPA-Config | 0.5–1h |
| E-Mail + DNS + SSL | 1–2h |
| Testing | 2–3h |
| **Gesamt** | **~10–19h** |

**Kritischer Pfad:** Der Austausch des Supabase-JS-Clients durch einen direkten PostgreSQL/MySQL-Client ist die aufwändigste Aufgabe (~50+ Stellen in Backend-Code).
