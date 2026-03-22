# OAuth-Integration – Planungsdokument

> **Stand:** 2026-03-21
> **Status:** Implementiert (Phase A vollstaendig, Phase B Superadmin-CRUD implementiert, Phase C Token-Persistenz implementiert)
> **Bezug:** Phase 8 in `docker-roadmap.md`, Flow-Modul (`flow/01-datenbank-schema.md`)
> **Ziel:** Schulen koennen sich ueber ihren bestehenden Identity Provider (Microsoft Entra ID, Logineo NRW, generisches OIDC) anmelden. Paralleler Betrieb mit bestehendem Username/Passwort-Login.

---

## 1. Uebersicht

### Warum OAuth/OIDC?

| Treiber | Details |
|---------|---------|
| Schulen mit Microsoft 365 Education | Lehrkraefte wollen sich mit ihrem bestehenden Microsoft-Konto anmelden |
| Logineo NRW | Landesweite Plattform mit OIDC-Endpunkt – viele NRW-Schulen nutzen Logineo als SSO |
| Flow-Modul: Datei-Storage | WebDAV-Anbindung an OneDrive/Logineo benoetigt OAuth-Tokens fuer Dateizugriff |
| Weniger Passwoerter | Lehrkraefte muessen kein separates eduVite-Passwort verwalten |
| Schultraeger-Anforderung | Zentrale Benutzerverwaltung ueber den Identity Provider der Schule |

### Architektur-Ueberblick

```
Browser
  |  1. Klick "Mit Microsoft/Logineo anmelden"
  |  2. Redirect zu IdP (Authorization Code Flow + PKCE)
  v
[Identity Provider]  (Microsoft Entra ID / Logineo / generisch OIDC)
  |  3. User authentifiziert sich beim IdP
  |  4. Redirect zurueck mit Authorization Code
  v
[eduVite Backend]
  |  5. Backend tauscht Code gegen ID-Token + Access-Token
  |  6. E-Mail aus ID-Token extrahieren
  |  7. User-Matching: E-Mail → users-Tabelle
  |  8. JWT-Cookie setzen (wie bei normalem Login)
  v
[Browser]
  |  9. Redirect zum Dashboard
```

---

## 2. Unterstuetzte Identity Provider

### Phase 1: Microsoft Entra ID (Azure AD)

| Parameter | Wert |
|-----------|------|
| Protokoll | OpenID Connect (OAuth 2.0 Authorization Code Flow + PKCE) |
| Discovery URL | `https://login.microsoftonline.com/{tenant}/.well-known/openid-configuration` |
| Scopes | `openid profile email` |
| Grant Type | `authorization_code` |
| Response Type | `code` |
| Token-Endpunkt | `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token` |
| User-Info | Aus dem ID-Token (`preferred_username`, `email`, `name`) |

**Azure App-Registrierung:**
1. App im Azure Portal unter "App registrations" anlegen
2. Redirect URI: `https://{domain}/api/auth/microsoft/callback`
3. Client Secret generieren
4. API Permissions: `User.Read` (delegated)
5. Optional: Admin Consent fuer die Organisation erteilen

### Phase 2: Logineo NRW

| Parameter | Wert |
|-----------|------|
| Protokoll | OpenID Connect |
| Discovery URL | Vom Land NRW bereitgestellt (variiert) |
| Scopes | `openid profile email` |
| Besonderheit | Schul-spezifische Tenant-Konfiguration |

### Phase 3: Generischer OIDC-Provider

Jeder OIDC-konforme Provider (Keycloak, Authentik, Open-Xchange, etc.) soll unterstuetzt werden durch:
- Konfigurierbare Discovery-URL
- Konfigurierbare Scopes
- Konfigurierbare Claim-Mappings (welches Feld = E-Mail, welches = Name)

---

## 3. Datenbank-Aenderungen

### Migration: `052_oauth.sql`

