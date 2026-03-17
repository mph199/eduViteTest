# P0 Sprint-Plan: Go-Live-Blocker DSGVO

> **Stand:** 2026-03-17
> **Bezug:** [DSGVO SaaS-ToDo](../compliance/dsgvo-saas-todo.md) | [DB-Audit](../security/db-audit-2026-03-17.md)

## Context

Das Projekt hat 18 offene P0-Aufgaben (Go-Live-Blocker) aus dem DSGVO SaaS-ToDo, abgeleitet aus DB-Audit und Gap-Analyse. Ohne deren Abschluss ist kein rechtskonformer Go-Live moeglich. Dieser Plan strukturiert P0 in 4 Sprints mit klarer Reihenfolge: Backend vor Frontend, Datenbasis vor UI, kritischste Luecken zuerst.

---

## Sprint 1: Loeschkonzept & Datenbereinigung (Aufgaben 0.1.1–0.1.5)

**Fokus:** Technische Grundlage fuer DSGVO Art. 5/17 – Daten loeschen und anonymisieren koennen.

### Aufgaben

| # | Aufgabe | Dateien |
|---|---------|---------|
| 0.1.1 | PII-Anonymisierung `booking_requests` bei Event-Abschluss | `backend/migrations/034_anonymize_booking_requests.sql`, `backend/routes/admin/bookingRoutes.js` |
| 0.1.2 | PII-Anonymisierung bei Cancel in SSW/BL | `backend/modules/schulsozialarbeit/routes/counselor.js`, `backend/modules/beratungslehrer/routes/counselor.js`, `backend/shared/counselorAdminRoutes.js` |
| 0.1.4 | DELETE-Endpunkt fuer booking_requests | `backend/routes/admin/bookingRoutes.js` |
| 0.1.5 | Aufbewahrungsfristen konfigurierbar | `backend/config/retention.js` (neu) |
| 0.1.3 | Retention-Cron-Job | `backend/jobs/retention-cleanup.js` (neu), `backend/index.js` |

### Reihenfolge

1. **0.1.5 zuerst** – Config-Modul fuer Fristen anlegen (Grundlage fuer alles Weitere)
2. **0.1.1** – Migration + Anonymisierungsfunktion fuer booking_requests
3. **0.1.2** – Cancel-Logik SSW/BL analog erweitern
4. **0.1.4** – DELETE-Endpunkt (nutzt Anonymisierungsfunktion aus 0.1.1)
5. **0.1.3 zuletzt** – Cron-Job baut auf Config (0.1.5) und Anonymisierung (0.1.1/0.1.2) auf

### Review & Security

- **Pruefer-Agent** nach jedem Commit
- SQL-Injection-Check: Alle Queries parametrisiert (`$1`, `$2`)
- Auth-Middleware auf allen Admin-Endpunkten pruefen
- Manueller Test: Event abschliessen → PII in booking_requests pruefen (muss NULL sein)
- Manueller Test: SSW/BL cancel → PII-Felder pruefen
- Manueller Test: Cron-Job mit abgelaufenen Testdaten ausfuehren

### Dokumentation

- `dsgvo-saas-todo.md` Checkboxen aktualisieren
- Retention-Config in `.env.example` dokumentieren
- Loeschkonzept-Abschnitt in `docs/compliance/` anlegen oder erweitern

---

## Sprint 2: Art.-9-Daten entfernen (Aufgaben 0.2.1–0.2.4) – ERLEDIGT

**Entscheidung:** Psychosoziale Daten (concern/notes) werden nicht mehr erhoben.
Statt Schutzmechanismen aufzubauen, wurden die Felder komplett entfernt.

### Umgesetzte Massnahmen

| # | Massnahme | Dateien |
|---|-----------|---------|
| 035 | Migration: Altdaten anonymisiert + Spalten entfernt | `backend/migrations/035_remove_art9_data.sql` |
| -- | concern aus Buchungsflow entfernt | `counselorPublicRoutes.js`, `counselorService.js` |
| -- | notes-Endpunkte entfernt | SSW/BL `counselor.js` |
| -- | Frontend: Eingabefeld + Anzeige entfernt | `CounselorBookingApp.tsx`, `BLAdmin.tsx` |
| -- | Types bereinigt | `src/types/index.ts` |
| -- | Dateninventar aktualisiert | `dsgvo-dateninventar.md` |

### Ergebnis

- Keine Art.-9-Daten mehr in der Anwendung
- DSFA, Zugriffsbeschraenkung, Art.-9-Consent und Audit-Log entfallen
- Alle 4 Original-Aufgaben (0.2.1–0.2.4) als erledigt markiert

---

## Sprint 3: Consent Management (Aufgaben 0.3.1–0.3.3) – ERLEDIGT

### Umgesetzte Massnahmen

