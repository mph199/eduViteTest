# Sicherheitsdokumentation

> Zentrale Security-Referenz fuer das Schulverwaltungssystem.
> Stand: 2026-03-16 | Bezug: Phase 13 (Security Hardening) aus `../planning/docker-roadmap.md`

---

## 1. Sicherheitsarchitektur (Uebersicht)

```
Browser (React 19)
  |  httpOnly Cookie (JWT)
  |  CORS: Origin-Pruefung
  v
[Reverse Proxy / Nginx]  <-- TLS-Terminierung, optionale CSP-Header
  |
  v
[Express Backend]
  |  Helmet (CSP, X-Content-Type-Options, ...)
  |  Rate Limiting (express-rate-limit)
  |  Auth-Middleware (JWT-Verifikation)
  |  Parametrisierte Queries ($1, $2)
  v
[PostgreSQL 16]
  |  Row Level Security (events, feedback, booking_requests)
  |  Optional: SSL via DB_SSL=true
```

### Implementierte Massnahmen

| Kategorie | Massnahme | Status |
|-----------|-----------|--------|
| Authentifizierung | JWT in httpOnly Cookie, SameSite=Lax, Secure in Prod | Aktiv |
| Autorisierung | Rollen-Middleware (requireAuth, requireAdmin, requireSuperadmin, requireSSW) | Aktiv |
| CSRF | SameSite=Lax + CORS Origin-Pruefung | Aktiv |
| XSS | React Default-Escaping, CSP-Header, Email-Template-Escaping | Aktiv |
| SQL-Injection | Alle Queries parametrisiert ($1, $2) | Aktiv |
| Rate Limiting | Auth 20/15min, Booking 30/15min, Admin 100/15min, Public 60/15min | Aktiv |
| File-Upload | MIME-Check, Extension-Whitelist, SVG blockiert, Groessenlimit | Aktiv |
| Security-Headers | Helmet (CSP, COEP, X-Content-Type-Options, frameAncestors:none) | Aktiv |
| Logging | Pino (JSON in Prod, Pretty in Dev), Request-Logging | Aktiv |
| Passwort-Hashing | bcrypt mit 10 Runden | Aktiv |
| Row Level Security | PostgreSQL RLS auf events, feedback, booking_requests | Aktiv |
| OAuth/OIDC | PKCE (SHA-256), State-Cookie (CSRF), JWKS-Signaturvalidierung (RSA+EC) | Aktiv |
| Token-Verschluesselung | AES-256-GCM fuer OAuth Client-Secrets und Refresh-/Access-Tokens | Aktiv |
| Domain-Einschraenkung | `allowed_domains` pro OAuth-Provider | Aktiv |

---

## 2. Authentifizierung

### JWT-Cookie-Flow

1. Client sendet `POST /api/auth/login` mit `{ username, password }`
2. Backend prueft Credentials (System-Admin via Env-Vars ODER DB-User via bcrypt)
3. Bei Erfolg: JWT wird generiert und als httpOnly Cookie gesetzt
4. Alle weiteren Requests: Cookie wird automatisch mitgesendet
5. Logout: Cookie wird geloescht (`POST /api/auth/logout`)

**Dateien:** `backend/routes/auth.js`, `backend/middleware/auth.js`

### OAuth/OIDC-Login-Flow

Parallelbetrieb mit dem Passwort-Login. OAuth-User erhalten denselben JWT-Cookie.

1. Redirect zum IdP mit PKCE (`code_challenge_method: S256`) und State-Cookie
2. IdP authentifiziert User → Redirect zurueck mit Authorization Code
3. Backend tauscht Code gegen ID-Token + Access-Token
4. ID-Token-Validierung:
   - JWKS-Signaturpruefung (Pflicht, RSA + EC Algorithmen)
   - Issuer-Pruefung gegen Discovery-Dokument
   - Audience-Pruefung gegen `client_id`
   - `exp`-Claim erzwungen (kein Token ohne Ablaufzeit)
   - `nbf`-Claim geprueft (Not Before)
   - `kid`-Header erzwungen (Key-Identifikation)
