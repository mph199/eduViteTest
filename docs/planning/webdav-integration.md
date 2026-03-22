# WebDAV-Integration – Planungsdokument

> **Stand:** 2026-03-21
> **Status:** Planung (noch nicht implementiert)
> **Bezug:** `oauth-integration.md` (OAuth ist Voraussetzung), `flow/01-datenbank-schema.md` (flow_datei-Tabelle)
> **Ziel:** Lehrkraefte koennen Dateien aus ihrer Schul-Cloud (OneDrive, Logineo, Open-Xchange) direkt in Flow-Arbeitspakete einbinden – ohne lokalen Upload.

---

## 1. Uebersicht

### Warum WebDAV?

| Treiber | Details |
|---------|---------|
| Kein lokaler Datei-Storage | eduVite speichert keine Dateien lokal – bewusste Designentscheidung (DSGVO, Betrieb) |
| Schulen haben Cloud-Speicher | OneDrive (MS365 Education), Logineo NRW Dateien, Open-Xchange (OX Drive) |
| Einheitliches Protokoll | WebDAV wird von allen drei Zielplattformen unterstuetzt |
| Vermeidung proprietaerer APIs | Graph API (MS), OX HTTP API, Logineo REST – WebDAV ist der gemeinsame Nenner |
| DSGVO: Datenminimierung | Dateien verbleiben beim Schultraeger, eduVite speichert nur Metadaten + Link |

### Architektur-Ueberblick

```
Browser (Flow-Modul)
  |  1. User klickt "Datei aus Cloud verknuepfen"
  |  2. Request an eduVite-Backend mit Pfad/Suche
  v
[eduVite Backend]
  |  3. OAuth Access-Token aus oauth_user_links laden
  |  4. WebDAV PROPFIND/GET an Cloud-Provider
  v
[Cloud-Provider] (OneDrive / Logineo / OX)
  |  5. Dateiliste oder Datei-Inhalt zurueck
  v
[eduVite Backend]
  |  6. Metadaten in flow_datei speichern (external_url)
  |  7. Dateiliste an Frontend zurueck
  v
[Browser]
  |  8. Datei-Picker zeigt Cloud-Inhalt
  |  9. Verknuepfte Datei erscheint im Arbeitspaket
```

---

## 2. Voraussetzungen

| # | Voraussetzung | Status | Dokument |
|---|---------------|--------|----------|
| 1 | OAuth-Integration implementiert | Ausstehend | `oauth-integration.md` |
| 2 | `oauth_user_links`-Tabelle mit Access/Refresh-Token | Ausstehend | `oauth-integration.md` Abschnitt 4 |
| 3 | Token-Refresh-Mechanismus (Backend) | Ausstehend | `oauth-integration.md` Abschnitt 6 |
| 4 | `flow_datei`-Tabelle mit `external_url`-Feld | Implementiert | Migration 049 |
| 5 | Flow-Modul Backend + Frontend | Implementiert | `flow/01-06` |

---

## 3. Unterstuetzte Cloud-Provider

### Phase 1: Microsoft OneDrive (MS365 Education)

| Parameter | Wert |
|-----------|------|
| WebDAV-Endpunkt | `https://{tenant}-my.sharepoint.com/personal/{user}/Documents` |
| Auth | OAuth 2.0 Bearer Token (Microsoft Entra ID) |
| Scope | `Files.ReadWrite` |
| Besonderheit | MS empfiehlt Graph API; WebDAV funktioniert aber ueber SharePoint-Endpunkt |
| Fallback | Graph API (`/me/drive/root/children`) falls WebDAV-Performance unzureichend |

### Phase 2: Logineo NRW Dateien

| Parameter | Wert |
|-----------|------|
| WebDAV-Endpunkt | `https://logineo.schulministerium.nrw.de/remote.php/dav/files/{username}/` |
| Auth | OAuth 2.0 Bearer Token (Logineo OIDC) |
| Scope | Noch zu klaeren (Logineo-Dokumentation) |
| Besonderheit | Nextcloud-basiert, WebDAV ist nativer Zugangsweg |

### Phase 3: Open-Xchange (OX Drive)

| Parameter | Wert |
|-----------|------|
| WebDAV-Endpunkt | `https://{ox-host}/servlet/webdav.infostore/` |
| Auth | OAuth 2.0 oder Session-basiert |
| Besonderheit | Verbreitet bei kommunalen Schultraegern |

---

## 4. Datenmodell

### Bestehend: `flow_datei` (Migration 049)

