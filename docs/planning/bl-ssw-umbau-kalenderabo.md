# Architekturplan: BL/SSW Umbau auf pure Slotbuchung + Kalender-Abo

## Ziel

1. **Datenschutz-Minimierung**: Nur Vorname + Nachname (getrennte Felder) bei der Buchung. Keine Themen, keine Beratungsanlässe, keine Freitexte, keine internen Notizen. Feldumbenennungen (`consent_version` → `privacy_notice_version`) zur Vermeidung falscher Rechtsgrundlagen-Implikationen.
2. **Kalender-Abo (ICS-Feed)** aus dem Elternsprechtag-Modul auch für BL und SSW bereitstellen — mit datenschutzkonformem ICS-Inhalt (keine Personendaten im Termintitel).
3. **Speicherbegrenzung**: Löschkonzept für abgelaufene Termine und Token-Metadaten.

---

## 1. Ist-Zustand

### DB-Tabellen mit sensiblen Spalten

| Tabelle | Noch zu entfernen | Bereits entfernt | Datenschutz-Risiko |
|---------|-------------------|------------------|-------------------|
| `bl_appointments` | `topic_id` (FK → bl_topics), `is_urgent` | `concern`, `notes` (Migration 035), `is_anonymous` (Migration 027) | Rückschluss auf Beratungsgrund |
| `ssw_appointments` | `category_id` (FK → ssw_categories), `is_urgent` | `concern`, `notes` (Migration 035) | Rückschluss auf Beratungsgrund |

### Überflüssige Referenz-Tabellen

| Tabelle | Inhalt | Blockiert durch |
|---------|--------|----------------|
| `bl_topics` | 5 Seed-Einträge (name, description) | `bl_requests.topic_id` FK |
| `ssw_categories` | 5 Seed-Einträge (name, description, icon) | nichts |

### Kalender-Token-Infrastruktur (Ist)

- `calendar_token_hash` + `calendar_token_created_at` existieren **nur auf `teachers`**-Tabelle (Migration 056)
- ICS-Route: `GET /api/calendar/:token/elternsprechtag.ics` — elternsprechtag-spezifisch
- `tokenUtils.js` und `icalGenerator.js` liegen in `backend/modules/elternsprechtag/utils/` — nicht shared

### Booking-Flow (Ist)

Das `CounselorBookingApp.tsx` sendet: `student_name`, `student_class`, `email`, `topic_id`/`category_id`, `is_urgent`, `consent_version`. Das Zod-Schema in `counselor.js` validiert die Felder.

---

## 2. Soll-Zustand

### Buchungsformular (nach Umbau)

| Feld | Status | Begründung |
|------|--------|------------|
| `first_name` + `last_name` | **Neu** (ersetzt `student_name`) | Aufteilen in zwei Felder: ermöglicht saubere Validierung, Kürzelbildung (ICS), Auskunfts-/Löschanfragen und verhindert Freitext-Müll |
| `privacy_notice_version` | **Umbenennung** (war `consent_version`) | Dokumentiert, dass Datenschutzhinweise angezeigt wurden. Umbenennung, weil Schulen als öffentliche Stellen sich i.d.R. nicht auf Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) stützen sollten, sondern auf öffentliche/gesetzliche Aufgabe. "consent" suggeriert fälschlich eine Einwilligungsarchitektur. Nur bei geprüfter echter Einwilligungslösung den alten Namen behalten |
| `student_class` | **Bleibt** (optional) | Organisatorisch nötig für Counselor. Umsetzung als Dropdown/standardisierte Auswahl statt Freitext (verhindert Tippfehler, erleichtert Auswertung). Nur für die buchende Fachkraft sichtbar, nicht in öffentlichen Ansichten |
| `email` | **Bleibt** (Opt-in) | Kein Pflichtfeld. Nur für Bestätigung/Absage. Kein Versand ohne ausdrückliche Eingabe durch Buchende. Keine sensiblen Inhalte in Mailbetreff oder Mailtext (nur Datum, Uhrzeit, Counselor-Name). Keine Speicherung über Terminzweck hinaus |
| `topic_id` / `category_id` | **Entfernt** | Datenschutz — Rückschluss auf Beratungsgrund |
| `is_urgent` | **Entfernt** | Stigmatisierungspotenzial |
| `concern` | **Bereits entfernt** (Migration 035) | Sensible Freitextdaten |
| `notes` | **Bereits entfernt** (Migration 035) | Hochsensible interne Notizen |
| `is_anonymous` | **Bereits entfernt** (Migration 027) | Impliziert sensiblen Kontext |

