# DSAR-Endpunkte – Betroffenenrechte (Art. 15-21 DSGVO)

> API-Referenz fuer Data Subject Access Requests (DSAR) und Audit-Logging.
> Alle Endpunkte erfordern `requireSuperadmin`-Authentifizierung.

**Backend-Datei:** `backend/routes/admin/dataSubject.js`
**Frontend-Tab:** `src/pages/SuperadminPage/DataProtectionTab.tsx`
**API-Client:** `api.dataSubject.*` in `src/services/api.ts`

---

## Endpunkte

### GET /api/admin/data-subject/search?email=

**Art. 15 DSGVO – Datenauskunft**

Durchsucht alle PII-Tabellen nach der angegebenen E-Mail-Adresse.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `email` | Query | Ja | E-Mail-Adresse der betroffenen Person |

**Durchsuchte Tabellen:** `teachers`, `users`, `booking_requests`, `slots`, `ssw_appointments`, `bl_appointments`, `consent_receipts`

**Antwort:**
```json
{
  "email": "person@example.com",
  "total_records": 5,
  "data": {
    "booking_requests": [{ "id": 1, "parent_name": "...", ... }],
    "slots": [{ "id": 2, ... }]
  }
}
```

---

### GET /api/admin/data-subject/export?email=&format=json|csv

**Art. 15 + Art. 20 DSGVO – Datenexport / Datenuebertragbarkeit**

Exportiert alle PII als Download-Datei.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `email` | Query | Ja | E-Mail-Adresse |
| `format` | Query | Nein | `json` (Standard) oder `csv` |

**Antwort:** Datei-Download mit `Content-Disposition`-Header.

---

### DELETE /api/admin/data-subject?email=

**Art. 17 DSGVO – Recht auf Loeschung (Anonymisierung)**

Anonymisiert alle personenbezogenen Daten in einer Transaktion. Setzt PII-Felder auf `NULL` (Name, E-Mail, Telefon, Nachricht). Strukturdaten (Termin-Zeitfenster, Status) bleiben erhalten.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `email` | Query | Ja | E-Mail-Adresse |

**Betroffene Tabellen:** `booking_requests`, `slots`, `ssw_appointments`, `bl_appointments`

**Antwort:**
```json
{
  "message": "4 Datensaetze anonymisiert",
  "protocol": {
    "email": "person@example.com",
    "timestamp": "2026-03-17T...",
    "actions": [
      { "table": "booking_requests", "anonymized": 2, "ids": [1, 2] },
      { "table": "slots", "anonymized": 2, "ids": [5, 6] }
    ]
  }
}
```

**Sicherheit:** Transaktion (BEGIN/COMMIT/ROLLBACK). Bei Fehler: Rollback, keine Teildaten anonymisiert.

---

### PATCH /api/admin/data-subject?email=

**Art. 16 DSGVO – Recht auf Berichtigung**

Korrigiert Felder ueber alle Tabellen hinweg in einer Transaktion.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `email` | Query | Ja | E-Mail-Adresse |
| `corrections` | Body (JSON) | Ja | Objekt mit Feldname-Wert-Paaren |

**Erlaubte Felder pro Tabelle:**

| Tabelle | Felder |
|---------|--------|
| `booking_requests` | `parent_name`, `student_name`, `company_name`, `trainee_name`, `representative_name`, `email`, `class_name` |
| `slots` | `parent_name`, `student_name`, `company_name`, `trainee_name`, `representative_name`, `email`, `class_name` |
| `ssw_appointments` | `student_name`, `student_class`, `email`, `phone` |
| `bl_appointments` | `student_name`, `student_class`, `email`, `phone` |
| `teachers` | `name`, `email`, `subject` |

**Request-Body:**
```json
{
  "corrections": {
    "parent_name": "Neuer Name",
    "email": "neue@email.com"
  }
}
```

**Sicherheit:** SQL-Identifier-Validierung via `assertSafeIdentifier()`. Transaktion (BEGIN/COMMIT/ROLLBACK).

---

### POST /api/admin/data-subject/restrict?email=

**Art. 18 DSGVO – Verarbeitungseinschraenkung**

