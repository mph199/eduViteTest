# Architekturplan: BL/SSW Umbau auf pure Slotbuchung + Kalender-Abo

## Ziel

1. **Datenschutz-Minimierung**: Nur Vorname + Nachname bei der Buchung. Keine Themen, keine Beratungsanlässe, keine Freitexte, keine internen Notizen.
2. **Kalender-Abo (ICS-Feed)** aus dem Elternsprechtag-Modul auch für BL und SSW bereitstellen.

---

## 1. Ist-Zustand

### DB-Tabellen mit sensiblen Spalten

| Tabelle | Zu entfernende Spalten | Datenschutz-Risiko |
|---------|----------------------|-------------------|
| `bl_appointments` | `topic_id` (FK → bl_topics), `concern` (Freitext), `is_anonymous`, `is_urgent`, `notes` (interne Notizen) | Rückschluss auf Beratungsgrund, hochsensible Freitexte |
| `ssw_appointments` | `category_id` (FK → ssw_categories), `concern` (Freitext), `is_urgent`, `notes` (interne Notizen) | Rückschluss auf Beratungsgrund, hochsensible Freitexte |

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
| `student_name` | **Bleibt** | Identifikation des Termins (Vorname + Nachname) |
| `consent_version` | **Bleibt** | Einwilligungsnachweis |
| `student_class` | **Bleibt** (optional) | Organisatorisch nötig für Counselor |
| `email` | **Bleibt** (optional) | Bestätigungsmail-Funktionalität |
| `topic_id` / `category_id` | **Entfernt** | Datenschutz — Rückschluss auf Beratungsgrund |
| `is_urgent` | **Entfernt** | Stigmatisierungspotenzial |
| `concern` | **Entfernt** | Sensible Freitextdaten |
| `notes` | **Entfernt** | Hochsensible interne Notizen |
| `is_anonymous` | **Entfernt** | Impliziert sensiblen Kontext |

### Verbleibendes Daten-Minimum

`student_name`, `student_class`, `email`, `date`, `time`, `counselor_id`, `status`, `consent_version` — pure Terminverwaltung.

---

## 3. Migrationen

### 059_bl_ssw_drop_topics_categories.sql

```sql
-- Datenschutz-Minimierung: topic/category/concern/notes/is_urgent/is_anonymous entfernen
BEGIN;

-- BL: Sensible Spalten entfernen
ALTER TABLE bl_appointments
  DROP COLUMN IF EXISTS topic_id,
  DROP COLUMN IF EXISTS concern,
  DROP COLUMN IF EXISTS is_anonymous,
  DROP COLUMN IF EXISTS is_urgent,
  DROP COLUMN IF EXISTS notes;

-- SSW: Sensible Spalten entfernen
ALTER TABLE ssw_appointments
  DROP COLUMN IF EXISTS category_id,
  DROP COLUMN IF EXISTS concern,
  DROP COLUMN IF EXISTS is_urgent,
  DROP COLUMN IF EXISTS notes;

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
| 4 | `backend/schemas/counselor.js` | modify | `topic_id`, `category_id`, `is_urgent` aus Zod-Schema entfernen |
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

## 5. Frontend-Änderungen

### Phase 5: Types + API (2 Dateien)

| # | Datei | Aktion | Beschreibung |
|---|-------|--------|-------------|
| 24 | `src/types/index.ts` | modify | `category_name`, `topic_name`, `concern`, `notes`, `is_urgent`, `is_anonymous` aus `CounselorAppointment` entfernen; `CounselorBookingConfig` vereinfachen; `CounselorCalendarTokenStatus` + `CounselorCalendarTokenCreated` ergänzen |
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
| 37 | `src/modules/schulsozialarbeit/pages/SSWTermineTab.tsx` | modify | `detailColumn` entfernen |
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
| POST | `/api/bl/appointments/:id/book` | `{ student_name, student_class, email, topic_id, is_urgent, consent_version }` | `{ student_name, student_class?, email?, consent_version }` |
| POST | `/api/ssw/appointments/:id/book` | `{ student_name, student_class, email, category_id, is_urgent, consent_version }` | `{ student_name, student_class?, email?, consent_version }` |

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

---

## 9. Datenschutz-Gewinn

| Entfernt | Art | Begründung |
|----------|-----|------------|
| `concern` (Freitext) | Freitext | Sensible Informationen über Beratungsanlass |
| `topic_id` / `category_id` | Referenz | Rückschluss auf Beratungsgrund |
| `notes` (interne Notizen) | Freitext | Potenziell hochsensibles Material |
| `is_anonymous` | Boolean | Impliziert sensiblen Kontext |
| `is_urgent` | Boolean | Stigmatisierungspotenzial |
| Topic/Category CRUD | Feature | Kein Verwaltungsbedarf mehr |
| Topic-Dropdown im Formular | UI | Keine Auswahl mehr nötig |

**Verbleibendes Minimum:** `student_name`, `student_class`, `email`, `date`, `time`, `counselor_id`, `status`, `consent_version`

---

## 10. Offene Entscheidungen

| # | Frage | Empfehlung |
|---|-------|------------|
| 1 | `bl_requests`-Tabelle (anonyme Anfragen mit `topic_id`, `message`, `contact_info`) — mitlöschen? | Eigenes Feature, separate Entscheidung. Vorerst behalten. |
| 2 | `bl_topics` / `ssw_categories` droppen oder nur deaktivieren? | Deaktivieren (active=FALSE). DROP in späterer Migration. |
| 3 | ICS-Inhalt: Voller Name oder Kürzel? | Kürzel (V. Nachname) für Datenschutz |
| 4 | Wer erzeugt Kalender-Tokens? Nur Counselor oder auch Admin? | Nur eigener Counselor (wie bei Elternsprechtag) |

---

**Umfang:** ~41 Dateien, 2 Migrationen, 6 neue Dateien, 2 gelöschte Dateien, 8 entfallende API-Endpunkte, 10 neue API-Endpunkte.