### Verbleibendes Daten-Minimum

`first_name`, `last_name`, `student_class`, `email`, `date`, `time`, `counselor_id`, `status`, `privacy_notice_version` — pure Terminverwaltung.

---

## 3. Migrationen

### 059_bl_ssw_drop_topics_and_rename_fields.sql

```sql
-- Datenschutz-Minimierung: topic/category/is_urgent entfernen
-- HINWEIS: concern, notes (Migration 035) und is_anonymous (Migration 027) wurden bereits entfernt.
BEGIN;

-- BL: Verbleibende sensible Spalten entfernen
ALTER TABLE bl_appointments
  DROP COLUMN IF EXISTS topic_id,
  DROP COLUMN IF EXISTS is_urgent;

-- SSW: Verbleibende sensible Spalten entfernen
ALTER TABLE ssw_appointments
  DROP COLUMN IF EXISTS category_id,
  DROP COLUMN IF EXISTS is_urgent;

-- student_name aufteilen in first_name + last_name (BL)
ALTER TABLE bl_appointments
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
UPDATE bl_appointments
  SET first_name = split_part(student_name, ' ', 1),
      last_name  = CASE
        WHEN position(' ' IN student_name) > 0
        THEN substring(student_name FROM position(' ' IN student_name) + 1)
        ELSE ''
      END
  WHERE student_name IS NOT NULL AND first_name IS NULL;
ALTER TABLE bl_appointments DROP COLUMN IF EXISTS student_name;

-- student_name aufteilen in first_name + last_name (SSW)
ALTER TABLE ssw_appointments
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
UPDATE ssw_appointments
  SET first_name = split_part(student_name, ' ', 1),
      last_name  = CASE
        WHEN position(' ' IN student_name) > 0
        THEN substring(student_name FROM position(' ' IN student_name) + 1)
        ELSE ''
      END
  WHERE student_name IS NOT NULL AND first_name IS NULL;
ALTER TABLE ssw_appointments DROP COLUMN IF EXISTS student_name;

-- HINWEIS: consent_version existiert NICHT als Spalte auf bl_appointments/ssw_appointments,
-- sondern in der separaten consent_receipts-Tabelle (Migration 036).
-- Umbenennung dort separat behandeln (consent_receipts.consent_version ist ein
-- technischer Identifier, kein UI-Label — kann vorerst bleiben).

-- Referenz-Tabellen deaktivieren (nicht droppen wegen bl_requests FK)
UPDATE bl_topics SET active = FALSE;
UPDATE ssw_categories SET active = FALSE;

COMMIT;
```

### 060_bl_ssw_calendar_tokens.sql

```sql
-- Kalender-Abo-Token für BL- und SSW-Counselors
BEGIN;

ALTER TABLE bl_counselors
  ADD COLUMN IF NOT EXISTS calendar_token_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS calendar_token_created_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bl_counselors_calendar_token_hash
  ON bl_counselors (calendar_token_hash)
  WHERE calendar_token_hash IS NOT NULL;

ALTER TABLE ssw_counselors
  ADD COLUMN IF NOT EXISTS calendar_token_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS calendar_token_created_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ssw_counselors_calendar_token_hash
  ON ssw_counselors (calendar_token_hash)
  WHERE calendar_token_hash IS NOT NULL;

COMMIT;
```

---

## 4. Backend-Änderungen

### Phase 1: Shared Infrastruktur (3 Dateien)