Setzt oder hebt das `restricted`-Flag auf allen relevanten Tabellen.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `email` | Query | Ja | E-Mail-Adresse |
| `restricted` | Body (JSON) | Nein | `true` (Standard) oder `false` |

**Betroffene Tabellen:** `booking_requests`, `ssw_appointments`, `bl_appointments`

**Auswirkung:** Eingeschraenkte Datensaetze erscheinen nicht in normalen Admin-Listen (`WHERE restricted IS NOT TRUE`). Superadmin sieht alle Daten.

---

## Audit-Log-Endpunkte

### GET /api/admin/audit-log?from=&to=&action=&table=&page=&limit=

Paginierte Audit-Log-Abfrage mit Filterung.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `from` | Query | Nein | Startdatum (ISO 8601) |
| `to` | Query | Nein | Enddatum (ISO 8601) |
| `action` | Query | Nein | Filter: `READ`, `WRITE`, `DELETE`, `EXPORT`, `RESTRICT`, `LOGIN_FAIL`, `ACCESS_DENIED` |
| `table` | Query | Nein | Filter: `data_subject`, `security`, `audit_log`, `booking_requests`, `slots`, `ssw_appointments`, `bl_appointments`, `teachers`, `users` |
| `page` | Query | Nein | Seitennummer (Standard: 1) |
| `limit` | Query | Nein | Eintraege pro Seite (Standard: 50, Max: 200) |

**Antwort:**
```json
{
  "entries": [
    {
      "id": 1,
      "user_id": 5,
      "user_name": "Admin",
      "action": "READ",
      "table_name": "data_subject",
      "record_id": null,
      "details": { "email": "person@example.com" },
      "ip_address": "192.168.1.1",
      "created_at": "2026-03-17T..."
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 120, "pages": 3 }
}
```

---

### GET /api/admin/audit-log/export?from=&to=&format=csv

Audit-Log-Export fuer Behoerdenanfragen.

| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `from` | Query | Nein | Startdatum (ISO 8601) |
| `to` | Query | Nein | Enddatum (ISO 8601) |
| `format` | Query | Nein | `csv` (Standard) oder `json` |

**Sicherheitslimit:** Maximal 10.000 Eintraege pro Export. Bei Ueberschreitung: `truncated: true` im Response.

---

## Audit-Events

Automatisch protokollierte Events:

| Action | Ausloeser | Tabelle |
|--------|-----------|---------|
| `READ` | Personendaten-Suche | `data_subject` |
| `EXPORT` | Daten- oder Audit-Log-Export | `data_subject`, `audit_log` |
| `DELETE` | Anonymisierung | `data_subject` |
| `WRITE` | Datenberichtigung | `data_subject` |
| `RESTRICT` | Verarbeitungseinschraenkung | `data_subject` |
| `LOGIN_FAIL` | Fehlgeschlagener Login | `security` |
| `ACCESS_DENIED` | 403-Zugriffsverweigerung | `security` |

---

## Frontend: Datenschutz-Tab

Der Tab "Datenschutz" in der Superadmin-Oberflaeche (`/superadmin`) bietet:

1. **E-Mail-Suche** – Personenbezogene Daten ueber alle Tabellen suchen
2. **Ergebnisanzeige** – Aufklappbare Tabellen pro Datenquelle
3. **Aktionen** – Export (JSON/CSV), Loeschung, Berichtigung, Einschraenkung
4. **Berichtigungsformular** – Modal mit editierbaren Feldern
5. **Audit-Log-Viewer** – Paginierte Tabelle mit Filter nach Aktion und Tabelle
6. **Audit-Log-Export** – CSV-Download fuer Behoerdenanfragen

**API-Client-Methoden** (`src/services/api.ts`):
- `api.dataSubject.search(email)`
- `api.dataSubject.exportData(email, format)`
- `api.dataSubject.deleteData(email)`
- `api.dataSubject.correctData(email, corrections)`
- `api.dataSubject.restrict(email, restricted)`
- `api.dataSubject.getAuditLog(filter)`
- `api.dataSubject.exportAuditLog(filter)`
