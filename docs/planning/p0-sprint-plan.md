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

## Sprint 2: Art.-9-Datenschutz (Aufgaben 0.2.1–0.2.4)

**Fokus:** Besondere Datenkategorien (psychosoziale Beratung) schuetzen – DSGVO Art. 9, Art. 35.

### Aufgaben

| # | Aufgabe | Dateien |
|---|---------|---------|
| 0.2.1 | DSFA (Datenschutz-Folgenabschaetzung) erstellen | `docs/compliance/dsfa-ssw-bl.md` (neu) |
| 0.2.2 | Zugriffsbeschraenkung auf zugewiesenen Berater | `backend/modules/schulsozialarbeit/routes/counselor.js`, `backend/modules/beratungslehrer/routes/counselor.js` |
| 0.2.4 | Audit-Log fuer concern/notes-Zugriff | `backend/middleware/audit-log.js` (neu), Migration |
| 0.2.3 | Explizite Art.-9-Einwilligung | `src/components/ConsentCheckbox.tsx` (erweitern) |

### Reihenfolge

1. **0.2.1** – DSFA-Dokument (formale Pflicht, informiert technische Umsetzung)
2. **0.2.2** – Backend: Zugriffsbeschraenkung implementieren
3. **0.2.4** – Audit-Log-Middleware + Migration (setzt auf 0.2.2 auf)
4. **0.2.3** – Frontend: Art.-9-Consent-Komponente (Backend vor Frontend)

### Review & Security

- **Waechter-Agent** fuer Zugriffskontroll-Logik
- **Pruefer-Agent** vor Commits
- Test: Berater A darf concern/notes von Berater B NICHT sehen
- Test: Admin/Superadmin sieht alle Daten
- Test: Audit-Log-Eintraege bei Zugriff auf concern/notes pruefen
- DSFA-Dokument von DSB oder Rechtsberatung gegenlesen lassen

### Dokumentation

- DSFA-Dokument (`docs/compliance/dsfa-ssw-bl.md`)
- Audit-Log-Schema dokumentieren
- `dsgvo-saas-todo.md` Checkboxen aktualisieren

---

## Sprint 3: Consent Management (Aufgaben 0.3.1–0.3.3)

**Fokus:** Nachweisbare Einwilligung gemaess Art. 7 – Consent speichern, versionieren, widerrufen.

### Aufgaben

| # | Aufgabe | Dateien |
|---|---------|---------|
| 0.3.1 | Consent-Receipt in DB (append-only) | `backend/migrations/035_consent_receipts.sql`, `backend/modules/*/routes/public.js` |
| 0.3.2 | Consent-Version und Zweck speichern | `src/components/ConsentCheckbox.tsx`, `backend/modules/*/routes/public.js` |
| 0.3.3 | Widerruf-Endpunkt | `backend/routes/public/consent.js` (neu) |

### Reihenfolge

1. **0.3.1** – Migration + Backend-Logik fuer consent_receipts
2. **0.3.2** – Frontend + Backend: Version/Zweck in Consent-Flow integrieren
3. **0.3.3** – Widerruf-Endpunkt (baut auf consent_receipts-Tabelle auf)

### Review & Security

- **Pruefer-Agent** vor Commits
- Rate-Limiting auf Widerruf-Endpunkt (oeffentlich zugaenglich)
- Test: Buchung → consent_receipts-Eintrag mit Timestamp, IP, Version pruefen
- Test: Widerruf → Daten anonymisiert/geloescht, consent_receipt unveraendert
- Consent-Receipts muessen append-only sein (kein UPDATE/DELETE)

### Dokumentation

- Consent-Schema in Dateninventar aufnehmen
- Consent-Version-Strategie dokumentieren
- `dsgvo-saas-todo.md` Checkboxen aktualisieren

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