| # | Datei | Aktion | Beschreibung |
|---|-------|--------|-------------|
| 1 | `backend/shared/tokenUtils.js` | **NEU** | Token-Generierung + TTL-Logik aus `elternsprechtag/utils/tokenUtils.js` extrahiert |
| 2 | `backend/shared/icalGenerator.js` | **NEU** | `generateCounselorICS(appointments, counselorName, moduleTitle, uidDomain)` |
| 3 | `backend/modules/elternsprechtag/utils/tokenUtils.js` | modify | Re-Export aus `shared/tokenUtils.js` (Abwärtskompatibilität) |

### Phase 2: Topic/Category-Bereinigung (8 Dateien)

| # | Datei | Aktion | Beschreibung |
|---|-------|--------|-------------|
| 4 | `backend/schemas/counselor.js` | modify | `is_urgent` aus Zod-Schema entfernen (topic_id/category_id werden nicht per Zod validiert, sondern direkt in `counselorPublicRoutes.js`); `student_name` → `first_name` + `last_name`; `consent_version` → `privacy_notice_version` |
| 5 | `backend/shared/counselorService.js` | modify | `bookAppointment` — topic/category-Parameter entfernen |
| 6 | `backend/shared/counselorPublicRoutes.js` | modify | topic-Endpunkt + topicForeignKey aus Booking entfernen |
| 7 | `backend/shared/counselorAdminRoutes.js` | modify | Topic/Category CRUD-Routen + Appointments-JOIN entfernen |
| 8 | `backend/modules/beratungslehrer/routes/admin.js` | modify | topic-Konfiguration entfernen |
| 9 | `backend/modules/beratungslehrer/routes/public.js` | modify | topicEndpoint/topicForeignKey entfernen |
| 10 | `backend/modules/schulsozialarbeit/routes/admin.js` | modify | category-Konfiguration entfernen |
| 11 | `backend/modules/schulsozialarbeit/routes/public.js` | modify | topicEndpoint/topicForeignKey entfernen |

### Phase 3: appointmentService-Bereinigung (4 Dateien)

| # | Datei | Aktion | Beschreibung |
|---|-------|--------|-------------|
| 12 | `backend/modules/beratungslehrer/services/appointmentService.js` | modify | topicTable/topicForeignKey/topicSelectCols entfernen |
| 13 | `backend/modules/beratungslehrer/routes/counselor.js` | modify | topicJoin/topicSelect leeren |
| 14 | `backend/modules/schulsozialarbeit/services/appointmentService.js` | modify | topicTable/topicForeignKey/topicSelectCols entfernen |
| 15 | `backend/modules/schulsozialarbeit/routes/counselor.js` | modify | topicJoin/topicSelect leeren |

### Phase 4: Kalender-Abo Backend (8 Dateien)

| # | Datei | Aktion | Beschreibung |
|---|-------|--------|-------------|
| 16 | `backend/modules/beratungslehrer/routes/calendarToken.js` | **NEU** | GET/POST/POST rotate/DELETE für BL-Token |
| 17 | `backend/modules/beratungslehrer/routes/calendarFeed.js` | **NEU** | `GET /api/calendar/:token/beratungslehrer.ics` |
| 18 | `backend/modules/beratungslehrer/routes/counselor.js` | modify | calendarToken-Router mounten |
| 19 | `backend/modules/beratungslehrer/index.js` | modify | calendarFeed-Route registrieren |
| 20 | `backend/modules/schulsozialarbeit/routes/calendarToken.js` | **NEU** | GET/POST/POST rotate/DELETE für SSW-Token |
| 21 | `backend/modules/schulsozialarbeit/routes/calendarFeed.js` | **NEU** | `GET /api/calendar/:token/schulsozialarbeit.ics` |
| 22 | `backend/modules/schulsozialarbeit/routes/counselor.js` | modify | calendarToken-Router mounten |
| 23 | `backend/modules/schulsozialarbeit/index.js` | modify | calendarFeed-Route registrieren |

---

## 4a. ICS-Feed: Sicherheits- und Datenschutzanforderungen

### Token-Sicherheit