```sql
CREATE TABLE IF NOT EXISTS flow_datei (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,            -- Anzeigename
    original_name VARCHAR(500),            -- Originaler Dateiname
    mime_type VARCHAR(100),
    groesse INTEGER,                       -- Bytes
    hochgeladen_von INTEGER REFERENCES users(id) ON DELETE SET NULL,
    external_url TEXT,                     -- WebDAV-URL zur Datei
    arbeitspaket_id INTEGER NOT NULL REFERENCES flow_arbeitspaket(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Erweiterung (geplant)

```sql
-- Migration XXX: WebDAV-Erweiterung fuer flow_datei
ALTER TABLE flow_datei ADD COLUMN IF NOT EXISTS provider VARCHAR(50);
  -- 'onedrive', 'logineo', 'ox', 'manual'
ALTER TABLE flow_datei ADD COLUMN IF NOT EXISTS cloud_path TEXT;
  -- Originaler Pfad im Cloud-Storage (fuer Sync/Refresh)
ALTER TABLE flow_datei ADD COLUMN IF NOT EXISTS cloud_etag VARCHAR(255);
  -- ETag fuer Aenderungserkennung
ALTER TABLE flow_datei ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
  -- Letzter erfolgreicher Metadaten-Abgleich
```

---

## 5. Backend-Architektur

### Neuer Service: `backend/modules/flow/services/webdavService.js`

```
webdavService
  ├── listFiles(userId, provider, path)      -- PROPFIND: Verzeichnis auflisten
  ├── getFileInfo(userId, provider, path)     -- PROPFIND depth=0: Einzeldatei-Metadaten
  ├── linkFile(paketId, userId, provider, cloudPath)  -- Verknuepfung erstellen
  └── refreshMetadata(dateiId)               -- ETag/Groesse aktualisieren
```

### Neuer Router: `backend/modules/flow/routes/webdav.js`

| Method | Pfad | Auth | Beschreibung |
|--------|------|------|-------------|
| GET | `/api/flow/webdav/files` | JWT + Flow-Zugang | Cloud-Verzeichnis auflisten |
| GET | `/api/flow/webdav/files/info` | JWT + Flow-Zugang | Einzeldatei-Metadaten |
| POST | `/api/flow/arbeitspakete/:id/dateien/link` | JWT + Paket-Mitglied | Datei verknuepfen |
| POST | `/api/flow/dateien/:id/refresh` | JWT + Paket-Mitglied | Metadaten aktualisieren |

### WebDAV-Client

```javascript
// Beispiel: PROPFIND mit OAuth-Token
import { createClient } from 'webdav';