5. User-Matching: `oauth_user_links.provider_subject` → E-Mail-Match → Auto-Provisioning
6. JWT-Cookie gesetzt → Redirect basierend auf Rolle

**Verschluesselung:** Client-Secrets und Tokens werden mit AES-256-GCM verschluesselt (`backend/config/encryption.js`). Key: `OAUTH_ENCRYPTION_KEY` (32 Byte, base64 oder hex). Format: `iv:ciphertext:authTag` (hex-kodiert).

**Dateien:** `backend/routes/oauth.js`, `backend/services/oauthService.js`, `backend/config/encryption.js`

### Token-Konfiguration

| Parameter | Wert | Datei |
|-----------|------|-------|
| Algorithmus | HS256 (jsonwebtoken Default) | `backend/middleware/auth.js` (`generateToken`) |
| Lebensdauer | 8 Stunden | `backend/middleware/auth.js` (`JWT_EXPIRES_IN`) |
| Cookie maxAge | 8 Stunden | `backend/routes/auth.js` (`cookieOptions`) |
| httpOnly | true | `backend/routes/auth.js` (`cookieOptions`) |
| secure | konfigurierbar via `COOKIE_SECURE` (Default: true in Production) | `backend/routes/auth.js` (`cookieOptions`) |
| sameSite | lax | `backend/routes/auth.js` (`cookieOptions`) |
| path | / | `backend/routes/auth.js` (`cookieOptions`) |

### Token-Payload

```json
{
  "username": "string",
  "role": "admin|teacher|superadmin|ssw",
  "id": "number (DB-User)",
  "teacherId": "number (optional)",
  "modules": ["string (optional)"]
}
```

### Token-Extraktion

Bearer-Header-Extraktion wurde bewusst entfernt (siehe `extractToken()` in `backend/middleware/auth.js`).
Nur httpOnly Cookies werden akzeptiert, um die Angriffsflaeche zu minimieren.

### System-Admin

- Credentials kommen aus `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` (Env-Variablen)
- Passwort-Hash mit bcrypt generieren: `node -e "import('bcryptjs').then(b=>b.default.hash('pw',10).then(console.log))"`
- Wenn nicht gesetzt: System-Admin-Login ist deaktiviert, nur DB-User koennen sich anmelden

---

## 3. Autorisierung

### Rollen-Hierarchie

```
superadmin  -->  Voller Zugriff, alle Module
  admin     -->  Verwaltung, alle Module
    ssw     -->  Schulsozialarbeit-Modul
    teacher -->  Zugewiesene Module (via user_module_access)
```

### Middleware-Kette

| Middleware | Erlaubte Rollen | Datei |
|------------|----------------|-------|
| `requireAuth` | Alle authentifizierten User | `backend/middleware/auth.js` |
| `requireAdmin` | admin, superadmin | `backend/middleware/auth.js` |
| `requireSuperadmin` | superadmin | `backend/middleware/auth.js` |
| `requireSSW` | ssw, admin, superadmin | `backend/middleware/auth.js` |
| `requireModuleAccess(key)` | User mit Modul-Zugriff oder admin/superadmin | `backend/middleware/auth.js` |

### Modul-Zugriffskontrolle

- Modul-Berechtigungen werden in `user_module_access` gespeichert
- Admin/Superadmin haben immer Zugriff auf alle Module
- Berechtigungen werden beim Login geladen und im JWT-Token gespeichert

---

## 4. CSRF-Schutz

### Designentscheidung: SameSite statt CSRF-Tokens

Dieses Projekt verwendet **kein Double-Submit-Cookie** oder CSRF-Token-Pattern.
Stattdessen wird CSRF-Schutz durch die Kombination folgender Massnahmen erreicht:

1. **SameSite=Lax Cookie** – Browser senden das Cookie nur bei Same-Site-Requests
   oder Top-Level-Navigationen (GET). Cross-Origin POST/PUT/DELETE-Requests
   erhalten kein Cookie.