```sql
BEGIN;

-- OAuth-Provider-Konfiguration pro Instanz
CREATE TABLE IF NOT EXISTS oauth_providers (
    id SERIAL PRIMARY KEY,
    provider_key VARCHAR(50) NOT NULL UNIQUE,    -- 'microsoft', 'logineo', 'custom_oidc'
    display_name VARCHAR(255) NOT NULL,           -- 'Mit Microsoft anmelden'
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    -- OIDC-Konfiguration
    client_id VARCHAR(500) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,         -- AES-256-GCM verschluesselt
    discovery_url TEXT NOT NULL,                   -- .well-known/openid-configuration
    scopes VARCHAR(500) NOT NULL DEFAULT 'openid profile email',
    -- Claim-Mapping
    email_claim VARCHAR(100) NOT NULL DEFAULT 'email',
    name_claim VARCHAR(100) NOT NULL DEFAULT 'name',
    -- Optional: Tenant-Einschraenkung
    allowed_domains TEXT,                          -- Kommasepariert, z.B. 'schule.nrw.de,bksb.de'
    -- Auto-Provisioning
    auto_provisioning BOOLEAN NOT NULL DEFAULT FALSE,
    -- Metadaten
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OAuth-Verknuepfung: Welcher IdP-User gehoert zu welchem eduVite-User
CREATE TABLE IF NOT EXISTS oauth_user_links (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES oauth_providers(id) ON DELETE CASCADE,
    provider_subject VARCHAR(500) NOT NULL,        -- 'sub' Claim aus dem ID-Token
    provider_email VARCHAR(500),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    UNIQUE(provider_id, provider_subject),
    UNIQUE(user_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user_links_user ON oauth_user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_user_links_provider ON oauth_user_links(provider_id);

-- Spalte fuer OAuth-Refresh-Token (fuer WebDAV-Zugriff)
-- Wird bei jedem OAuth-Login aktualisiert
ALTER TABLE oauth_user_links
    ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

COMMIT;
```

### Aenderungen an bestehenden Tabellen

**Keine Aenderung an `users`-Tabelle noetig:**
- OAuth-User werden weiterhin als regulaere `users`-Eintraege gefuehrt
- `password_hash` kann NULL sein (OAuth-only User haben kein Passwort)
- Die Verknuepfung laeuft ueber `oauth_user_links`

```sql
-- users.password_hash nullable machen (falls noch NOT NULL)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
```

---

## 4. Backend-Implementierung

### Neue Dateien

```
backend/
  routes/
    oauth.js                    # OAuth-Routen (Redirect, Callback)
  services/
    oauthService.js             # OIDC-Discovery, Token-Austausch, User-Matching
  config/
    encryption.js               # AES-256-GCM fuer Client-Secrets und Tokens
```

### Env-Variablen

| Variable | Required | Beschreibung |
|----------|----------|-------------|
| `OAUTH_ENCRYPTION_KEY` | Ja (wenn OAuth aktiv) | 32-Byte-Key fuer AES-256-GCM (base64-encoded) |
| `MICROSOFT_CLIENT_ID` | Nein | Shortcut: Wird in `oauth_providers` gespeichert |
| `MICROSOFT_CLIENT_SECRET` | Nein | Shortcut: Wird verschluesselt in `oauth_providers` gespeichert |
| `MICROSOFT_TENANT_ID` | Nein | `common` fuer Multi-Tenant, oder spezifische Tenant-ID |

### Route-Struktur

```
GET  /api/auth/providers                    # Liste aktiver OAuth-Provider (public)
GET  /api/auth/oauth/:providerKey           # Redirect zum IdP
GET  /api/auth/oauth/:providerKey/callback  # Callback vom IdP
POST /api/superadmin/oauth/providers        # Provider anlegen (superadmin)
PUT  /api/superadmin/oauth/providers/:id    # Provider bearbeiten (superadmin)
DELETE /api/superadmin/oauth/providers/:id  # Provider loeschen (superadmin)
GET  /api/superadmin/oauth/providers        # Provider auflisten (superadmin)
```

### OAuth-Flow im Detail

#### 4.1 Authorization Request

```js
// GET /api/auth/oauth/:providerKey
export async function initiateOAuth(req, res) {
    const provider = await getEnabledProvider(req.params.providerKey);
    if (!provider) return res.status(404).json({ error: 'Provider nicht gefunden' });

    const discovery = await fetchDiscovery(provider.discovery_url);
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

    // State + Code Verifier in httpOnly Cookie (kurzlebig, 10 Min)
    res.cookie('oauth_state', JSON.stringify({ state, codeVerifier, providerKey: provider.provider_key }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000,
        path: '/api/auth/oauth',
    });

    const params = new URLSearchParams({
        client_id: provider.client_id,
        response_type: 'code',
        redirect_uri: `${process.env.PUBLIC_BASE_URL}/api/auth/oauth/${provider.provider_key}/callback`,
        scope: provider.scopes,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    });

    res.redirect(`${discovery.authorization_endpoint}?${params}`);
}
```

#### 4.2 Callback und Token-Austausch

