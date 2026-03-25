# Kalender-Abo (ICS) für Lehrkräfte

> Status: Geplant | Erstellt: 2026-03-24 | Review: 2026-03-24

## Ziel

Jede Lehrkraft erhält eine persönliche, Token-geschützte URL, über die ihre bestätigten Elternsprechtag-Termine als ICS-Kalender-Abo in Outlook, Apple Calendar, Google Calendar etc. abonnieren kann. Kein anderer User kann den Kalender eines anderen abonnieren.

## Architekturentscheidungen

| Entscheidung | Begründung |
|---|---|
| Token in URL statt JWT-Cookie | Kalender-Clients können keine Cookies/Header senden |
| Token gehasht in DB (SHA-256) | DB-Leak kompromittiert nicht die Feed-URLs |
| Spalte an `teachers` statt eigene Tabelle | 1:1-Beziehung, kein Overhead (Auslagerung dokumentiert für v2) |
| Server-seitiger ICS-Generator | Frontend-Code (`icalExport.ts`) nutzt DOM-APIs, nicht portierbar |
| URL im Frontend zusammensetzen | `window.location.origin` — kein `APP_URL` im Backend nötig |
| Token einmalig sichtbar | GET gibt Token nie zurück — nur bei POST/rotate einmalig angezeigt |
| Nur `status = 'confirmed'` im Feed | Reservierte Slots sind noch nicht endgültig |
| Datensparsamkeit im ICS-Inhalt | Kürzel statt voller Klarnamen im Event-Titel |
| Automatischer Ablauf nach 12 Monaten | Pflicht, nicht optional — reduziert Dauer-Risiko |

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
  ADD COLUMN IF NOT EXISTS calendar_token_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS calendar_token_created_at TIMESTAMPTZ;

-- Partieller Unique-Index: schneller Lookup + Uniqueness in einem
-- Kein separater UNIQUE-Constraint nötig (wäre doppelt)
CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_calendar_token_hash
  ON teachers (calendar_token_hash)
  WHERE calendar_token_hash IS NOT NULL;
```

**Änderung gegenüber v1:** Spalte heißt `calendar_token_hash` (nicht `calendar_token`). Gespeichert wird nur der SHA-256-Hash. Kein zusätzlicher UNIQUE-Constraint — der partielle Index reicht.

## Token-Lifecycle

### Hashing

```js
import crypto from 'crypto';

// Token generieren (wird an Lehrkraft ausgegeben)
const rawToken = crypto.randomBytes(32).toString('hex'); // 64 Hex-Zeichen

// Hash für DB-Speicherung
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

// Feed-Request: eingehenden Token hashen und per Hash suchen
const lookupHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
// SELECT ... FROM teachers WHERE calendar_token_hash = $1
```

### API-Semantik (klar getrennt)

| Method | Path | Verhalten | Response |
|---|---|---|---|
| GET | `/api/teacher/calendar-token` | Status abfragen | `{ exists, createdAt, expiresAt, isExpired }` |
| POST | `/api/teacher/calendar-token` | Erstellt Token. **409 nur wenn aktives (nicht abgelaufenes) Token existiert.** | `{ token, createdAt, expiresAt }` |
| POST | `/api/teacher/calendar-token/rotate` | Rotiert: altes ungültig, neues erzeugt | `{ token, createdAt, expiresAt }` |
| DELETE | `/api/teacher/calendar-token` | Widerruft Token | `{ success: true }` |

**Regeln:**
- POST `/calendar-token` erstellt nur, wenn kein **aktives** Token existiert → sonst 409 Conflict
- Ein abgelaufenes Token gilt API-seitig als **nicht aktiv** — POST create ist dann erlaubt (löscht das alte, erstellt neues)
- POST `/calendar-token/rotate` ersetzt immer → altes Token sofort ungültig
- Beide POST-Endpunkte geben den Roh-Token **einmalig** zurück
- GET gibt den Token **nie** zurück (XSS-Schutz)
- GET liefert `isExpired: boolean` explizit mit — Frontend muss das nicht selbst ableiten
- `expiresAt` = `createdAt + 12 Monate` (berechnet, nicht gespeichert)

**Verhalten bei abgelaufenem Token:**
- GET: `{ exists: false, expired: true, createdAt, expiresAt, isExpired: true }` — logisch „nicht aktiv"
- POST create: erlaubt (kein 409), da abgelaufenes Token funktional nicht existiert
- Feed: 404 (identisch zu widerrufenem/unbekanntem Token)

### Automatischer Ablauf

Token läuft **12 Monate** nach Erstellung ab. Durchgesetzt in der Feed-Route:

```js
// In calendar.js: Token-Ablauf prüfen (echte Monatsarithmetik, nicht 365 Tage)
const createdAt = new Date(teacher.calendar_token_created_at);
const expiresAt = new Date(createdAt);
expiresAt.setMonth(expiresAt.getMonth() + 12);

