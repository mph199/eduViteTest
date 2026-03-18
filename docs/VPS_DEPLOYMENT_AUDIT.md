# VPS Deployment Audit – eduViteTest (Elternsprechtag)

> Erstellt: 2026-03-18
> Branch: `claude/audit-vps-deployment-hWFLn`

---

## Zusammenfassung

Das Projekt ist **zu ~70% VPS-ready**. Backend, Datenbank und E-Mail laufen bereits auf dem IONOS VPS. Es fehlen jedoch mehrere kritische Komponenten für einen **stabilen, sicheren und wartbaren Produktivbetrieb**.

---

## Status-Übersicht

| Bereich | Status | Priorität |
|---------|--------|-----------|
| Backend auf VPS | ✅ Läuft | — |
| PostgreSQL auf VPS | ✅ Läuft | — |
| PM2 Process Manager | ✅ Aktiv | — |
| Nginx Reverse Proxy | ✅ Aktiv | — |
| SMTP E-Mail | ✅ Konfiguriert | — |
| **PM2 Ecosystem-Datei** | ❌ Fehlt | 🔴 Hoch |
| **Nginx-Konfiguration im Repo** | ❌ Fehlt | 🔴 Hoch |
| **Migrations-Runner** | ❌ Fehlt | 🔴 Hoch |
| **Datenbank-Backup-Strategie** | ❌ Fehlt | 🔴 Hoch |
| **Deployment-Skript** | ❌ Fehlt | 🔴 Hoch |
| **SSL/TLS (Certbot)** | ⬜ Offen lt. ToDo | 🔴 Hoch |
| **Domain/DNS** | ⬜ Offen lt. ToDo | 🔴 Hoch |
| **Sicherheitshärtung** | ⚠️ Teilweise | 🔴 Hoch |
| **Frontend Deploy Now** | ⬜ Offen lt. ToDo | 🟡 Mittel |
| **Health-Check/Monitoring** | ⚠️ Minimal | 🟡 Mittel |
| **Logging** | ⚠️ Nur Console | 🟡 Mittel |
| **Rate Limiting** | ❌ Fehlt | 🟡 Mittel |
| **Helmet (Security Headers)** | ❌ Fehlt | 🟡 Mittel |
| **Docker-Setup** | ❌ Fehlt | 🟢 Optional |
| **CI/CD für Backend** | ❌ Fehlt | 🟡 Mittel |

---

## 🔴 Kritisch – Muss vor Go-Live behoben werden

### 1. PM2 Ecosystem-Datei fehlt

**Problem:** PM2 wird manuell auf dem VPS gestartet. Es gibt keine `ecosystem.config.cjs` im Repository, die Konfiguration ist nicht reproduzierbar.

**Was fehlt:**
```js
// backend/ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'sprechtag-api',
    script: 'index.js',
    cwd: '/var/www/eduViteTest/backend',
    instances: 1,           // oder 'max' für Cluster-Mode
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production',
      PORT: 4000
    },
    max_memory_restart: '256M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/log/pm2/sprechtag-error.log',
    out_file: '/var/log/pm2/sprechtag-out.log',
    merge_logs: true
  }]
};
```

**Warum wichtig:** Ohne Ecosystem-Datei gehen PM2-Einstellungen bei Server-Neustart verloren. PM2 muss mit `pm2 startup` und `pm2 save` persistiert werden.

---

### 2. Nginx-Konfiguration nicht im Repository

**Problem:** Die Nginx-Config existiert nur auf dem VPS. Bei Server-Neuaufbau ist sie verloren.

**Was fehlt:** `deploy/nginx/api.eduvite.de.conf`