| Anforderung | Beschreibung | Status (Elternsprechtag-Referenz) |
|-------------|-------------|-----------------------------------|
| Token-Entropie | Mindestens 128 Bit Zufall, besser 192+. Aktuell: 64 Hex-Zeichen (256 Bit raw input) | Vorhanden |
| Hash-only in DB | Nur SHA-256-Hash speichern, nie Klartext-Token | Vorhanden (`calendar_token_hash CHAR(64)`) |
| Generisches 404 | Bei ungültigem oder abgelaufenem Token immer dasselbe 404 — keine unterscheidbaren Fehler ("expired" vs. "not found") | Vorhanden |
| Sofortige Invalidierung | Rotate/Delete muss Token sofort ungültig machen | Geplant (Rotate/Delete-Endpunkte) |

### HTTP-Response-Header (Pflicht für alle ICS-Routen)

```
Cache-Control: no-store, private
Pragma: no-cache
X-Robots-Tag: noindex, nofollow
```

Keine Weiterleitungen. Bereits im Elternsprechtag-Code vorhanden (`calendar.js:106-108`), aber `private` und `nofollow` fehlen dort noch — bei der Shared-Extraktion ergänzen.

### Rate Limiting und Missbrauchsschutz

- IP-basiertes Rate Limiting (existierender `calendarFeedLimiter` als Vorlage)
- Optional: `last_accessed_at`-Spalte auf Counselor-Tabellen für Monitoring
- Optional: Auto-Expire nach langer Inaktivität (z.B. 6 Monate ohne Abruf)

### ICS-Inhalt: Datenschutz-Vorgaben

**Grundregel:** Der ICS-Feed landet bei externen Kalenderdiensten (Google, Apple, Microsoft) und auf privaten Geräten. Das sind potenziell weitere Datenempfänger/Transferkanäle. Deshalb: nur das absolute Minimum exportieren.

**SUMMARY (Termintitel):**

Standardmäßig **neutraler Titel ohne Personendaten**:
- Priorität 1: `Beratungstermin` (kein Name, keine Klasse)
- Priorität 2: `Beratungstermin — V. Nachname` (nur wenn Counselor dies explizit aktiviert)
- Kein voller Schülername als Standard

**DESCRIPTION:** Leer oder minimal. Nicht exportieren:
- Schülername (voller Name)
- Klasse
- E-Mail
- Status
- Notizen
- Moduldetails (ob BL oder SSW — verrät Beratungskontext)

**UID-Domain:** Konfigurierbar via `CALENDAR_UID_DOMAIN` (wie Elternsprechtag).

### Routing-Architektur

**Problem:** Der Prefix `/api/calendar` ist aktuell exklusiv in `elternsprechtag/index.js` mit eigenem Rate-Limiter registriert. Mehrfaches Mounten desselben Prefixes durch verschiedene Module führt zu Konflikten.

**Lösung:** Shared Calendar-Router in `backend/shared/calendarFeedRouter.js`:
- Alle Module registrieren ihre ICS-Routen über eine zentrale Factory
- Ein gemeinsamer Rate-Limiter für `/api/calendar`
- Oder: Modul-spezifische Prefixes (`/api/bl/calendar/:token/...`, `/api/ssw/calendar/:token/...`)

### UI-Hinweise für Kalender-Abo

Die `CounselorCalendarSubscription`-Komponente muss folgende Hinweise anzeigen:
- "Kalender-Abo nur in dienstlichen Kalendern verwenden"
- "Externe Kalenderdienste (Google, Apple, Microsoft) sind eigene Datenempfänger mit eigenen Datenschutzfolgen"
- "Alte URL wird bei Rotation sofort ungültig — Abo im Kalender-Client erneuern"

---

## 5. Frontend-Änderungen

### Phase 5: Types + API (2 Dateien)

| # | Datei | Aktion | Beschreibung |
|---|-------|--------|-------------|
| 24 | `src/types/index.ts` | modify | `category_name`, `topic_name` aus `CounselorAppointment` entfernen (`concern`, `notes`, `is_urgent`, `is_anonymous` fehlen bereits im Interface); `student_name` → `first_name` + `last_name`; `consent_version` → `privacy_notice_version`; `CounselorBookingConfig` vereinfachen; `CounselorCalendarTokenStatus` + `CounselorCalendarTokenCreated` ergänzen |
| 25 | `src/services/api.ts` | modify | Topic/Category-API-Methoden entfernen; `bl.getCalendarToken()`, `bl.createCalendarToken()`, `bl.rotateCalendarToken()`, `bl.deleteCalendarToken()` ergänzen (analog für SSW) |