if (new Date() > expiresAt) {
  return res.status(404).end();
}
```

**Wichtig:** Ablauf wird mit echter Monatsarithmetik berechnet (`+12 months`), nicht pauschal mit 365 Tagen. SQL-seitig analog: `created_at + INTERVAL '12 months'`.

Die UI zeigt `expiresAt` an und fordert bei abgelaufenem Token zur Neuerstellung auf.

## API-Verträge

### Public (Token-Auth, kein Cookie)

```
GET /api/calendar/:token/elternsprechtag.ics
→ 200 text/calendar
→ 404 (falsches/abgelaufenes/widerrufenes Token)
```

Header:
```
Content-Type: text/calendar; charset=utf-8
Content-Disposition: inline; filename="elternsprechtag.ics"
Cache-Control: no-store, max-age=0
Pragma: no-cache
X-Robots-Tag: noindex
```

### Geschützt (JWT Cookie, requireTeacher)

```
GET    /api/teacher/calendar-token          → { exists, createdAt, expiresAt, isExpired }
POST   /api/teacher/calendar-token          → { token, createdAt, expiresAt } | 409 (nur bei aktivem Token)
POST   /api/teacher/calendar-token/rotate   → { token, createdAt, expiresAt }
DELETE /api/teacher/calendar-token           → { success: true }
```

URL-Zusammensetzung im Frontend:
```
${window.location.origin}/api/calendar/${token}/elternsprechtag.ics
```

## Token-Sicherheit

| Aspekt | Maßnahme |
|---|---|
| Entropie | `crypto.randomBytes(32)` = 256 Bit, 64 Hex-Zeichen |
| Speicherung | Nur SHA-256-Hash in DB — DB-Leak = keine nutzbaren URLs |
| Binding | Hash gehört exklusiv zu einem Teacher (Unique-Index) |
| Widerruf | DELETE setzt NULL — alter Token liefert sofort 404 |
| Ablauf | Automatisch nach 12 Monaten, durchgesetzt in Feed-Route |
| Rate Limiting | Eigener `calendarFeedLimiter` (siehe unten) |
| Enumeration | 404 bei falschem Token (kein Unterschied zu "nicht gefunden") |
| Indexierung | `X-Robots-Tag: noindex` |
| Cache | `no-store` + `Pragma: no-cache` |
| XSS | GET gibt Token nie zurück — nur POST einmalig |

## Rate Limiting

**Eigener Limiter** für den ICS-Feed (nicht `rateLimiters.booking`):

```js
// In index.js oder rateLimiters-Config
const calendarFeedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 Minuten
  max: 30,                     // 30 Requests pro Fenster pro IP
  standardHeaders: true,
});
```

**Begründung:** Kalender-Clients pollen regelmäßig (Outlook: ~30 Min, Google: ~12h, Apple: ~15 Min). Der booking-Limiter ist für menschliche Interaktion ausgelegt und würde legitime Kalender-Clients mit 429 bestrafen.

**Einschränkung V1:** IP-basiertes Limiting kann bei großen NAT-/Provider-IP-Räumen legitime Requests blockieren und schützt nicht perfekt vor Token-Missbrauch.

**V2-Option:** Zusätzlich tokenbasiertes oder kombiniertes (IP + Token) Limiting.

## ICS-Generator (Server-seitig)

Port von `src/utils/icalExport.ts` — nur reine Generierungsfunktionen:

- `generateTeacherICS(slots, teacherName, teacherRoom, eventName, uidDomain)` → `string`
- `escapeICalText(text)` — Sonderzeichen escapen
- `foldICalLine(line)` — RFC-5545 Line-Folding (75 Byte, `Buffer.byteLength`)
- `formatICalDateLocal(dateStr, timeStr)` — Lokale Zeitformatierung
- `getCurrentTimestamp()` — UTC-Timestamp für DTSTAMP

**Kein** `alert()`, `downloadICalFile()`, `TextEncoder` oder DOM-Code.

### VCALENDAR-Metadaten (Pflicht)

Jeder Feed beginnt mit einem vollständigen VCALENDAR-Header:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BKSB//Eltern- und Ausbildersprechtag//DE
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Elternsprechtag – [Lehrkraftname]
X-WR-TIMEZONE:Europe/Berlin
BEGIN:VTIMEZONE
...
END:VTIMEZONE
```