```nginx
server {
    listen 80;
    server_name api.eduvite.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.eduvite.de;

    ssl_certificate /etc/letsencrypt/live/api.eduvite.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.eduvite.de/privkey.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Upload-Limit
    client_max_body_size 5M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

### 3. Automatisierter Migrations-Runner fehlt

**Problem:** Es gibt 17 SQL-Migrations-Dateien in `backend/migrations/`, aber keinen Runner, der diese geordnet ausführt. Migration geschieht manuell per `psql`.

**Was fehlt:**
- Ein `backend/scripts/migrate.js`, das:
  - Migrations-Dateien alphabetisch sortiert ausführt
  - Eine `_migrations`-Tabelle pflegt, um bereits angewendete Migrations zu tracken
  - Idempotent ist (kann mehrfach sicher aufgerufen werden)
- Ein npm-Script: `"migrate": "node scripts/migrate.js"`

---

### 4. Datenbank-Backup fehlt

**Problem:** Kein automatisiertes Backup für die PostgreSQL-Datenbank.

**Was fehlt:**
- Ein Backup-Skript (`deploy/scripts/backup-db.sh`):
  ```bash
  #!/bin/bash
  BACKUP_DIR="/var/backups/sprechtag"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  mkdir -p "$BACKUP_DIR"
  pg_dump -U sprechtag sprechtag | gzip > "$BACKUP_DIR/sprechtag_${TIMESTAMP}.sql.gz"
  # Alte Backups aufräumen (>30 Tage)
  find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
  ```
- Ein Cronjob: `0 3 * * * /var/www/eduViteTest/deploy/scripts/backup-db.sh`

---

### 5. Deployment-Skript fehlt

**Problem:** Backend-Deployment auf den VPS geschieht manuell (SSH → git pull → npm install → pm2 restart).

**Was fehlt:** Ein `deploy/scripts/deploy-backend.sh`:
```bash
#!/bin/bash
set -e
cd /var/www/eduViteTest
git pull origin main
cd backend
npm ci --production
npm run migrate   # sobald Migrations-Runner existiert
pm2 reload sprechtag-api --update-env
echo "✅ Deployment abgeschlossen"
```

Alternativ: GitHub Action für SSH-basiertes Deployment (`.github/workflows/deploy-backend.yaml`).

---

### 6. SSL/TLS noch nicht eingerichtet

**Status laut ToDo_IONOS.md:** Offen (Phase 1.4)

**Was fehlt:**
```bash
# Auf dem VPS:
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.eduvite.de
# Auto-Renewal testen:
sudo certbot renew --dry-run
```

---

### 7. Domain/DNS noch nicht konfiguriert

**Status laut ToDo_IONOS.md:** Offen (Phase 1.3 / 5.2)

**Was fehlt:**
- A-Record: `api.eduvite.de` → `217.154.146.101`
- CNAME oder A-Record für Frontend-Domain
- TTL auf 300s setzen vor Umstellung

---

### 8. Sicherheitsprobleme

#### 8a. Admin-Passwort hardcoded
**Datei:** `backend/middleware/auth.js:5-8`

```js
export const ADMIN_USER = {
  username: 'admin',
  passwordHash: '$2b$10$K7KzIVafYIWYoOIIXB2tTeBmrC16USa2HRzx22cC985UDuRKcDpWS' // bksb2024
};
```

**Problem:** Admin-Credentials im Source Code. Jeder mit Repo-Zugang kennt das Passwort.
**Lösung:** Admin-User in die `users`-Tabelle verlagern, Seed-Skript für initialen Admin-User. Login-Route gegen DB prüfen statt gegen Konstante.

#### 8b. Default JWT Secret
**Datei:** `backend/middleware/auth.js:10`

```js
const JWT_SECRET = process.env.JWT_SECRET || 'bksb-jwt-secret-2024-change-in-production';
```

**Problem:** Fallback-Secret ist bekannt. Wenn `JWT_SECRET` nicht gesetzt ist, kann jeder Tokens fälschen.
**Lösung:** Server sollte beim Start abbrechen, wenn `JWT_SECRET` nicht gesetzt ist (in Production).

#### 8c. `.env.production` enthält API-URL und ist im Repo
**Datei:** `.env.production`

Ist aktuell harmlos (nur `VITE_API_URL`), aber das Pattern ist gefährlich – es könnten versehentlich Secrets committed werden.

---

## 🟡 Mittel – Sollte zeitnah umgesetzt werden

### 9. Rate Limiting fehlt

**Problem:** Kein Rate Limiting auf API-Endpunkten. Anfällig für Brute-Force-Login, Spam-Buchungsanfragen, E-Mail-Flooding.

**Lösung:**
```bash
cd backend && npm install express-rate-limit
```
```js
import rateLimit from 'express-rate-limit';

// Global: 100 Requests/Minute
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// Login: 5 Versuche/15 Min
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 5 }));