### Phase 6: Shared Komponenten (4 Dateien)

| # | Datei | Aktion | Beschreibung |
|---|-------|--------|-------------|
| 26 | `src/shared/components/CounselorBookingApp.tsx` | modify | Topic-Dropdown, is_urgent-Checkbox, concern-Textarea entfernen |
| 27 | `src/shared/components/CounselorAnfragenTab.tsx` | modify | `topicField`/`topicColumnLabel`-Spalte aus Tabelle entfernen |
| 28 | `src/shared/components/CounselorCalendarSubscription.tsx` | **NEU** | Generische Kalender-Abo-Komponente (config: `apiPrefix`, `filename`) |
| 29 | `src/shared/components/CounselorCalendarSubscription.css` | **NEU** | CSS (Basis: `CalendarSubscription.css` vom Elternsprechtag) |

### Phase 7: BL-Frontend (5 Dateien)

| # | Datei | Aktion | Beschreibung |
|---|-------|--------|-------------|
| 30 | `src/modules/beratungslehrer/components/BLBookingApp.tsx` | modify | topic-Config-Felder entfernen |
| 31 | `src/modules/beratungslehrer/pages/BLAnfragenTab.tsx` | modify | `topicColumnLabel`/`topicField` aus BL_CONFIG entfernen |
| 32 | `src/modules/beratungslehrer/pages/BLSprechzeitenTab.tsx` | modify | `CounselorCalendarSubscription` einbinden |
| 33 | `src/modules/beratungslehrer/pages/BLAdmin.tsx` | modify | Topics-Tab, topics-State, `getAdminTopics()`-Call entfernen |
| 34 | `src/modules/beratungslehrer/pages/BLTopicsTab.tsx` | **LÖSCHEN** | Topic-Tab wird entfernt |

### Phase 8: SSW-Frontend (5 Dateien)

| # | Datei | Aktion | Beschreibung |
|---|-------|--------|-------------|
| 35 | `src/modules/schulsozialarbeit/components/SSWBookingApp.tsx` | modify | category-Config-Felder entfernen |
| 36 | `src/modules/schulsozialarbeit/pages/SSWAnfragenTab.tsx` | modify | `topicColumnLabel`/`topicField` aus SSW_CONFIG entfernen |
| 37 | `src/modules/schulsozialarbeit/pages/SSWTermineTab.tsx` | modify | `detailColumnLabel` + `detailColumnValue` Props entfernen |
| 38 | `src/modules/schulsozialarbeit/pages/SSWAdmin.tsx` | modify | Categories-Tab, categories-State, `getAdminCategories()`-Call entfernen |
| 39 | `src/modules/schulsozialarbeit/pages/SSWCategoriesTab.tsx` | **LÖSCHEN** | Categories-Tab wird entfernt |

---

## 6. API-Änderungen

### Entfallende Endpunkte (8 Stück)

| Method | Path | Grund |
|--------|------|-------|
| GET | `/api/bl/topics` | Themen-Feature entfernt |
| GET | `/api/bl/admin/topics` | Themen-CRUD entfernt |
| POST | `/api/bl/admin/topics` | Themen-CRUD entfernt |
| PUT | `/api/bl/admin/topics/:id` | Themen-CRUD entfernt |
| GET | `/api/ssw/categories` | Categories-Feature entfernt |
| GET | `/api/ssw/admin/categories` | Categories-CRUD entfernt |
| POST | `/api/ssw/admin/categories` | Categories-CRUD entfernt |
| PUT | `/api/ssw/admin/categories/:id` | Categories-CRUD entfernt |

### Vereinfachte Buchungs-Endpunkte

| Method | Path | Request vorher | Request nachher |
|--------|------|---------------|-----------------|
| POST | `/api/bl/appointments/:id/book` | `{ student_name, student_class, email, topic_id, is_urgent, consent_version }` | `{ first_name, last_name, student_class?, email?, privacy_notice_version }` |
| POST | `/api/ssw/appointments/:id/book` | `{ student_name, student_class, email, category_id, is_urgent, consent_version }` | `{ first_name, last_name, student_class?, email?, privacy_notice_version }` |

