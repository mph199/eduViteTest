# Kalender-Abo (ICS) für Lehrkräfte

> Status: Geplant | Erstellt: 2026-03-24

## Ziel

Jede Lehrkraft erhält eine persönliche, Token-geschützte URL, über die sie ihre bestätigten Elternsprechtag-Termine als ICS-Kalender-Abo in Outlook, Apple Calendar, Google Calendar etc. abonnieren kann. Kein anderer User kann den Kalender eines anderen abonnieren.

## Architekturentscheidungen

| Entscheidung | Begründung |
|---|---|
| Token in URL statt JWT-Cookie | Kalender-Clients können keine Cookies/Header senden |
| Spalte an `teachers` statt eigene Tabelle | 1:1-Beziehung, kein Overhead |
| Server-seitiger ICS-Generator | Frontend-Code (`icalExport.ts`) nutzt DOM-APIs, nicht portierbar |
| URL im Frontend zusammensetzen | `window.location.origin` — kein `APP_URL` im Backend nötig |
| GET gibt Token-Wert **nicht** zurück | XSS-Schutz: Token nur bei POST (Generierung) einmalig sichtbar |
| Nur `status = 'confirmed'` im Feed | Reservierte Slots sind noch nicht endgültig |

## Dateien

| # | Datei | Aktion |
|---|-------|--------|
| 1 | `backend/migrations/056_calendar_tokens.sql` | create |
| 2 | `backend/modules/elternsprechtag/utils/icalGenerator.js` | create |
| 3 | `backend/modules/elternsprechtag/routes/calendar.js` | create |
| 4 | `backend/modules/elternsprechtag/routes/teacher/calendarToken.js` | create |
| 5 | `backend/modules/elternsprechtag/routes/teacher.js` | modify |
| 6 | `backend/modules/elternsprechtag/index.js` | modify |
| 7 | `src/types/index.ts` | modify |
| 8 | `src/services/api.ts` | modify |
| 9 | `src/modules/elternsprechtag/components/CalendarSubscription.tsx` | create |
| 10 | `src/modules/elternsprechtag/components/CalendarSubscription.css` | create |
| 11 | `src/modules/elternsprechtag/pages/teacher/TeacherBookings.tsx` | modify |

## Migration

```sql
-- 056_calendar_tokens.sql

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS calendar_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS calendar_token_created_at TIMESTAMPTZ;

-- Benannter Constraint (idempotent)
DO $$ BEGIN
  ALTER TABLE teachers
    ADD CONSTRAINT teachers_calendar_token_unique UNIQUE (calendar_token);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index für schnellen Token-Lookup (public Route, kein Auth)
CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_calendar_token
  ON teachers (calendar_token)
  WHERE calendar_token IS NOT NULL;
```

## API-Verträge

### Public (Token-Auth, kein Cookie)

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/calendar/:token/elternsprechtag.ics` | `text/calendar` oder `404` |

Header:
```
Content-Type: text/calendar; charset=utf-8
Content-Disposition: attachment; filename="elternsprechtag.ics"
Cache-Control: no-store, max-age=0
Pragma: no-cache
X-Robots-Tag: noindex
```

### Geschützt (JWT Cookie, requireTeacher)

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/teacher/calendar-token` | `{ exists: boolean, createdAt: string \| null }` |
| POST | `/api/teacher/calendar-token` | `{ token: string, createdAt: string }` |
| DELETE | `/api/teacher/calendar-token` | `{ success: true }` |

**Wichtig:** GET gibt den Token-Wert **nicht** zurück (XSS-Schutz). Der Token wird nur einmalig bei POST angezeigt. Die vollständige Abo-URL wird im Frontend zusammengesetzt:

```
${window.location.origin}/api/calendar/${token}/elternsprechtag.ics
```

## Token-Sicherheit

| Aspekt | Maßnahme |
|--------|----------|
| Entropie | `crypto.randomBytes(32)` = 256 Bit, 64 Hex-Zeichen |
| Binding | Token gehört exklusiv zu einem Teacher (UNIQUE-Constraint) |
| Widerruf | DELETE setzt NULL — alter Token liefert sofort 404 |
| Rate Limiting | `rateLimiters.booking` auf public Route |
| Enumeration | 404 bei falschem Token (kein Unterschied zu "nicht gefunden") |
| Indexierung | `X-Robots-Tag: noindex` |
| Cache | `no-store` + `Pragma: no-cache` (auch für ältere Outlook-Versionen) |
| Token-Rotation | POST erzeugt neues Token, altes wird sofort ungültig |

## ICS-Generator (Server-seitig)

Port von `src/utils/icalExport.ts` — nur reine Generierungsfunktionen:

- `generateTeacherICS(slots, teacherName, teacherRoom, eventName)` → `string`
- `escapeICalText(text)` — Sonderzeichen escapen
- `foldICalLine(line)` — RFC-5545 Line-Folding (75 Byte)
- `formatICalDateLocal(dateStr, timeStr)` — Lokale Zeitformatierung
- `getCurrentTimestamp()` — UTC-Timestamp für DTSTAMP