- `VERSION` und `PRODID` sind RFC-5545-Pflichtfelder
- `X-WR-CALNAME` zeigt dem Kalender-Client den Feed-Namen
- `X-WR-TIMEZONE` als Hint für Clients, die VTIMEZONE ignorieren

### ICS-Pflichtfelder pro Event (RFC 5545)

```
BEGIN:VEVENT
UID:elternsprechtag-slot-<slot_id>@<domain>
DTSTAMP:<aktuelle UTC-Zeit>
DTSTART;TZID=Europe/Berlin:<datum+startzeit>
DTEND;TZID=Europe/Berlin:<datum+endzeit>
SUMMARY:<Event-Titel>
LOCATION:<Raum>
STATUS:CONFIRMED
END:VEVENT
```

### Stabile UIDs

**Pflicht.** Jeder Slot bekommt eine deterministische UID:

```
elternsprechtag-slot-{slot.id}@{CALENDAR_UID_DOMAIN}
```

- Wird **nicht** pro Feed-Generierung neu erzeugt
- Kalender-Clients erkennen darüber Updates und Löschungen
- `CALENDAR_UID_DOMAIN` kommt **ausschließlich aus Backend-Config** (Env-Variable oder Config-Datei)
- **Niemals** aus `req.get('host')` ableiten — Host-Header variiert je nach Reverse Proxy, Staging/Prod, Portnummern
- Wenn sich die UID-Domain ändert, interpretieren Kalender-Clients alle Termine als neue Events → Duplikate
- Default: `calendar.schule.de` (oder projektspezifisch konfiguriert)

### Zeitzonen

- Termine in **lokaler Zeitzone** `Europe/Berlin`
- `DTSTART;TZID=Europe/Berlin:20260415T160000`
- VCALENDAR enthält einen `VTIMEZONE`-Block für `Europe/Berlin`
- Kein UTC — lokale Darstellung ist für Schultermine robuster

### Slot-Dauer / DTEND

Slots haben das Format `"16:00-16:15"` in `slots.time` (VARCHAR). Start- und Endzeit werden daraus **robust** geparst:

```js
function parseSlotTime(timeStr) {
  if (!timeStr || !timeStr.includes('-')) return null;
  const parts = timeStr.split('-').map(p => p.trim());
  if (parts.length !== 2) return null;
  const timeRegex = /^\d{1,2}:\d{2}$/;
  if (!timeRegex.test(parts[0]) || !timeRegex.test(parts[1])) return null;
  return { start: parts[0], end: parts[1] };
}
```

**Robustheitsregeln:**
- `.trim()` auf alle Teile — fängt Formate wie `"16:00 - 16:15"` ab
- Regex-Validierung der Zeitteile
- Ungültige oder nicht parsbare Slots werden **geloggt und übersprungen** — nicht ins ICS aufgenommen
- Ein einzelner defekter Slot darf **niemals** den gesamten Feed sprengen
- Fallback bei fehlendem `-`: Slot-Dauer aus Event-Settings (`slot_duration_minutes`, Default: 15 Min)

### Datensparsamkeit im Event-Titel

**Nicht:** `Elternsprechtag: Max Mustermann – Kevin Mustermann (7a)`
**Sondern:** `Elternsprechtag – K. Mustermann (7a)`

Nur abgekürzter Vorname des Schülers + Nachname + Klasse im SUMMARY.

**DESCRIPTION — bewusste Produktentscheidung:**

```
SUMMARY:Elternsprechtag – K. Mustermann (7a)
DESCRIPTION:Elternteil: Max Mustermann\nKlasse: 7a\nRaum: A12
```

DESCRIPTION enthält den vollen Elternnamen, Klasse und Raum. Das sind personenbezogene Daten. Diese Entscheidung ist **bewusst getroffen**, weil Lehrkräfte diese Informationen im Kalender für die Durchführung des Gesprächs brauchen (Wer kommt? Welche Klasse? Wo?). Der Elternname ist nötig, damit die Lehrkraft den Termin zuordnen kann — ohne ihn wäre der Kalendereintrag unbrauchbar.