### Neue Kalender-Token-Endpunkte (je 5 pro Modul = 10 total)

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/api/bl/counselor/calendar-token` | requireAuth + BL-Zugang | `{ exists, createdAt, expiresAt, isExpired }` |
| POST | `/api/bl/counselor/calendar-token` | requireAuth + BL-Zugang | `{ token, createdAt, expiresAt }` oder 409 |
| POST | `/api/bl/counselor/calendar-token/rotate` | requireAuth + BL-Zugang | `{ token, createdAt, expiresAt }` |
| DELETE | `/api/bl/counselor/calendar-token` | requireAuth + BL-Zugang | `{ success: true }` |
| GET | `/api/calendar/:token/beratungslehrer.ics` | Token-Auth (URL) | `text/calendar` oder 404 |
| GET | `/api/ssw/counselor/calendar-token` | requireAuth + SSW-Rolle | `{ exists, createdAt, expiresAt, isExpired }` |
| POST | `/api/ssw/counselor/calendar-token` | requireAuth + SSW-Rolle | `{ token, createdAt, expiresAt }` oder 409 |
| POST | `/api/ssw/counselor/calendar-token/rotate` | requireAuth + SSW-Rolle | `{ token, createdAt, expiresAt }` |
| DELETE | `/api/ssw/counselor/calendar-token` | requireAuth + SSW-Rolle | `{ success: true }` |
| GET | `/api/calendar/:token/schulsozialarbeit.ics` | Token-Auth (URL) | `text/calendar` oder 404 |

---

## 7. Implementierungsreihenfolge

```
Phase 1: Shared Infrastruktur
  1. shared/tokenUtils.js (create)
  2. elternsprechtag/utils/tokenUtils.js → re-export
  3. shared/icalGenerator.js (create)
  4. shared/calendarFeedRouter.js (create) — Shared Router für alle ICS-Feeds
  5. elternsprechtag/index.js → auf Shared Router umstellen

Phase 2: Migrationen
  4. 059_bl_ssw_drop_topics_categories.sql
  5. 060_bl_ssw_calendar_tokens.sql

Phase 3: Backend Topic-Bereinigung
  6. schemas/counselor.js
  7. shared/counselorService.js
  8. shared/counselorPublicRoutes.js
  9. shared/counselorAdminRoutes.js
  10-15. BL + SSW Modul-Routes + Services

Phase 4: Backend Kalender-Abo
  16-17. BL calendarToken.js + calendarFeed.js
  18-19. BL counselor.js + index.js
  20-21. SSW calendarToken.js + calendarFeed.js
  22-23. SSW counselor.js + index.js

Phase 5: Frontend Types + API
  24. types/index.ts
  25. services/api.ts

Phase 6: Frontend Komponenten
  26-27. CounselorBookingApp + CounselorAnfragenTab
  28-29. CounselorCalendarSubscription (NEU)
  30-34. BL-Seiten + BLTopicsTab löschen
  35-39. SSW-Seiten + SSWCategoriesTab löschen