**Kein** `alert()`, `downloadICalFile()`, `TextEncoder` oder DOM-Code.

Nutzt `Buffer.byteLength()` statt `TextEncoder` für Byte-Zählung.

## Slot-Query

```sql
SELECT s.*, t.first_name, t.last_name, t.room
FROM slots s
JOIN teachers t ON t.id = s.teacher_id
WHERE t.calendar_token = $1
  AND s.booked = true
  AND (s.status = 'confirmed' OR s.status IS NULL)
ORDER BY s.date, s.time
```

`status IS NULL` fängt Legacy-Daten vor Migration 007 ab.

## Route-Registrierung

**Reihenfolge kritisch** — Calendar-Router **vor** publicRouter registrieren:

```js
// In backend/modules/elternsprechtag/index.js
app.use('/api/calendar', rateLimiters.booking);    // Rate Limit zuerst
app.use('/api/calendar', calendarRouter);           // Dann Router
// ... danach bestehende Routes
app.use('/api', publicRouter);
```

## Frontend-Komponente

`CalendarSubscription.tsx` — eingebettet in `TeacherBookings.tsx`:

**Zustände:**
1. **Kein Token:** Button "Kalender-Abo erstellen"
2. **Token vorhanden:** Abo-URL (readonly Input) + "Kopieren" + "URL erneuern" + "Abo deaktivieren"
3. **Nach POST:** URL einmalig anzeigen mit Hinweis "URL jetzt kopieren"

**Pflicht-DSGVO-Hinweis in der UI:**
> "Diese URL enthält personenbezogene Daten (Namen, Klassen). Binden Sie die URL nur in Ihren privaten Kalender ein und teilen Sie sie nicht mit Dritten."

**webcal://-Link:** Zusätzlich als Alternative anbieten — manche Clients (Apple Calendar, Outlook Desktop) öffnen damit direkt den Abo-Dialog.

**Erneuerungs-Warnung:**
> "Die alte URL wird ungültig. Alle bestehenden Kalender-Abos müssen neu eingerichtet werden."

## Implementierungsreihenfolge

1. Migration (`056_calendar_tokens.sql`)
2. ICS-Generator (`icalGenerator.js`)
3. Public Calendar-Route (`routes/calendar.js`)
4. Token-Management-Routes (`routes/teacher/calendarToken.js`)
5. Route-Registrierung (`teacher.js`, `index.js`)
6. Frontend-Types + API (`types/index.ts`, `api.ts`)
7. UI-Komponente (`CalendarSubscription.tsx` + CSS)
8. Integration in TeacherBookings

## DSGVO-Hinweise

- ICS-Response enthält Klarnamen (Eltern, Schüler, Klasse) — personenbezogene Daten
- Token-URL = Bearer-Token — wer den Link kennt, sieht alle Termine
- Pflichthinweis in der UI vor Token-Erstellung
- `Cache-Control: no-store` verhindert Proxy-Caching
- Token-Widerruf über DELETE jederzeit möglich
- Empfehlung: Token-Ablauf nach 12 Monaten (spätere Erweiterung über `calendar_token_created_at`)

## Erweiterbarkeit

Der URL-Pfad `/api/calendar/:token/<modul>.ics` erlaubt spätere Module:
- `/api/calendar/:token/schulsozialarbeit.ics`
- `/api/calendar/:token/beratungslehrer.ics`

Vorerst wird der ICS-Generator Elternsprechtag-spezifisch implementiert. Generische Abstraktion erst bei tatsächlichem Bedarf.

## Prüfer-Befunde (eingearbeitet)

| # | Schweregrad | Befund | Lösung |
|---|-------------|--------|--------|
| 1 | Hoch | Migration ohne `IF NOT EXISTS` | Behoben: `ADD COLUMN IF NOT EXISTS` |
| 2 | Hoch | UNIQUE-Constraint ohne Name | Behoben: benannter Constraint mit Exception-Handler |
| 3 | Hoch | Route-Reihenfolge in index.js | Behoben: Calendar-Router vor publicRouter |
| 4 | Hoch | DSGVO-Hinweis fehlt | Behoben: Pflichthinweis in UI-Komponente |
| 5 | Mittel | `Pragma: no-cache` fehlt | Behoben: Header ergänzt |
| 6 | Mittel | Browser-APIs im Server-Port | Behoben: nur reine Funktionen portieren |
| 7 | Mittel | Token im GET sichtbar (XSS-Risiko) | Behoben: GET gibt nur `exists` + `createdAt` zurück |
| 8 | Mittel | Route-Kollision mit publicRouter | Behoben: Registrierungsreihenfolge dokumentiert |
| 9 | Niedrig | APP_URL als neue Env-Variable | Vermieden: URL im Frontend zusammensetzen |
| 10 | Niedrig | Legacy-Slots ohne Status | Behoben: `status IS NULL` in Query |