Die DSGVO-Absicherung erfolgt über:
- Token-Schutz (nur berechtigte Lehrkraft sieht eigene Termine)
- SUMMARY minimiert (kein Elternname im Titel)
- Automatischer Ablauf nach 12 Monaten
- Widerruf jederzeit möglich

### Stornierte Termine

**V1:** Stornierte Slots (`booked = false`) werden nicht im Feed ausgeliefert — verschwinden beim nächsten Abruf.

**Bekanntes Risiko:** Manche Kalender-Clients entfernen verschwundene Events nicht sofort. Dokumentiert als V2-Option:

> V2-Option: Stornierte Slots mit `STATUS:CANCELLED` und erhöhtem `SEQUENCE` ausliefern statt sie wegzulassen. Erfordert zusätzliche Spalte `calendar_sequence` auf `slots`.

## Fehlerverhalten des Feed-Endpunkts

| Situation | HTTP-Status | Body |
|---|---|---|
| Ungültiger / unbekannter Token | 404 | leer |
| Widerrufener Token | 404 | leer |
| Abgelaufener Token | 404 | leer |
| Gültiger Token, keine Termine vorhanden | **200** | Gültiges, leeres ICS (nur VCALENDAR-Header ohne VEVENTs) |
| Interner Fehler beim Generieren | 500 | leer |

**Wichtig:** Kein 404 nur weil aktuell keine Termine da sind. Ein leeres, aber valides ICS ist das korrekte Verhalten.

## Logging (Minimum)

Ohne großes Audit-System, aber für Fehlersuche und Betrieb:

| Event | Geloggt | Nicht geloggt |
|---|---|---|
| Feed-Zugriff | Teacher-ID, Timestamp, IP (gehashed/anonymisiert) | **Niemals** Roh-Token |
| Token-Erstellung | Teacher-ID, Timestamp | Roh-Token |
| Token-Rotation | Teacher-ID, Timestamp | Roh-Token |
| Token-Löschung | Teacher-ID, Timestamp | — |
| Slot-Parsing-Fehler | Slot-ID, fehlerhafter `time`-Wert, Teacher-ID | — |
| ICS-Generierungsfehler | Teacher-ID, Fehlermeldung | Slot-Details mit PII |

## Slot-Query

```sql
SELECT
  s.id,
  s.date,
  s.time,
  s.status,
  s.student_name,
  s.parent_name,
  s.class_name,
  t.first_name  AS teacher_first_name,
  t.last_name   AS teacher_last_name
FROM slots s
JOIN teachers t ON t.id = s.teacher_id
WHERE t.calendar_token_hash = $1
  AND s.booked = true
  AND (s.status = 'confirmed' OR s.status IS NULL)
ORDER BY s.date, s.time
```

**Änderung gegenüber v1:** Explizite Spaltenauswahl statt `SELECT s.*`. Lookup über `calendar_token_hash`.

## Route-Registrierung

**Reihenfolge kritisch** — Calendar-Router **vor** publicRouter registrieren:

```js
// In backend/modules/elternsprechtag/index.js
// WICHTIG: Calendar-Feed MUSS vor publicRouter registriert werden,
// da /api/calendar/* sonst von publicRouter abgefangen wird.
app.use('/api/calendar', calendarFeedLimiter);     // Eigener Feed-Limiter
app.use('/api/calendar', calendarRouter);           // Dann Router
// ... danach bestehende Routes
app.use('/api', publicRouter);
```

**Code-Kommentar ist Pflicht** — verhindert versehentliches Umordnen bei Refactoring.

## Frontend-Komponente

`CalendarSubscription.tsx` — eingebettet in `TeacherBookings.tsx`:

### Zustand 1: Kein Token

- Button "Kalender-Abo erstellen"
- DSGVO-Hinweis (sichtbar vor Erstellung):
  > "Die Abo-URL enthält personenbezogene Daten (abgekürzte Namen, Klassen). Binden Sie die URL nur in Ihren privaten Kalender ein und teilen Sie sie nicht mit Dritten."

### Zustand 2: Gerade erstellt oder rotiert

- URL einmalig sichtbar (readonly Input)
- "Kopieren"-Button + webcal://-Link
- **Deutlicher Hinweis:** "Diese URL wird aus Sicherheitsgründen nicht erneut angezeigt. Bitte jetzt kopieren."
- Dieser Zustand existiert nur in der aktuellen Session (State, nicht persistiert)