Phase 7: Build + Review + Push
```

---

## 8. Risiken

| Risiko | Bewertung | Mitigation |
|--------|-----------|------------|
| `DROP COLUMN` löscht historische topic-Zuordnungen unwiderruflich | Mittel | Audit-Log erfasst Änderungen; kein Export nötig |
| `bl_requests.topic_id` FK blockiert `DROP TABLE bl_topics` | Niedrig | Tabellen werden nur deaktiviert, nicht gedroppt |
| Laufende gebuchte Termine verlieren topic-Zuordnung | Akzeptabel | Gewolltes Verhalten — Datenschutz-Minimierung |
| Bestehende API-Consumer (z.B. externe Skripte) brechen | Niedrig | Keine bekannten externen Consumer |
| Shared Factory hat viele topic-Parameter | Mittel | Parameter optional machen, nicht Factory auflösen |
| `/api/calendar`-Routing-Konflikt zwischen Modulen | Hoch | Vor Phase 4 klären: Shared Router oder Modul-Prefixes (siehe Abschnitt 4a) |
| ICS-Feed leakt Personendaten an externe Kalenderdienste | Hoch | Neutraler Titel als Standard, keine PII in DESCRIPTION (siehe Abschnitt 4a) |
| Kalender-Token-URL in Access-Logs/Browser-History | Mittel | URL-Parameter in Reverse-Proxy-Logs maskieren; Cache-Control: no-store, private |
| `student_name`-Aufspaltung: Datenmigration bei mehrteiligen Namen | Mittel | Split-Logik in Migration (erster Teil → first_name, Rest → last_name); manuelle Prüfung bei Sonderfällen |
| Backups enthalten bereits gelöschte sensible Spalten | Niedrig | Organisatorisch: Backup-Rotation dokumentieren, Restore-Runbook anpassen |

---

## 9. Datenschutz-Gewinn

| Entfernt | Art | Begründung | Status |
|----------|-----|------------|--------|
| `concern` (Freitext) | Freitext | Sensible Informationen über Beratungsanlass | Bereits entfernt (Migration 035) |
| `notes` (interne Notizen) | Freitext | Potenziell hochsensibles Material | Bereits entfernt (Migration 035) |
| `is_anonymous` | Boolean | Impliziert sensiblen Kontext | Bereits entfernt (Migration 027) |
| `topic_id` / `category_id` | Referenz | Rückschluss auf Beratungsgrund | Dieses Projekt |
| `is_urgent` | Boolean | Stigmatisierungspotenzial | Dieses Projekt |
| `student_name` → `first_name` + `last_name` | Strukturverbesserung | Saubere Validierung, Kürzelbildung, Auskunftsanfragen | Dieses Projekt |
| `consent_version` → `privacy_notice_version` | Umbenennung | Korrekte Rechtsgrundlagen-Terminologie | Dieses Projekt |
| Topic/Category CRUD | Feature | Kein Verwaltungsbedarf mehr | Dieses Projekt |
| Topic-Dropdown im Formular | UI | Keine Auswahl mehr nötig | Dieses Projekt |
| ICS-Personendaten minimiert | ICS-Feed | Neutraler Titel statt Schülername im Kalender | Dieses Projekt |

**Verbleibendes Minimum:** `first_name`, `last_name`, `student_class`, `email`, `date`, `time`, `counselor_id`, `status`, `privacy_notice_version`

---

## 10. Löschkonzept (Speicherbegrenzung)

Datenminimierung umfasst nicht nur die Erhebung, sondern auch die **Speicherdauer** (Art. 5 Abs. 1 lit. e DSGVO). Ohne Löschregeln wachsen die Tabellen unbegrenzt.

### Aufbewahrungsfristen

| Datenart | Frist | Löschregel |
|----------|-------|------------|
| Abgesagte / nicht angenommene Buchungen | **14 Tage** nach Absage | Automatische Bereinigung (Cronjob oder DB-Trigger) |
| Erledigte Termine | **Schuljahresende** oder 90 Tage nach Termin (was zuerst eintritt) | Automatische Bereinigung |
| Kalender-Token-Metadaten | **Sofort** nach Widerruf/Rotation | DELETE setzt Hash + Timestamp auf NULL |
| Abgelaufene Kalender-Tokens | **30 Tage** nach Ablauf | Automatische Bereinigung der Hash-/Timestamp-Spalten |
| Audit-Log-Einträge mit PII | **12 Monate** | Gemäß bestehendem Audit-Log-Konzept |

### Umsetzung

- Neue Migration oder Erweiterung von `backend/jobs/` (falls vorhanden) mit Cleanup-Job
- Alternativ: PostgreSQL-basierter Cronjob (`pg_cron`) oder Application-Level Scheduler
- Löschung als **Hard Delete**, nicht Soft Delete (Datenschutz > Wiederherstellbarkeit)

---

## 11. Log-Hygiene

Auch bei bereinigter DB können sensible Daten in Logs landen. Prüfpunkte:

| Log-Typ | Risiko | Maßnahme |
|---------|--------|----------|
| Request-Logs (Express/Morgan) | `student_name`, `email` in POST-Body | Body-Logging für Buchungsrouten deaktivieren oder PII maskieren |
| Error-Logs (Logger) | Stack Traces können Request-Daten enthalten | Structured Logging mit PII-Filterung |
| Audit-Logs | Explizit für PII-Zugriffe gedacht | Aufbewahrungsfrist einhalten (s. Abschnitt 10) |
| Mail-Logs (Nodemailer) | Empfänger-E-Mail, ggf. Inhalt | Transport-Logging auf Minimum beschränken |
| Kalender-Token in URLs | Token erscheint in Access-Logs | Reverse-Proxy-Konfiguration: URL-Parameter maskieren oder Access-Log für `/api/calendar` deaktivieren |

### Regel

Kein `student_name`/`first_name`/`last_name`, keine `email`, kein Klartext-Token in persistierten Logs. Wo nötig, nur gehashte oder gekürzte Werte loggen.

---

## 12. Backup-Betrachtung

`DROP COLUMN` entfernt Daten aus der Live-DB, aber **nicht automatisch aus Backups**.

| Punkt | Status | Empfehlung |
|-------|--------|------------|
| Backup-Aufbewahrungsdauer | Klären | Dokumentieren, wie lange Backups aufbewahrt werden. Sensible Spalten existieren in Backups, die vor Migration 035/059 erstellt wurden |
| Zugriff auf Backups | Klären | Nur Ops/Admin-Zugriff, kein Entwicklerzugriff auf Produktions-Backups |
| Restore-Prozess | Bewusstsein | Ein Restore älterer Backups macht bereits gelöschte sensible Spalten wieder sichtbar. Restore-Runbook muss das berücksichtigen |
| Empfehlung | — | Kein Blocker für dieses Projekt, aber organisatorisch sicherstellen, dass Backups nach definierter Frist rotiert werden |

---

## 13. Offene Entscheidungen

| # | Frage | Empfehlung | Follow-up |
|---|-------|------------|-----------|
| 1 | `bl_requests`-Tabelle (anonyme Anfragen mit `topic_id`, `message`, `contact_info`) — mitlöschen? | Vorerst behalten, separate Entscheidung. **Aber:** `message` und `contact_info` sind potenziell heikler als die künftige Slotbuchung — nicht liegen lassen | Ticket erstellen: "bl_requests Datenschutz-Review" |
| 2 | `bl_topics` / `ssw_categories` droppen oder nur deaktivieren? | Deaktivieren (active=FALSE) in dieser Runde | Ticket erstellen: "bl_topics/ssw_categories vollständig entfernen" für nächste Runde |
| 3 | ICS-Inhalt: Voller Name oder Kürzel? | **Neutraler Titel ohne Personendaten** als Standard ("Beratungstermin"). Kürzel (V. Nachname) nur als Opt-in durch Counselor. Kein voller Schülername. Siehe Abschnitt 4a für Details | Entschieden |
| 4 | Wer erzeugt Kalender-Tokens? Nur Counselor oder auch Admin? | Nur eigener Counselor (wie bei Elternsprechtag). Admin-Erzeugung erhöht Zugriffswege unnötig und kollidiert mit Privacy-by-Default | Entschieden |
| 5 | Routing-Architektur für `/api/calendar` — Shared Router oder Modul-Prefixes? | **Shared Calendar-Router** (`backend/shared/calendarFeedRouter.js`). Begründung: Weitere Module werden künftig hinzukommen. Elternsprechtag-Modul wird umgestellt, alle ICS-Routen zentral registriert | Entschieden |
| 6 | `student_class` als Dropdown oder Freitext? | **Freitext** bleibt. Kein Dropdown nötig | Entschieden |
| 7 | `student_name`-Aufspaltung: nur BL/SSW oder systemweit? | **Nur BL/SSW** in dieser Runde. Elternsprechtag-Modul (slots.student_name) bleibt unverändert | Entschieden |

---

**Umfang:** ~43 Dateien, 2 Migrationen (erweitert um Feld-Umbenennungen), 6 neue Dateien, 2 gelöschte Dateien, 8 entfallende API-Endpunkte, 10 neue API-Endpunkte.