// Buchungen: 10/Stunde
app.use('/api/booking-requests', rateLimit({ windowMs: 60 * 60_000, max: 10 }));
```

---

### 10. Security Headers (Helmet) fehlen

**Problem:** Keine HTTP Security Headers (HSTS, CSP, X-Frame-Options etc.)

**Lösung:**
```bash
cd backend && npm install helmet
```
```js
import helmet from 'helmet';
app.use(helmet());
```

---

### 11. Backend CI/CD fehlt

**Problem:** Die GitHub Actions deployen nur das Frontend (IONOS Deploy Now). Für das Backend gibt es keinen automatisierten Deploy-Workflow.

**Was fehlt:** `.github/workflows/deploy-backend.yaml`:
```yaml
name: Deploy Backend to VPS
on:
  push:
    branches: [main]
    paths: ['backend/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /var/www/eduViteTest
            git pull origin main
            cd backend
            npm ci --production
            npx pm2 reload sprechtag-api
```

---

### 12. Logging unzureichend

**Problem:** Nur `console.log` – keine strukturierten Logs, keine Log-Rotation, kein Log-Level.

**Empfehlung:**
- Minimum: PM2 Log-Rotation aktivieren (`pm2 install pm2-logrotate`)
- Besser: Strukturiertes Logging mit `pino` oder `winston`
- Optional: Zentrales Log-Management (z.B. Grafana Loki)

---

### 13. Health-Check unvollständig

**Aktuell:** `GET /api/health` existiert, prüft aber nicht die DB-Verbindung.

**Verbesserung:**
```js
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});
```

---

### 14. Kein `NODE_ENV=production`

**Problem:** Nirgendwo wird `NODE_ENV` explizit gesetzt. Express und andere Libraries verhalten sich ohne `NODE_ENV=production` anders (z.B. ausführlichere Fehlermeldungen).

**Lösung:** In `.env` auf dem VPS und in der PM2-Ecosystem-Datei setzen.

---

### 15. Graceful Shutdown fehlt

**Problem:** Bei `pm2 reload` oder Server-Restart werden laufende Requests abgebrochen.

**Lösung in `backend/index.js`:**
```js
const server = app.listen(PORT, HOST, () => { ... });

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    pool.end();
    process.exit(0);
  });
});
```

---

## 🟢 Optional – Nice to have

### 16. Docker/Docker-Compose

Für lokale Entwicklung und ggf. spätere Container-basierte Deployments. Nicht zwingend nötig, da PM2 + Nginx auf dem VPS bereits läuft.

### 17. Firewall-Konfiguration (UFW)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 4000/tcp   # Backend nur über Nginx erreichbar
sudo ufw enable
```

### 18. Fail2Ban für SSH-Schutz

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 19. Automatische Sicherheitsupdates

```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

---

## Empfohlene Reihenfolge

1. **Sicherheitshärtung** (Admin-PW aus Code entfernen, JWT-Secret erzwingen, Helmet, Rate Limiting)
2. **SSL + Domain** einrichten (Certbot, DNS)
3. **PM2 Ecosystem-Datei** erstellen und ins Repo aufnehmen
4. **Nginx-Config** ins Repo aufnehmen
5. **Migrations-Runner** implementieren
6. **Deployment-Skript** erstellen
7. **DB-Backup** einrichten (Cronjob)
8. **Backend CI/CD** (GitHub Actions mit SSH)
9. **Logging** verbessern (PM2-Logrotate, ggf. pino)
10. **Graceful Shutdown** implementieren
11. **Frontend auf IONOS Deploy Now** deployen
12. **Smoke-Tests** durchführen
13. **DNS umstellen** + alte Services abschalten

---

## Fehlende Dateien (Zusammenfassung)

| Datei | Zweck |
|-------|-------|
| `backend/ecosystem.config.cjs` | PM2-Konfiguration |
| `backend/scripts/migrate.js` | Automatisierter Migrations-Runner |
| `deploy/nginx/api.eduvite.de.conf` | Nginx Reverse Proxy Config |
| `deploy/scripts/deploy-backend.sh` | Backend-Deployment-Skript |
| `deploy/scripts/backup-db.sh` | Datenbank-Backup-Skript |
| `.github/workflows/deploy-backend.yaml` | Backend CI/CD Pipeline |