### Zustand 3: Token aktiv, URL nicht mehr sichtbar

- "Kalender-Abo aktiv seit [Datum]"
- "Läuft ab am [Datum]" (createdAt + 12 Monate)
- Hinweis: "URL aus Sicherheitsgründen nicht erneut anzeigbar."
- Button "Neu erzeugen" (→ rotate, zeigt Erneuerungs-Warnung)
- Button "Deaktivieren" (→ DELETE)

### Zustand 4: Token abgelaufen

- "Kalender-Abo abgelaufen seit [Datum]"
- Button "Neues Abo erstellen" (→ POST create, da abgelaufener Token API-seitig als nicht aktiv gilt)

**Erneuerungs-Warnung (Confirm-Dialog):**
> "Die alte URL wird ungültig. Alle bestehenden Kalender-Abos müssen neu eingerichtet werden. Fortfahren?"

## Implementierungsreihenfolge

1. Migration (`056_calendar_tokens.sql`)
2. ICS-Generator (`icalGenerator.js`) — stabile UIDs, VTIMEZONE, Datensparsamkeit
3. Public Calendar-Route (`routes/calendar.js`) — eigener Rate-Limiter, Token-Hashing, Ablaufprüfung
4. Token-Management-Routes (`routes/teacher/calendarToken.js`) — create/rotate/delete
5. Route-Registrierung (`teacher.js`, `index.js`) — Reihenfolge mit Kommentar
6. Frontend-Types + API (`types/index.ts`, `api.ts`)
7. UI-Komponente (`CalendarSubscription.tsx` + CSS) — 4 Zustände
8. Integration in TeacherBookings

## DSGVO

- ICS enthält **abgekürzte** Schülernamen und Klasse — personenbezogene Daten (minimiert)
- Elternname nur in DESCRIPTION, nicht im SUMMARY
- Token-URL = Bearer-Token — wer den Link kennt, sieht alle Termine
- Pflichthinweis in der UI **vor** Token-Erstellung
- `Cache-Control: no-store` + `Pragma: no-cache` verhindert Proxy-Caching
- Token-Widerruf über DELETE jederzeit möglich
- **Automatischer Ablauf nach 12 Monaten** (Pflicht, durchgesetzt in Feed-Route)
- Token gehasht gespeichert — DB-Leak kompromittiert keine URLs

## Erweiterbarkeit

Der URL-Pfad `/api/calendar/:token/<modul>.ics` erlaubt spätere Module:
- `/api/calendar/:token/schulsozialarbeit.ics`
- `/api/calendar/:token/beratungslehrer.ics`

Vorerst Elternsprechtag-spezifisch. Generische Abstraktion erst bei tatsächlichem Bedarf.

**Auslagerung in eigene Tabelle:** Sobald Zugriffshistorie, mehrere parallele Tokens oder feingranulare Ablaufdaten relevant werden → `teacher_calendar_tokens`-Tabelle. Die aktuelle Spalten-Lösung ist für V1 ausreichend.

## V2-Optionen (dokumentiert, nicht in V1)

- `STATUS:CANCELLED` + `SEQUENCE` für stornierte Termine
- `ETag` / `Last-Modified` für effizienteres Polling
- Zugriffshistorie (`last_accessed_at`)
- Mehrere parallele Tokens (eigene Tabelle)
- Konfigurierbare Ablaufdauer pro Token
- Tokenbasiertes / kombiniertes Rate Limiting (IP + Token)

## Review-Befunde (alle eingearbeitet)

### Prüfer-Befunde (Runde 1)

| # | Schweregrad | Befund | Lösung |
|---|---|---|---|
| 1 | Hoch | Migration ohne `IF NOT EXISTS` | Behoben: `ADD COLUMN IF NOT EXISTS` |
| 2 | Hoch | UNIQUE-Constraint ohne Name | Gelöst: nur partieller Unique-Index, kein Constraint |
| 3 | Hoch | Route-Reihenfolge in index.js | Behoben: Calendar-Router vor publicRouter + Pflichtkommentar |
| 4 | Hoch | DSGVO-Hinweis fehlt | Behoben: Pflichthinweis in UI-Komponente |
| 5 | Mittel | `Pragma: no-cache` fehlt | Behoben: Header ergänzt |
| 6 | Mittel | Browser-APIs im Server-Port | Behoben: nur reine Funktionen portieren |
| 7 | Mittel | Token im GET sichtbar (XSS-Risiko) | Behoben: GET gibt nur `exists` + `createdAt` + `expiresAt` zurück |
| 8 | Mittel | Route-Kollision mit publicRouter | Behoben: Registrierungsreihenfolge dokumentiert + Kommentar |
| 9 | Niedrig | APP_URL als neue Env-Variable | Vermieden: URL im Frontend zusammensetzen |
| 10 | Niedrig | Legacy-Slots ohne Status | Behoben: `status IS NULL` in Query |