```js
// GET /api/auth/oauth/:providerKey/callback
export async function handleOAuthCallback(req, res) {
    const { code, state } = req.query;
    const stored = JSON.parse(req.cookies.oauth_state || '{}');

    // State validieren (CSRF-Schutz)
    if (!stored.state || stored.state !== state) {
        return res.redirect('/login?error=oauth_state_mismatch');
    }

    const provider = await getEnabledProvider(stored.providerKey);
    const discovery = await fetchDiscovery(provider.discovery_url);
    const clientSecret = decrypt(provider.client_secret_encrypted);

    // Authorization Code gegen Tokens tauschen
    const tokenResponse = await fetch(discovery.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: provider.client_id,
            client_secret: clientSecret,
            code,
            redirect_uri: `${process.env.PUBLIC_BASE_URL}/api/auth/oauth/${provider.provider_key}/callback`,
            code_verifier: stored.codeVerifier,
        }),
    });

    const tokens = await tokenResponse.json();
    // ID-Token validieren (Signatur, Audience, Issuer, Expiry)
    const claims = await validateIdToken(tokens.id_token, provider, discovery);

    // User-Matching
    const user = await matchOrCreateUser(claims, provider, tokens);

    // JWT-Cookie setzen (identisch zum normalen Login)
    const jwt = generateToken(user);
    res.cookie('token', jwt, cookieOptions);

    // OAuth-State-Cookie loeschen
    res.clearCookie('oauth_state', { path: '/api/auth/oauth' });

    // Refresh-Token speichern (fuer WebDAV)
    if (tokens.refresh_token) {
        await saveOAuthTokens(user.id, provider.id, tokens);
    }

    res.redirect('/teacher');
}
```

#### 4.3 User-Matching-Strategie

```
1. Pruefe oauth_user_links: Gibt es bereits eine Verknuepfung fuer (provider, sub)?
   → Ja: Login mit diesem User
   → Nein: Weiter zu 2

2. Pruefe users: Gibt es einen User mit passender E-Mail?
   → Ja: Verknuepfung automatisch erstellen, Login
   → Nein: Weiter zu 3

3. Auto-Provisioning (konfigurierbar):
   → Wenn aktiviert: Neuen User anlegen (role: teacher, kein Passwort)
   → Wenn deaktiviert: Fehler "Kein Konto gefunden"
```

**Sicherheitsregeln:**
- E-Mail muss `email_verified: true` im ID-Token haben (oder Provider vertraut E-Mails)
- Domain-Einschraenkung: Nur E-Mails aus `allowed_domains` werden akzeptiert
- Kein Auto-Provisioning fuer Admin/Superadmin-Rollen
- Bestehende Passwoerter werden nicht ueberschrieben

---

## 5. Frontend-Implementierung

### Neue/Geaenderte Dateien

```
src/
  pages/
    LoginPage.tsx               # OAuth-Buttons ergaenzen
  services/
    api.ts                      # Neue Methode: api.auth.getProviders()
  types/
    index.ts                    # OAuthProvider-Type
```

### LoginPage-Erweiterung

```tsx
// Zusaetzlich zu Username/Passwort-Formular:
{providers.map((p) => (
    <a
        key={p.providerKey}
        href={`${API_BASE}/auth/oauth/${p.providerKey}`}
        className="login-oauth-button"
    >
        {p.displayName}
    </a>
))}
```

**Wichtig:** Der OAuth-Flow ist ein Server-Side-Redirect, kein AJAX-Call. Der `<a>`-Tag navigiert direkt zum Backend.

### Neuer Type

```ts
// src/types/index.ts
export interface OAuthProvider {
    providerKey: string;
    displayName: string;
    iconUrl?: string;
}
```

### API-Client

```ts
// src/services/api.ts → api.auth
async getProviders(): Promise<OAuthProvider[]> {
    const res = await requestJSON('/auth/providers');
    return Array.isArray(res) ? res : [];
},
```

### Superadmin-UI: OAuth-Provider-Verwaltung

Neuer Tab im Superadmin-Panel: **"SSO / OAuth"**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| Provider-Key | Text (readonly nach Erstellung) | `microsoft`, `logineo`, `custom` |
| Anzeigename | Text | "Mit Microsoft anmelden" |
| Aktiv | Toggle | Provider aktivieren/deaktivieren |
| Client-ID | Text | Aus Azure Portal / IdP-Admin |
| Client-Secret | Password | Wird verschluesselt gespeichert |
| Discovery-URL | URL | OIDC Discovery Endpoint |
| Scopes | Text | Default: `openid profile email` |
| Erlaubte Domains | Text | Kommasepariert, leer = alle |
| Auto-Provisioning | Toggle | Neue User automatisch anlegen |
| E-Mail-Claim | Text | Default: `email` |
| Name-Claim | Text | Default: `name` |

