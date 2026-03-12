# Installationsanleitung – Elternsprechtag Docker

## Voraussetzungen

- Linux-VPS (Ubuntu 22.04+ empfohlen) oder lokaler Server
- **Minimum:** 1 vCPU, 1 GB RAM, 10 GB Disk (reicht für kleine Schule)
- **Empfohlen:** 2 vCPUs, 2 GB RAM (ab ~500 gleichzeitigen Nutzern)
- Docker & Docker Compose installiert
- Domain mit DNS-Eintrag auf die Server-IP (für HTTPS)

---

## 1. Docker installieren

```bash
# Docker (offizielle Anleitung: https://docs.docker.com/engine/install/)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Neu einloggen, damit die Gruppenänderung greift
```

## 2. Projekt herunterladen

```bash
# Variante A: Vom GitHub Container Registry (empfohlen für Produktion)
mkdir elternsprechtag && cd elternsprechtag
# docker-compose.yml und .env von GitHub holen:
curl -LO https://raw.githubusercontent.com/mph199/eduViteTest/main/docker-compose.yml
curl -Lo .env https://raw.githubusercontent.com/mph199/eduViteTest/main/backend/.env.example

# Variante B: Repository klonen (wenn eigene Anpassungen gewünscht)
git clone https://github.com/mph199/eduViteTest.git elternsprechtag
cd elternsprechtag
cp backend/.env.example .env
```

## 3. Konfiguration anpassen

Bearbeite die `.env`-Datei:

```bash
nano .env
```

**Pflicht-Änderungen:**

```env
# Sichere Passwörter generieren:
POSTGRES_PASSWORD=<sicheres-Passwort>
DATABASE_URL=postgresql://sprechtag:<sicheres-Passwort>@postgres:5432/sprechtag

# Session-Secret (zufällig generieren):
SESSION_SECRET=<zufälliger-Hex-String>
# Generieren mit: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Öffentliche URL (deine Domain):
PUBLIC_BASE_URL=https://sprechtag.meineschule.de
CORS_ORIGINS=https://sprechtag.meineschule.de

# SMTP-Konfiguration (z. B. IONOS):
MAIL_TRANSPORT=smtp
SMTP_HOST=smtp.ionos.de
SMTP_PORT=587
SMTP_USER=noreply@meineschule.de
SMTP_PASS=<smtp-passwort>
FROM_EMAIL="Elternsprechtag <noreply@meineschule.de>"
```

## 4. Starten

```bash
docker compose up -d
```

Beim ersten Start:
- PostgreSQL wird initialisiert
- Alle Datenbank-Migrationen laufen automatisch
- Ein Admin-Benutzer wird angelegt (Username: `admin`)

Prüfe, ob alles läuft:

```bash
docker compose ps
# Alle 3 Container sollten „Up" zeigen

curl http://localhost:4000/api/health
# Erwartete Antwort: {"status":"ok", ...}
```

## 5. HTTPS einrichten

Siehe [docs/reverse-proxy-examples.md](reverse-proxy-examples.md) für Beispiel-Configs.

**Schnellster Weg (Caddy):**

```bash
# Caddyfile erstellen:
cat > Caddyfile <<EOF
sprechtag.meineschule.de {
    reverse_proxy frontend:80
}
EOF

# Caddy als zusätzlichen Service starten:
cat > docker-compose.override.yml <<EOF
services:
  caddy:
    image: caddy:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data

volumes:
  caddy_data:
EOF

docker compose up -d caddy
```

## 6. Erster Login

1. Öffne `https://sprechtag.meineschule.de` im Browser
2. Login mit `admin` / (Passwort aus der Datenbank-Migration)
3. **Sofort** das Admin-Passwort ändern!
4. Unter Superadmin → E-Mail-Branding: Schulname, Logo und Farben anpassen

---

## Updates

```bash
cd /pfad/zu/elternsprechtag

# Neue Images holen und neustarten:
docker compose pull
docker compose up -d

# Neue Migrationen werden beim Start automatisch angewendet.
```

## Backup

Ein Backup-Script ist unter `scripts/backup.sh` enthalten:

```bash
# Manuell ausführen:
./scripts/backup.sh

# Als täglichen Cron-Job einrichten:
crontab -e
# Zeile hinzufügen:
0 2 * * * /pfad/zu/elternsprechtag/scripts/backup.sh
```

Das Script sichert:
- Datenbank-Dump (`pg_dump`)
- Uploads-Verzeichnis (Logos etc.)
- Alte Backups werden nach 30 Tagen gelöscht

## Monitoring

Einfachste Option – Health-Endpoint regelmäßig prüfen:

```bash
# Cron-Job (alle 5 Minuten):
*/5 * * * * curl -sf http://localhost:4000/api/health || echo "ALERT: Elternsprechtag down" | mail -s "Health Alert" admin@meineschule.de
```

Oder [Uptime Kuma](https://github.com/louislam/uptime-kuma) als Docker-Container daneben laufen lassen:

```bash
docker run -d --name uptime-kuma --restart unless-stopped -p 3001:3001 louislam/uptime-kuma
```

## Logs ansehen

```bash
# Alle Logs:
docker compose logs -f

# Nur Backend:
docker compose logs -f backend

# Letzte 50 Zeilen:
docker compose logs --tail 50 backend
```

## Troubleshooting

| Problem | Lösung |
|---|---|
| Container startet nicht | `docker compose logs backend` prüfen |
| DB-Verbindung fehlgeschlagen | `DATABASE_URL` in `.env` prüfen, `docker compose ps` → postgres „healthy"? |
| E-Mails kommen nicht an | SMTP-Zugangsdaten prüfen, `MAIL_TRANSPORT=smtp` gesetzt? |
| CORS-Fehler | `CORS_ORIGINS` muss exakt die Frontend-URL enthalten (mit `https://`) |
| Port belegt | Ports in `docker-compose.yml` anpassen (z. B. `3001:80`) |