### Fachliches Review (Runde 2)

| # | Schweregrad | Befund | Lösung |
|---|---|---|---|
| 11 | Hoch | Token-Lifecycle unklar (POST create vs. rotate) | Getrennt: POST create (409 bei existierendem) + POST rotate |
| 12 | Hoch | UI-Zustände inkonsistent mit "einmalig sichtbar" | 4 Zustände klar definiert, URL nur in Zustand 2 sichtbar |
| 13 | Hoch | Stabile UIDs im ICS fehlen | Pflicht: `elternsprechtag-slot-{id}@{domain}` |
| 14 | Hoch | Zeitzone/Dauer nicht spezifiziert | Spezifiziert: Europe/Berlin, VTIMEZONE, Dauer aus time-Feld |
| 15 | Hoch | Token-Ablauf nur "Empfehlung" | Pflicht: 12 Monate, durchgesetzt in Feed-Route |
| 16 | Mittel | `SELECT s.*` zu breit | Behoben: explizite Spaltenauswahl |
| 17 | Mittel | booking-Limiter falsch für Feed | Behoben: eigener `calendarFeedLimiter` (30 req/15 min) |
| 18 | Mittel | Token im Klartext in DB | Behoben: SHA-256-Hash in DB |
| 19 | Mittel | Zu viel PII im Event-Titel | Behoben: abgekürzter Vorname, Elternname nur in DESCRIPTION |
| 20 | Mittel | Migration doppelt (Constraint + Index) | Behoben: nur partieller Unique-Index |
| 21 | Niedrig | Stornos verschwinden einfach | Dokumentiert als V2-Option (STATUS:CANCELLED) |
| 22 | Niedrig | Kein ETag/Last-Modified | Dokumentiert als V2-Option |
| 23 | Niedrig | Keine Audit/Rotationshistorie | Dokumentiert: eigene Tabelle bei Bedarf |

### Fachliches Review (Runde 3)

| # | Schweregrad | Befund | Lösung |
|---|---|---|---|
| 24 | Hoch | UID-Domain aus `req.get('host')` ist instabil | Behoben: nur aus stabiler Backend-Config (`CALENDAR_UID_DOMAIN`), nie aus Request |
| 25 | Hoch | Abgelaufene Tokens API-seitig noch als „existent" behandelt, POST create gibt 409 | Behoben: abgelaufene Tokens gelten als nicht aktiv, create ist dann erlaubt |
| 26 | Mittel | `VARCHAR(64)` für feste SHA-256-Hashlänge | Behoben: `CHAR(64)` |
| 27 | Mittel | 365 Tage statt echter 12-Monats-Berechnung | Behoben: echte Monatsarithmetik (`setMonth +12` / `INTERVAL '12 months'`) |
| 28 | Mittel | `time.split('-')` ohne Trim/Validierung | Behoben: robustes Parsing mit Trim, Regex, Logging defekter Slots |
| 29 | Mittel | DESCRIPTION enthält PII ohne explizite Produktentscheidung | Behoben: als bewusste, begründete Entscheidung dokumentiert |
| 30 | Mittel | `isExpired` nicht im GET-Response | Behoben: Backend liefert `isExpired` explizit mit |
| 31 | Mittel | VCALENDAR-Metadaten (PRODID, VERSION etc.) nicht spezifiziert | Behoben: vollständiger VCALENDAR-Header dokumentiert |
| 32 | Mittel | Rate Limiter nur IP-basiert, Einschränkung nicht dokumentiert | Behoben: V1-Einschränkung + V2-Option dokumentiert |
| 33 | Mittel | Fehlerverhalten des Feed-Endpunkts nicht definiert | Behoben: explizite Status-Tabelle, leeres ICS bei 0 Terminen |
| 34 | Niedrig | Kein Logging-Minimum definiert | Behoben: Logging-Tabelle mit Events und Datenschutzgrenzen |