---

## 6. Sicherheit

### PKCE (Proof Key for Code Exchange)

PKCE ist **Pflicht** fuer alle OAuth-Flows:
- `code_verifier`: 32 Bytes, base64url-encoded
- `code_challenge`: SHA-256 des Verifiers
- Verhindert Authorization Code Interception

### State-Parameter

- Zufaellig generiert (32 Bytes)
- In httpOnly Cookie gespeichert (nicht URL-Parameter)
- Verhindert CSRF bei OAuth-Callbacks

### Token-Verschluesselung

- Client-Secrets und Refresh-Tokens werden **nicht im Klartext** in der DB gespeichert
- AES-256-GCM mit `OAUTH_ENCRYPTION_KEY`
- Key-Rotation: Neuen Key setzen, alte Tokens re-verschluesseln (Migration)

### ID-Token-Validierung

1. Signatur pruefen (JWKS vom Discovery-Endpoint)
2. `iss` (Issuer) pruefen
3. `aud` (Audience) muss `client_id` sein
4. `exp` pruefen (nicht abgelaufen)
5. `nonce` pruefen (wenn verwendet)
6. `email_verified` pruefen (wenn vorhanden)

### Domain-Einschraenkung

- `oauth_providers.allowed_domains` beschraenkt erlaubte E-Mail-Domains
- Verhindert, dass sich beliebige Microsoft-User bei einer Schul-Instanz anmelden
- Beispiel: `bksb.de,schule.nrw.de`

---

## 7. Beziehung zum bestehenden Auth-System

### Parallelbetrieb

| Szenario | Verhalten |
|----------|-----------|
| User hat nur Passwort | Login ueber Username/Passwort wie bisher |
| User hat nur OAuth | Login ueber OAuth-Button, kein Passwort-Login moeglich |
| User hat beides | Beide Login-Wege funktionieren, selber JWT-Cookie |
| OAuth-User aendert Passwort | Setzt `password_hash`, beide Wege funktionieren |
| OAuth-Provider deaktiviert | Nur Passwort-Login, OAuth-Verknuepfung bleibt bestehen |

### Bestehende Features bleiben kompatibel

| Feature | Kompatibilitaet |
|---------|----------------|
| `force_password_change` | Nicht relevant fuer OAuth-only User |
| `token_version` | Funktioniert wie bisher (JWT aus Cookie) |
| Account Lockout | Nur fuer Passwort-Login relevant |
| Modul-Zugang (`user_module_access`) | Funktioniert wie bisher |
| Rollen-System | OAuth-User bekommen Rolle bei Auto-Provisioning oder manuell |

---

## 8. Beziehung zum WebDAV-Feature

OAuth-Integration ist **Voraussetzung** fuer die WebDAV-Anbindung an Schul-Cloudloesungen:

| Schritt | OAuth-Relevanz |
|---------|----------------|
| User meldet sich per OAuth an | Access-Token + Refresh-Token werden gespeichert |
| User laed Datei im Flow-Modul hoch | Backend nutzt gespeichertes Access-Token fuer WebDAV-PUT |
| Access-Token abgelaufen | Backend nutzt Refresh-Token fuer neues Access-Token |
| Refresh-Token abgelaufen | User wird aufgefordert, sich erneut per OAuth anzumelden |

Dafuer muessen bei der OAuth-Anmeldung **zusaetzliche Scopes** angefordert werden:
- Microsoft OneDrive: `Files.ReadWrite` (oder `Files.ReadWrite.All` fuer Shared Libraries)
- Logineo: Provider-spezifische Scopes

Die Scopes sind pro Provider in `oauth_providers.scopes` konfigurierbar.

---

## 9. Implementierungsreihenfolge

### Phase A: Basis-OAuth (Login)