2. **CORS Origin-Pruefung** – Das Backend prueft den `Origin`-Header gegen die
   Whitelist in `CORS_ORIGINS`. Unbekannte Origins werden abgelehnt.
   (`backend/index.js:50-57`)

3. **credentials: 'include'** – Alle Frontend-API-Calls verwenden diese Option,
   damit CORS korrekt funktioniert.

### Warum kein CSRF-Token?

- `SameSite=Lax` wird von allen modernen Browsern unterstuetzt (>97% Marktanteil)
- Die Anwendung laeuft nicht auf Shared-Hosting (keine Subdomain-Angriffe)
- Kein Cross-Origin-Embedding (frameAncestors: none)
- CORS blockiert Cross-Origin-Requests mit Credentials

### Restrisiko

Bei aelteren Browsern ohne SameSite-Support (IE11, sehr alte Android-WebViews)
besteht theoretisch ein CSRF-Risiko. Diese Browser werden nicht unterstuetzt.

---

## 5. XSS-Schutz

### Mehrschichtiger Schutz

| Schicht | Massnahme | Evidenz |
|---------|-----------|---------|
| Frontend | React Default-Escaping (alle Outputs) | Framework-Feature |
| Frontend | Kein unsicheres `dangerouslySetInnerHTML` | 1x vorhanden in EmailBrandingTab, sicher (admin-only, escaped Input) |
| Backend | CSP-Header via Helmet | `backend/index.js:34-48` |
| Backend | Email-Template-Escaping (`esc()`) | `backend/emails/template.js:35-41` |
| Uploads | Restriktive CSP auf `/uploads` (script-src 'none') | `backend/index.js:91-95` |
| Uploads | SVG-Upload blockiert (embedded script Risiko) | `backend/routes/superadmin.js:26` |
| Uploads | X-Content-Type-Options: nosniff | `backend/index.js:93` |

### CSP-Direktiven (Backend)

```
default-src:      'self'
script-src:       'self'
style-src:        'self' 'unsafe-inline'
img-src:          'self' data: blob:
connect-src:      'self' + CORS_ORIGINS
font-src:         'self'
object-src:       'none'
frame-ancestors:  'none'
```

`style-src 'unsafe-inline'` ist notwendig fuer CSS-in-JS und dynamische Styles.

### CSP fuer Uploads

```
default-src:  'none'
img-src:      'self'
style-src:    'none'
script-src:   'none'
```

### Empfohlene Erweiterung

Serverseitige Input-Sanitization mit `sanitize-html` fuer Freitext-Felder
(`message`, `feedback`, `notes`) als zusaetzliche Schutzschicht.
Aktuell nicht implementiert, da React bereits alle Outputs escaped.
Prioritaet: Mittel.

---

## 6. SQL-Injection-Schutz

Alle Datenbankabfragen verwenden parametrisierte Queries:

```javascript
// Korrekt (ueberall im Projekt)
const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);

// VERBOTEN (nirgends im Projekt)
const { rows } = await query(`SELECT * FROM users WHERE id = ${userId}`);
```

Dies wird durch die Projektregeln in `CLAUDE.md` (Regel 2) erzwungen.

---

## 7. Rate Limiting

| Endpunkt-Gruppe | Max Requests | Zeitfenster | Datei |
|-----------------|-------------|-------------|-------|
| `/api/auth/*` | 20 | 15 Minuten | `backend/index.js:64-70` |
| Booking-Endpunkte | 30 | 15 Minuten | `backend/index.js:72-78` |
| `/api/admin/*` | 100 | 15 Minuten | `backend/index.js:80-86` |
| `/api/superadmin` (public) | 60 | 15 Minuten | `backend/routes/superadmin.js:13-19` |

Konfiguration: `standardHeaders: true`, `legacyHeaders: false`.
Rate-Limit-Status wird ueber Standard-Header (`RateLimit-*`) kommuniziert.

### Request-Size-Limit

JSON-Payload ist auf **100kb** begrenzt (`backend/index.js:61`).

---

## 8. File-Upload-Sicherheit

### Validierung

