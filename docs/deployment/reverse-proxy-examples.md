# Reverse-Proxy-Beispiele für Docker-Deployment

Wenn das System produktiv betrieben wird, sollte ein Reverse Proxy
vor den Docker-Containern stehen, der TLS (HTTPS) terminiert.

Unten drei gängige Varianten. Wähle eine davon.

---

## Option A – Caddy (empfohlen, am einfachsten)

Caddy holt automatisch Let's-Encrypt-Zertifikate. Null Konfiguration für TLS.

### `docker-compose.override.yml`

```yaml
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
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```

### `Caddyfile`

```
sprechtag.meineschule.de {
    reverse_proxy frontend:80
}
```

> Die nginx-Config im Frontend-Container leitet `/api/*` bereits zum Backend weiter.
> Caddy muss nur den Traffic zum Frontend-Container durchreichen.

---

## Option B – Traefik

### `docker-compose.override.yml`

```yaml
services:
  traefik:
    image: traefik:v3
    restart: unless-stopped
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.le.acme.email=admin@meineschule.de"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_certs:/letsencrypt

  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`sprechtag.meineschule.de`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=le"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"

volumes:
  traefik_certs:
```

---

## Option C – nginx (standalone)

Falls nginx bereits auf dem Server läuft (z. B. als System-Dienst):

### `/etc/nginx/sites-available/sprechtag`

```nginx
server {
    listen 80;
    server_name sprechtag.meineschule.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sprechtag.meineschule.de;

    ssl_certificate     /etc/letsencrypt/live/sprechtag.meineschule.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sprechtag.meineschule.de/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

TLS-Zertifikat z. B. mit `certbot --nginx -d sprechtag.meineschule.de` einrichten.

---

## Security-Header (CSP) im Reverse Proxy

Das Backend setzt bereits CSP-Header via Helmet. Bei Bedarf koennen
zusaetzliche Header auf Reverse-Proxy-Ebene gesetzt werden.

### Nginx CSP-Beispiel

```nginx
# In den server{} Block der HTTPS-Konfiguration einfuegen:

# Security Headers (ergaenzend zu den Backend-Headern)
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

# Strict Transport Security (nur wenn TLS korrekt konfiguriert)
# Hinweis: 'preload' nur nach Registrierung unter hstspreload.org verwenden.
# Ohne Registrierung das Flag entfernen, da es sonst wirkungslos ist.
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

# CSP (nur setzen wenn Backend-CSP ueberschrieben werden soll)
# add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'" always;
```

> **Hinweis:** Das Backend setzt bereits CSP via Helmet (`backend/index.js:34-48`).
> Die CSP-Zeile oben ist auskommentiert – nur aktivieren, wenn der Reverse Proxy
> die Backend-Header ueberschreiben soll. Doppelte CSP-Header koennen zu
> unerwartetem Verhalten fuehren.

---

## Hinweise

- Bei allen Varianten muss in `.env` die `PUBLIC_BASE_URL` auf `https://sprechtag.meineschule.de` gesetzt werden.
- `CORS_ORIGINS` ebenfalls auf `https://sprechtag.meineschule.de` setzen.
- Die Frontend-Ports (`3000:80`) in `docker-compose.yml` können auf `127.0.0.1:3000:80` eingeschränkt werden, damit nur der Reverse Proxy darauf zugreift.