| # | Aufgabe | Dateien | Abhaengigkeit |
|---|---------|---------|---------------|
| A.1 | Migration: `oauth_providers`, `oauth_user_links` | `backend/migrations/052_oauth.sql` | - |
| A.2 | `users.password_hash` nullable machen | `backend/migrations/052_oauth.sql` | - |
| A.3 | Encryption-Service (AES-256-GCM) | `backend/config/encryption.js` | `OAUTH_ENCRYPTION_KEY` env |
| A.4 | OIDC-Discovery + Token-Service | `backend/services/oauthService.js` | A.3 |
| A.5 | OAuth-Routen (Redirect, Callback) | `backend/routes/oauth.js` | A.1, A.4 |
| A.6 | User-Matching-Logik | `backend/services/oauthService.js` | A.1 |
| A.7 | OAuth-Routen in `index.js` mounten | `backend/index.js` | A.5 |
| A.8 | Frontend: `api.auth.getProviders()` | `src/services/api.ts` | A.5 |
| A.9 | Frontend: OAuth-Buttons auf LoginPage | `src/pages/LoginPage.tsx` | A.8 |
| A.10 | Frontend: OAuthProvider-Type | `src/types/index.ts` | A.8 |
| A.11 | `.env.example` erweitern | `.env.example` | - |

### Phase B: Superadmin-UI

| # | Aufgabe | Dateien | Abhaengigkeit |
|---|---------|---------|---------------|
| B.1 | Superadmin-API: Provider-CRUD | `backend/routes/superadmin.js` | A.1 |
| B.2 | Frontend: OAuth-Tab im Superadmin | `src/pages/SuperadminPage/OAuthTab.tsx` | B.1 |

### Phase C: Token-Persistenz fuer WebDAV

| # | Aufgabe | Dateien | Abhaengigkeit |
|---|---------|---------|---------------|
| C.1 | Refresh-Token speichern bei OAuth-Login | `backend/routes/oauth.js` | A.5 |
| C.2 | Token-Refresh-Service | `backend/services/oauthService.js` | C.1 |
| C.3 | WebDAV-Integration nutzt gespeicherte Tokens | Siehe `webdav-integration.md` | C.2 |

---

## 10. DSGVO-Aspekte

| Aspekt | Massnahme |
|--------|-----------|
| Datenminimierung | Nur `email`, `name`, `sub` aus dem ID-Token verwendet |
| Speicherung | Client-Secrets und Tokens AES-256-GCM verschluesselt |
| Transparenz | Datenschutzseite informiert ueber OAuth-Datenverarbeitung |
| Loeschung | Bei User-Loeschung werden `oauth_user_links` kaskadiert geloescht |
| Auftragsverarbeitung | Identity Provider ist kein Auftragsverarbeiter (Schule = Verantwortlicher) |
| Drittlandtransfer | Microsoft: EU-Rechenzentren, aber US-Jurisdiktion – in Datenschutzerklaerung erwaehnen |
| Consent | Kein separater Consent noetig (Rechtsgrundlage: Vertragserfuellung Art. 6(1)(b)) |

---

## 11. Testplan

| # | Testfall | Erwartetes Ergebnis |
|---|---------|---------------------|
| 1 | OAuth-Login mit gueltigem Microsoft-Konto | Redirect → Microsoft → Callback → JWT-Cookie → Dashboard |
| 2 | OAuth-Login mit nicht-verknuepftem Konto (Auto-Provisioning an) | Neuer User wird angelegt, Login erfolgreich |
| 3 | OAuth-Login mit nicht-verknuepftem Konto (Auto-Provisioning aus) | Fehlermeldung "Kein Konto gefunden" |
| 4 | OAuth-Login mit gesperrtem Konto | Login abgelehnt (Account Lockout) |
| 5 | OAuth-Login mit nicht-erlaubter Domain | Login abgelehnt |
| 6 | State-Mismatch (CSRF-Angriff) | Login abgelehnt |
| 7 | Abgelaufener Authorization Code | Fehlermeldung |
| 8 | Provider deaktiviert | OAuth-Button nicht sichtbar |
| 9 | Paralleler Login (Passwort + OAuth) | Beide Wege funktionieren |
| 10 | Token-Refresh (fuer WebDAV) | Neues Access-Token ohne User-Interaktion |

---

## 12. Referenzen

| Dokument | Pfad |
|----------|------|
| Docker Roadmap (Phase 8) | `docs/planning/docker-roadmap.md` |
| WebDAV-Integration | `docs/planning/webdav-integration.md` |
| Security Baseline | `docs/security/security-baseline.md` |
| Auth-Middleware | `backend/middleware/auth.js` |
| Auth-Routen | `backend/routes/auth.js` |
| Flow DB-Schema | `docs/planning/flow/01-datenbank-schema.md` |
| DSGVO-Anforderungen | `docs/compliance/dsgvo-anforderungen.md` |