| Pruefung | Details | Datei |
|----------|---------|-------|
| Erlaubte Extensions | .png, .jpg, .jpeg, .webp, .gif | `backend/routes/superadmin.js:27` |
| MIME-Type-Pruefung | image/png, image/jpeg, image/webp, image/gif | `backend/routes/superadmin.js:28` |
| SVG blockiert | Wegen embedded `<script>` Risiko (Stored XSS) | `backend/routes/superadmin.js:26` |
| Dateigroesse Logo/Tile | Max 2 MB | `backend/routes/superadmin.js:30` |
| Dateigroesse Hintergrund | Max 5 MB | `backend/routes/superadmin.js:71-72` |
| Storage | Isoliertes Upload-Verzeichnis (`uploads/`) | `backend/routes/superadmin.js:33-34` |
| Dateiname | Prefix + Timestamp (kein User-Input im Dateinamen) | `backend/routes/superadmin.js:37-39` |

### Upload-Auslieferung

Uploads werden mit restriktiven Headern ausgeliefert:
- `Content-Security-Policy: default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'`
- `X-Content-Type-Options: nosniff`

---

## 9. HTTP-Security-Headers

Ueber Helmet.js konfiguriert (`backend/index.js:34-48`):

| Header | Wert |
|--------|------|
| Content-Security-Policy | Siehe Abschnitt 5 |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY (via frameAncestors: none) |
| X-DNS-Prefetch-Control | off |
| X-Download-Options | noopen |
| Strict-Transport-Security | max-age=15552000 (Helmet Default) |
| X-Permitted-Cross-Domain-Policies | none |
| Referrer-Policy | no-referrer |

`crossOriginEmbedderPolicy` ist deaktiviert, da es mit externen Ressourcen
(Bilder, Fonts) kollidieren kann.

---

## 10. Infrastruktur

### Docker-Konfiguration

| Aspekt | Ist-Stand | Empfehlung |
|--------|-----------|------------|
| Backend-User | Standard node:20-alpine User | `USER node` explizit in Dockerfile.backend setzen |
| Frontend | nginx:alpine (non-root by default) | OK |
| Health Checks | Backend + PostgreSQL konfiguriert | OK |
| Multi-Stage Build | Frontend: node -> nginx | OK |
| Netzwerk-Isolation | Default Bridge Network | Explizite `networks:` definieren (frontend, backend) |

### Warnhinweise fuer Produktion

**PostgreSQL-Port exponiert:** `docker-compose.yml:12` mappt Port 5432 auf den Host.
In Produktion entfernen oder auf `127.0.0.1:5432:5432` einschraenken:

```yaml
# docker-compose.yml – Produktion
services:
  postgres:
    # ports:            # <-- Zeile entfernen oder auskommentieren
    #   - "5432:5432"   #     DB ist nur intern erreichbar
```

**Default-Secrets in docker-compose.yml:**

```yaml
# UNSICHER (aktuelle Defaults – muessen ersetzt werden)
SESSION_SECRET: ${SESSION_SECRET:-<sicherer-wert>}
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-<sicherer-wert>}
```

In Produktion MUESSEN diese Werte ueber `.env` oder Docker Secrets gesetzt werden:

```bash
# .env (Produktion)
SESSION_SECRET=<mindestens-32-zeichen-zufaelliger-string>
POSTGRES_PASSWORD=<sicheres-passwort>
JWT_SECRET=<separater-zufaelliger-string>
```

Generierung:
```bash
openssl rand -base64 48   # Fuer SESSION_SECRET / JWT_SECRET
openssl rand -base64 24   # Fuer POSTGRES_PASSWORD
```

### Docker Secrets (Empfehlung)

Langfristig sollten sensitive Werte ueber Docker Secrets statt Environment-Variablen
konfiguriert werden. Anleitung: https://docs.docker.com/compose/how-tos/use-secrets/

### PostgreSQL SSL

SSL ist konfigurierbar ueber `DB_SSL=true` (`backend/config/db.js:41-43`).
Aktuell: `rejectUnauthorized: false` (MITM-Risiko).

