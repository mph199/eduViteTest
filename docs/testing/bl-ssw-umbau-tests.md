# Testdokumentation: BL/SSW Umbau auf pure Slotbuchung + Kalender-Abo

## Test-Infrastruktur

| Aspekt | Lösung |
|--------|--------|
| Test-Runner | Vitest 4.x (ESM-kompatibel) |
| Konfiguration | `backend/vitest.config.mjs` |
| Test-Verzeichnisse | `**/__tests__/*.test.mjs` |
| Mocking | `vi.mock()` für DB-Queries, Logger |
| Ausführung | `cd backend && npm test` |

---

## Testabdeckung

### P0: Pure Functions (kein DB-Mock nötig)

| Datei | Tests | Inhalt |
|-------|-------|--------|
| `shared/__tests__/sqlGuards.test.mjs` | 6 | SQL-Identifier-Validierung, Injection-Schutz |
| `shared/__tests__/tokenUtils.test.mjs` | 8 | Kalender-Token-TTL (12 Monate Monatsarithmetik), Schaltjahr-Edge-Cases, ENV-Fallback |
| `shared/__tests__/icalGenerator.test.mjs` | 12 | ICS-Generierung, **Datenschutz-Kerntests** (keine PII in SUMMARY/DESCRIPTION), Fehlertoleranz |
| `schemas/__tests__/counselor.test.mjs` | 10 | Zod-Schema-Validierung, Pflichtfelder, Transformation, entfernte Felder |

### P0: DB-abhängig (mit vi.mock)

| Datei | Tests | Inhalt |
|-------|-------|--------|
| `shared/__tests__/calendarTokenRoutes.test.mjs` | 8 | Token-Lifecycle (GET/POST/POST rotate/DELETE), 409 bei aktivem Token, 403 bei fehlendem Zugang |
| `jobs/__tests__/retention-cleanup.test.mjs` | 4 | Alle 7 Cleanup-Funktionen, `first_name`/`last_name` statt `student_name`, Fehler-Isolation |

### Gesamt

| Metrik | Wert |
|--------|------|
| Test-Dateien | 6 |
| Tests gesamt | 48 |
| Alle bestanden | Ja |
| Laufzeit | ~1s |
| Frontend-Build | Erfolgreich |

---

## Datenschutz-Kerntests

Die folgenden Tests stellen sicher, dass keine personenbezogenen Daten in externe Systeme gelangen:

### ICS-Feed-Inhalt (`icalGenerator.test.mjs`)

- `SUMMARY` enthält **nur** "Beratungstermin" — keine Schülernamen, keine Klassen
- Kein `DESCRIPTION`-Feld in Events
- UIDs enthalten nur technische IDs, keine Personendaten

### Retention-Cleanup (`retention-cleanup.test.mjs`)

- Anonymisierung verwendet `first_name`/`last_name` (nicht das entfernte `student_name`)
- Fehler in einem Cleanup-Task stoppt nicht die anderen

### Booking-Schema (`counselor.test.mjs`)

- Entfernte Felder (`is_urgent`, `topic_id`, `category_id`) werden von Zod ignoriert/gestripped
- Pflichtfelder (`first_name`, `last_name`, `consent_version`) werden validiert

---

## Code-Hygiene (Hygieniker-Ergebnis)

### Behoben

| # | Schweregrad | Befund | Status |
|---|-------------|--------|--------|
| 1 | Hoch | `TopicCategoryTab.tsx` — tote Datei, kein Import | Gelöscht |
| 2 | Hoch | `CounselorTopic` Interface — nur von toter Datei genutzt | Entfernt |
| 3 | Mittel | `listTopics` Export in BL/SSW appointmentService — nie aufgerufen | Entfernt |
| 4 | Mittel | `topicTable`/`topicForeignKey`/`listTopics` Dead Path in counselorService | Entfernt |

### Offen (Backlog)

| # | Schweregrad | Befund | Empfehlung |
|---|-------------|--------|------------|
| 5 | Mittel | Elternsprechtag `calendarToken.js` ~90% Duplikat mit Shared Factory | Nächster Sprint: auf `createCalendarTokenRoutes()` umstellen |
| 6 | Niedrig | `.cb-form__urgent` CSS-Klasse semantisch falsch wiederverwendet | Umbenennen in `.cb-form__checkbox-label` |
| 7 | Niedrig | `tokenUtils.js` Re-Export-Shim | Interne Imports auf `shared/` umstellen, Shim löschen |

### Verschlankung

- ~160 Zeilen toter Code entfernt
- Keine aufgeblähten Dateien identifiziert
- Keine kritischen Duplikate (ausser Elternsprechtag calendarToken.js → Backlog)

---

## Review-Ergebnisse (Prüfer-Agent)

### Befunde und Fixes

| # | Schweregrad | Befund | Status |
|---|-------------|--------|--------|
| 1-5 | Kritisch | `student_name` in DSGVO-Routen (dataSubject.js, consent.js, retention-cleanup.js) | Behoben → `first_name`/`last_name` |
| 7 | Hoch | `topicJoin`/`topicSelect` SQL-Interpolation ohne Validierung | Behoben → komplett entfernt |
| 8 | Mittel | Migration 059: `ELSE ''` statt `ELSE NULL` | Behoben → `ELSE NULL` |

---

## Test-Backlog (nächste Sprints)

### P0 (DSGVO-kritisch, empfohlen als nächstes)

| Bereich | Tests (geschätzt) | Beschreibung |
|---------|------------------|-------------|
| `dataSubject.js` | ~12 | Art. 15/16/17 DSGVO: Auskunft, Berichtigung, Löschung, Transaktionsintegrität |
| `consent.js` | ~6 | Art. 7 Widerruf: Anonymisierung, keine Info-Leaks, Rate-Limiting |

### P1 (Service & Routes)

| Bereich | Tests (geschätzt) | Beschreibung |
|---------|------------------|-------------|
| `counselorService.js` | ~8 | generateTimeSlots, bookAppointment, Konflikterkennung |
| `counselorPublicRoutes.js` | ~6 | Buchungsendpunkt, Consent-Receipt |
| `counselorAdminRoutes.js` | ~9 | CRUD, Ownership-Check, restricted-Filter |
| `calendarFeedRouter.js` | ~9 | ICS-Auslieferung, Token-Validierung, HTTP-Header |

### P2 (Auth & Helpers)

| Bereich | Tests (geschätzt) | Beschreibung |
|---------|------------------|-------------|
| `counselorRoutes.js` | ~6 | Counselor-Auth, Confirm/Cancel |
| `upsertWeeklySchedule` | ~5 | Wochenplan-Upsert |
| Migrationen 059+060 | ~4 | Idempotenz |

**Gesamt-Backlog: ~65 Tests**

---

## Ausführung

```bash
# Alle Tests
cd backend && npm test

# Watch-Modus (Entwicklung)
cd backend && npm run test:watch

# Einzelne Datei
cd backend && npx vitest run shared/__tests__/icalGenerator.test.mjs
```