async function getWebdavClient(userId, provider) {
    const tokenRecord = await getOAuthToken(userId, provider);
    if (!tokenRecord) throw new Error('Kein OAuth-Token vorhanden');

    // Token refreshen falls abgelaufen
    const accessToken = await ensureFreshToken(tokenRecord);

    return createClient(getWebdavEndpoint(provider), {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
}
```

### Token-Verwaltung

1. Access-Token aus `oauth_user_links` laden
2. Falls abgelaufen: Refresh-Token nutzen (via OAuth-Service)
3. Falls Refresh fehlschlaegt: User muss sich neu authentifizieren
4. Token-Verschluesselung: AES-256-GCM (wie in `oauth-integration.md` Abschnitt 7)

---

## 6. Frontend-Architektur

### Neue Komponente: `CloudDateiPicker`

```
src/modules/flow/components/
  └── CloudDateiPicker.tsx    -- Modal/Drawer zum Durchsuchen der Cloud
```

**Verhalten:**
1. User klickt "Datei aus Cloud verknuepfen" im Arbeitspaket
2. Modal oeffnet sich mit Verzeichnisbaum des verbundenen Cloud-Speichers
3. User navigiert und waehlt Datei(en) aus
4. Backend erstellt `flow_datei`-Eintraege mit `external_url` und `provider`
5. Arbeitspaket-Dateien-Liste aktualisiert sich

### Neue API-Methoden in `src/services/api.ts`

```typescript
// api.flow.webdav
listCloudFiles(provider: string, path?: string): Promise<CloudFile[]>
getCloudFileInfo(provider: string, path: string): Promise<CloudFile>
linkCloudFile(paketId: number, data: LinkCloudFileRequest): Promise<FlowDatei>
refreshDateiMetadata(dateiId: number): Promise<FlowDatei>
```

### Neue Typen in `src/types/index.ts`

```typescript
interface CloudFile {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    mimeType?: string;
    lastModified?: string;
    etag?: string;
}

interface LinkCloudFileRequest {
    provider: string;
    cloudPath: string;
    name: string;
    mimeType?: string;
    groesse?: number;
}

type CloudProvider = 'onedrive' | 'logineo' | 'ox';
```

---

## 7. Sicherheit

| # | Aspekt | Massnahme |
|---|--------|-----------|
| 1 | Token-Speicherung | AES-256-GCM verschluesselt in DB (siehe oauth-integration.md) |
| 2 | Token-Scope | Minimaler Scope (`Files.ReadWrite` fuer OneDrive) |
| 3 | SSRF-Praevention | WebDAV-Endpunkte per Allowlist (nur konfigurierte Provider) |
| 4 | Path Traversal | Cloud-Pfade validieren, kein `../` erlauben |
| 5 | Rate Limiting | WebDAV-Proxy-Endpunkte rate-limited (10 req/min pro User) |
| 6 | DSGVO | Dateien verbleiben beim Cloud-Provider, nur Metadaten in eduVite |
| 7 | Logging | Alle WebDAV-Zugriffe im Audit-Log (wer, wann, welche Datei) |
| 8 | Consent | User muss Cloud-Verbindung explizit autorisieren (OAuth-Flow) |

---

## 8. DSGVO-Implikationen

| Aspekt | Bewertung |
|--------|-----------|
| Datenminimierung | Erfuellt: Nur Metadaten (Name, URL, Groesse) werden gespeichert |
| Speicherort | Dateien verbleiben beim Schultraeger (OneDrive/Logineo = AV-Vertrag der Schule) |
| Loeschkonzept | `flow_datei`-Eintrag loeschen entfernt nur Verknuepfung, nicht die Cloud-Datei |
| Auskunftsrecht | `flow_datei`-Eintraege mit `hochgeladen_von` sind dem User zuordenbar |
| Auftragsverarbeitung | eduVite ist Auftragsverarbeiter; Cloud-Zugriff erfolgt mit Token des Users (Delegation) |

---

## 9. Implementierungsreihenfolge

| Phase | Aufgabe | Abhaengigkeit |
|-------|---------|---------------|
| 0 | OAuth-Integration implementieren | -- |
| 1 | WebDAV-Service (Backend): `webdavService.js` | Phase 0 |
| 2 | WebDAV-Routes (Backend): `webdav.js` | Phase 1 |
| 3 | DB-Migration: Provider/ETag-Felder | -- |
| 4 | API-Client-Erweiterung (Frontend) | Phase 2 |
| 5 | CloudDateiPicker-Komponente | Phase 4 |
| 6 | Integration in ArbeitspaketPage | Phase 5 |
| 7 | OneDrive-Anbindung testen | Phase 6 |
| 8 | Logineo-Anbindung testen | Phase 6 |

---

## 10. Offene Fragen

| # | Frage | Prioritaet |
|---|-------|-----------|
| 1 | Logineo OIDC-Scopes fuer Dateizugriff? (Dokumentation pruefen) | Hoch |
| 2 | OneDrive: WebDAV vs. Graph API Performance-Vergleich? | Mittel |
| 3 | Offline-Zugriff auf verknuepfte Dateien noetig? (Caching) | Niedrig |
| 4 | Bidirektionale Sync (Aenderungen in eduVite → Cloud)? | Niedrig |
| 5 | Maximale Dateigroesse fuer Vorschau/Download-Proxy? | Mittel |
| 6 | Sollen Dateien auch von der Cloud nach eduVite kopiert werden koennen? | Niedrig |

---

## 11. NPM-Abhaengigkeiten (geplant)

| Paket | Version | Zweck |
|-------|---------|-------|
| `webdav` | ^5.x | WebDAV-Client (PROPFIND, GET, PUT) |

Keine weiteren Abhaengigkeiten noetig – OAuth-Handling ueber bestehenden `oauth-integration`-Stack.

---

## 12. Referenzen

| Dokument | Pfad |
|----------|------|
| OAuth-Integration | `docs/planning/oauth-integration.md` |
| Flow DB-Schema | `docs/planning/flow/01-datenbank-schema.md` |
| Flow Backend API | `docs/planning/flow/03-backend-api-routes.md` |
| Docker Roadmap Phase 8 | `docs/planning/docker-roadmap.md` |
| DSGVO-Anforderungen | `docs/compliance/dsgvo-anforderungen.md` |
| Security Baseline | `docs/security/security-baseline.md` |