Fuer Produktion empfohlen: CA-Zertifikat konfigurieren und `rejectUnauthorized: true` setzen.

---

## 11. JWT-Secret-Rotation

### Vorgehensweise

1. Neues Secret generieren: `openssl rand -base64 48`
2. In `.env` oder Docker Secret ersetzen
3. Backend neu starten (Container restart)
4. Alle bestehenden Tokens werden ungueltig (Max-Impact: 8h Token-Lebensdauer)
5. Nutzer muessen sich neu anmelden

### Empfohlener Rhythmus

- **Sofort** rotieren: Bei Verdacht auf Kompromittierung
- **Quartalweise**: Regulaere Rotation als Best Practice
- **Bei Personal-Wechsel**: Wenn Administratoren das Team verlassen

### Kein Dual-Key-Support

Aktuell wird nur ein Secret unterstuetzt. Bei Rotation werden alle aktiven Sessions
sofort ungueltig. Ein Dual-Key-Mechanismus (altes + neues Secret parallel) ist nicht
implementiert und in den meisten Faellen nicht noetig (8h Token-Lebensdauer).

---

## 12. Bekannte Luecken und Roadmap

### Hohe Prioritaet

| Luecke | Risiko | Empfohlene Massnahme |
|--------|--------|---------------------|
| ~~Kein Account-Lockout~~ | ~~Brute-Force trotz Rate Limiting~~ | **Behoben** (Migration 042): 5 Fehlversuche → 15min Sperre |
| ~~Kein Security-Event-Logging~~ | ~~Angriffe nicht erkennbar~~ | **Behoben**: `logSecurityEvent()` in `audit-log.js`, auch fuer OAuth-Events |
| Default-Secrets in Compose | Unsichere Defaults in Production | .env-Template mit Generierungsanleitung |
| ~~PostgreSQL Port exponiert~~ | ~~DB von aussen erreichbar~~ | **Behoben** (2026-03-19): Postgres `127.0.0.1:5432:5432`, Backend `127.0.0.1:4000:4000` |

### Mittlere Prioritaet

| Luecke | Risiko | Empfohlene Massnahme |
|--------|--------|---------------------|
| Kein Refresh-Token | Nutzer muessen nach 8h komplett neu einloggen | Access-Token 15min + Refresh-Token 7d |
| Keine Passwort-Richtlinien | Schwache Passwoerter moeglich | Min. 10 Zeichen, Komplexitaetspruefung |
| ~~Kein force_password_change~~ | ~~CSV-Import-Passwoerter bleiben aktiv~~ | **Behoben** (2026-03-19): Migration 044 (Spalte), Migration 048 (Default-Admin), ProtectedRoute erzwingt Redirect fuer alle Rollen inkl. Admin |
| SSL permissiv | MITM bei DB-Verbindung | CA-Zertifikat + rejectUnauthorized: true |
| Kein USER node in Dockerfile | Container laeuft als Root | `USER node` nach `RUN mkdir` einfuegen |

### Niedrige Prioritaet

| Luecke | Risiko | Empfohlene Massnahme |
|--------|--------|---------------------|
| Kein API-Versioning | Breaking Changes bei Updates | `/api/v1/` Prefix einfuehren |
| ~~Kein Dependabot~~ | ~~Veraltete Dependencies~~ | Behoben: `.github/dependabot.yml` konfiguriert |
| Kein Alerting | Keine Echtzeit-Benachrichtigung | Sentry, Datadog oder Webhook-Integration |

---

## 13. Incident-Response-Plan

### Kontakt und Meldekette

1. **Erkennung** – Anomalien in Logs, Nutzermeldung oder automatisches Alerting
2. **Erstbewertung** – Schwere einschaetzen (Datenleck, Systemausfall, Vandalismus)
3. **Sofortmassnahmen** – Siehe unten
4. **Dokumentation** – Vorfall, Timeline, betroffene Daten, ergriffene Massnahmen
5. **DSGVO-Meldung** – Bei personenbezogenen Daten: Aufsichtsbehoerde innerhalb **72 Stunden** informieren (Art. 33 DSGVO)
6. **Betroffene informieren** – Bei hohem Risiko fuer Rechte und Freiheiten (Art. 34 DSGVO)
7. **Nachbereitung** – Root-Cause-Analyse, Massnahmen zur Verhinderung

