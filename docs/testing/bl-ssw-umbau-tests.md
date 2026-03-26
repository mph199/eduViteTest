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

## Testabdeckung (Phase 1)

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
| Laufzeit | < 1s |

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

## Noch nicht abgedeckt (Backlog)

### P1 (empfohlen)

| Bereich | Tests (geschätzt) | Priorität |
|---------|------------------|-----------|
| `counselorService.js` (generateTimeSlots, bookAppointment) | ~8 | P1 |
| `counselorPublicRoutes.js` (Buchungsendpunkt) | ~6 | P1 |
| `counselorAdminRoutes.js` (CRUD, Ownership-Check) | ~9 | P1 |
| `calendarFeedRouter.js` (ICS-Auslieferung, Token-Validierung) | ~9 | P1 |

### P0 (ausstehend, DSGVO-kritisch)

| Bereich | Tests (geschätzt) | Priorität |
|---------|------------------|-----------|
| `dataSubject.js` (Art. 15/16/17 DSGVO) | ~12 | P0 |
| `consent.js` (Art. 7 Widerruf) | ~6 | P0 |

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