| # | Massnahme | Dateien |
|---|-----------|---------|
| 036 | Migration: `consent_receipts` Tabelle (append-only) | `backend/migrations/036_consent_receipts.sql` |
| 0.3.1 | Consent-Receipt bei jeder Buchung (SSW/BL/EST) | `counselorPublicRoutes.js`, `elternsprechtag/routes/public.js` |
| 0.3.2 | Frontend sendet consent_version (ssw-v2, bl-v2, est-v2) | `ConsentCheckbox.tsx`, `CounselorBookingApp.tsx`, `BookingForm.tsx` |
| 0.3.3 | Widerruf-Endpunkt POST /api/consent/withdraw | `backend/routes/consent.js` |

### Ergebnis

- Jede Buchung erzeugt einen nachweisbaren Consent-Receipt (Art. 7 Abs. 1)
- Consent-Version versioniert (ssw-v2, bl-v2, est-v2) + Zweck dokumentiert
- Widerruf anonymisiert Buchungsdaten, Receipt bleibt erhalten
- Rate-Limiting auf Widerruf-Endpunkt

---

## Sprint 4: Informationspflichten & Verarbeitungsverzeichnis (0.4.1–0.4.3, 0.5.1–0.5.2)

**Fokus:** Rechtliche Dokumente und Transparenzpflichten – Art. 13/14, Art. 30.

### Aufgaben

| # | Aufgabe | Dateien |
|---|---------|---------|
| 0.4.1 | Datenschutzseite vervollstaendigen | `src/pages/Datenschutz.tsx` |
| 0.4.2 | Datenschutz-Footer in E-Mail-Templates | `backend/emails/template.js` |
| 0.4.3 | DSB-Kontaktdaten konfigurierbar | `backend/config/` oder `site_branding` |
| 0.5.1 | Verarbeitungsverzeichnis (Art. 30 Abs. 1) | `docs/compliance/verarbeitungsverzeichnis.md` (neu) |
| 0.5.2 | AV-Verzeichnis (Art. 30 Abs. 2) | `docs/compliance/av-verzeichnis.md` (neu) |

### Reihenfolge

1. **0.5.1 + 0.5.2** – Formale Dokumente (koennen parallel erstellt werden)
2. **0.4.3** – DSB-Config (wird von 0.4.1 und 0.4.2 benoetigt)
3. **0.4.2** – E-Mail-Footer (Backend vor Frontend)
4. **0.4.1** – Datenschutzseite (nutzt DSB-Config, referenziert VVT)

### Review & Security

- **Pruefer-Agent** vor Commits
- **Dokumentar-Agent** fuer VVT und AV-Verzeichnis
- Datenschutzerklaerung: Alle Module (Elternsprechtag, SSW, BL) abgedeckt?
- E-Mail-Footer: Alle Templates pruefen, keines vergessen
- VVT/AV-Verzeichnis von DSB oder Rechtsberatung gegenlesen lassen

### Dokumentation

- Verarbeitungsverzeichnis (`docs/compliance/verarbeitungsverzeichnis.md`)
- AV-Verzeichnis (`docs/compliance/av-verzeichnis.md`)
- `dsgvo-saas-todo.md` Checkboxen aktualisieren
- `docs/index.md` um neue Compliance-Dokumente erweitern

---

## Uebersicht

| Sprint | Thema | Aufgaben | Abhaengigkeiten |
|--------|-------|----------|-----------------|
| 1 | Loeschkonzept | 0.1.1–0.1.5 (5) | Keine – kann sofort starten |
| 2 | Art.-9-Schutz | 0.2.1–0.2.4 (4) | Teilweise auf Sprint 1 (Anonymisierung) |
| 3 | Consent Management | 0.3.1–0.3.3 (3) | Unabhaengig, aber nach Sprint 1 sinnvoll |
| 4 | Informationspflichten & VVT | 0.4.1–0.4.3, 0.5.1–0.5.2 (5) | Nutzt Ergebnisse aus Sprint 1–3 |

### Durchgaengige Qualitaetssicherung

- **Vor jedem Commit:** `pruefer`-Agent – alle "Kritisch"/"Hoch"-Befunde beheben
- **Pro Sprint-Ende:** `waechter`-Agent fuer Security-Scan
- **Pro Sprint-Ende:** `konsistenzpruefer`-Agent fuer Pattern-Einhaltung
- **Nach Sprint 4:** `dokumentar`-Agent fuer Gesamtabgleich Code <-> Dokumentation
- **Nach Sprint 4:** `npm run build` – Frontend muss fehlerfrei bauen
- **Fortschritts-Tracker** in `dsgvo-saas-todo.md` nach jeder abgeschlossenen Aufgabe aktualisieren

### Commit-Konvention

```
feat(dsgvo): Anonymisierung booking_requests bei Event-Abschluss
fix(ssw): PII bei Cancel nullen
feat(consent): consent_receipts Tabelle + Receipt-Speicherung
docs(compliance): Verarbeitungsverzeichnis Art. 30
```