### Sofortmassnahmen

| Situation | Massnahme |
|-----------|-----------|
| JWT-Secret kompromittiert | Secret rotieren (siehe Abschnitt 11), alle Sessions ungueltig |
| DB-Credentials kompromittiert | Passwort aendern, Backend neu starten, Audit-Log pruefen |
| Account kompromittiert | Passwort-Hash zuruecksetzen, betroffene Buchungen pruefen |
| Malware in Upload | Upload-Verzeichnis pruefen, verdaechtige Dateien entfernen |
| DDoS | Rate Limiting pruefen, ggf. IP-Sperre auf Reverse-Proxy-Ebene |

### Backup und Wiederherstellung

```bash
# PostgreSQL Backup erstellen
docker exec postgres pg_dump -U sprechtag sprechtag > backup_$(date +%Y%m%d).sql

# Wiederherstellung
docker exec -i postgres psql -U sprechtag sprechtag < backup_20260316.sql
```

---

## 14. Pentest-Checkliste

### Automatisierte Tests (OWASP ZAP / Burp Suite Community)

| # | Testfall | Erwartetes Ergebnis |
|---|---------|---------------------|
| 1 | SQL-Injection auf Login | Parametrisierte Queries blockieren alle Payloads |
| 2 | XSS in Freitext-Feldern (message, notes) | React escaped Output; CSP blockiert Inline-Scripts |
| 3 | CSRF-Angriff (Cross-Origin POST) | SameSite=Lax + CORS blockieren Request |
| 4 | Brute-Force Login | Rate Limiting nach 20 Versuchen / 15min |
| 5 | Directory Traversal auf /uploads | express.static blockiert; nosniff-Header |
| 6 | SVG mit Script hochladen | Upload wird abgelehnt (SVG blockiert) |
| 7 | JWT-Manipulation (None-Algorithm) | jsonwebtoken validiert Signatur |
| 8 | JWT in Authorization-Header | Wird ignoriert (nur Cookie akzeptiert) |
| 9 | Zugriff ohne Auth auf Admin-Routen | 401 Unauthorized |
| 10 | Teacher-Zugriff auf Admin-Routen | 403 Forbidden |
| 11 | Uebergrosse JSON-Payload (>100kb) | 413 Payload Too Large |
| 12 | Uebergrosse Datei-Uploads (>5MB) | 400 Bad Request |
| 13 | iFrame-Embedding der App | frameAncestors: none blockiert |
| 14 | Security-Header-Pruefung | Helmet-Headers vorhanden |

### Manuelle Tests

| # | Testfall | Pruefmethode |
|---|---------|-------------|
| 1 | Session nach Logout ungueltig | Cookie loeschen, Verify-Endpoint pruefen |
| 2 | Rollen-Eskalation | Token modifizieren, Signatur wird ungueltig |
| 3 | Horizontale Rechte-Eskalation | Fremde teacher_id in Request, RLS blockiert |
| 4 | Sensitive Daten in Fehlermeldungen | Keine Stack-Traces in Production (Pino) |
| 5 | CORS mit falschem Origin | Request wird abgelehnt |

---

## 15. Referenzen

| Dokument | Pfad |
|----------|------|
| Architektur | `../architecture/system-design.md` |
| Reverse-Proxy-Beispiele | `../deployment/reverse-proxy-examples.md` |
| Auth-Middleware | `backend/middleware/auth.js` |
| Auth-Routen | `backend/routes/auth.js` |
| Server-Setup (Helmet, CORS, Rate Limiting) | `backend/index.js` |
| Upload-Validierung | `backend/routes/superadmin.js` |
| DB-Konfiguration (SSL) | `backend/config/db.js` |
| Docker-Setup | `docker-compose.yml`, `Dockerfile.backend`, `Dockerfile.frontend` |
| Email-Escaping | `backend/emails/template.js` |
