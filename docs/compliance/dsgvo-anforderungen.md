# DSGVO-Anforderungen – SaaS Schulverwaltungs-Buchungstool

> **Zweck:** Vollstaendiger Anforderungskatalog fuer DSGVO-Konformitaet des SaaS Booking Tools.
> Single Source of Truth fuer Entwicklung, Code-Reviews und Agents.
>
> **Stand:** 2026-03-17
> **Geltungsbereich:** Alle API-Endpoints und Module, die personenbezogene Daten verarbeiten
> **Regulatorischer Rahmen:** DSGVO (EU) 2016/679, ePrivacy-Richtlinie 2002/58/EG
> **IST-Zustand:** Siehe [DB-Audit](../security/db-audit-2026-03-17.md) und [Dateninventar](dsgvo-dateninventar.md)
> **Umsetzungsplan:** Siehe [DSGVO SaaS-ToDo](dsgvo-saas-todo.md)

---

## Legende

| Kuerzel | Bedeutung |
|---------|-----------|
| `HOCH` | Muss vor Go-Live implementiert sein |
| `MITTEL` | Sollte zeitnah nach Go-Live umgesetzt werden |
| `PFLICHT` | Gesetzlich zwingend erforderlich |
| `EMPFOHLEN` | Best Practice / Stand der Technik |

---

## 1. Rechtsgrundlagen der Verarbeitung (Art. 6 DSGVO)

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| RG-001 | Einwilligung (Consent Management) | Art. 6(1)(a), Art. 7 | Einwilligungen einholen, speichern, nachweisen und widerrufen. Freiwillig, informiert, unmissverstaendlich und zweckgebunden. | HOCH |
| RG-002 | Vertragserfuellung | Art. 6(1)(b) | Nur buchungsrelevante Pflichtfelder (Name, E-Mail, Zeitraum). Klare Trennung Pflicht- vs. optionale Felder. | HOCH |
| RG-003 | Rechtliche Verpflichtung | Art. 6(1)(c) | Aufbewahrungsfristen (steuerlich 6-10 Jahre, handelsrechtlich). Automatische Anonymisierung/Loeschung nach Fristablauf. | HOCH |
| RG-004 | Berechtigtes Interesse | Art. 6(1)(f) | Dokumentierte Interessenabwaegung bei Analytics, Fraud Detection, Systemsicherheit. Widerspruchsmoeglichkeit. | MITTEL |

### Technische Umsetzung

- `POST /api/consent` – Einwilligung erteilen (Timestamp, IP, Version, Zweck)
- `GET /api/consent/{userId}` – Einwilligungen abrufen
- `DELETE /api/consent/{userId}/{purpose}` – Widerruf
- Datenminimierung: Nur Pflichtfelder in Buchungs-Endpoints
- Retention-Policy-Engine mit konfigurierbaren Fristen je Datentyp

---

## 2. Betroffenenrechte (Art. 12-23 DSGVO)

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| BR-001 | Recht auf Auskunft | Art. 15 | Alle gespeicherten Daten in maschinenlesbarem Format. Frist: 1 Monat. | HOCH |
| BR-002 | Recht auf Berichtigung | Art. 16 | Fehlerhafte/unvollstaendige Daten korrigieren. Aenderungshistorie fuehren. | HOCH |
| BR-003 | Recht auf Loeschung | Art. 17 | Kaskadierte Loeschung inkl. Backups, Logs, Cache. Sperrliste fuer gesetzliche Retention. | HOCH |
| BR-004 | Recht auf Einschraenkung | Art. 18 | Verarbeitung temporaer sperren (z.B. bei Richtigkeitspruefung). Daten bleiben, werden aber nicht verarbeitet. | HOCH |
| BR-005 | Recht auf Datenuebertragbarkeit | Art. 20 | Export als JSON, CSV oder XML. Standardisiertes Schema. | HOCH |
| BR-006 | Widerspruchsrecht | Art. 21 | Sofortiger Verarbeitungsstopp bei Widerspruch. | HOCH |
| BR-007 | Automatisierte Einzelentscheidungen | Art. 22 | Recht auf menschliche Ueberpruefung. Erklaerung der Logik bereitstellen. | MITTEL |

### Technische Umsetzung

| Methode | Endpoint | Zweck | Auth | DSGVO |
|---------|----------|-------|------|-------|
| `GET` | `/api/data-subject/{id}/export` | Vollstaendiger Datenexport | Auth + 2FA | Art. 15 |
| `PATCH` | `/api/data-subject/{id}` | Daten berichtigen | Auth | Art. 16 |
| `DELETE` | `/api/data-subject/{id}` | Daten loeschen (kaskadiert) | Auth + 2FA | Art. 17 |
| `PUT` | `/api/data-subject/{id}/restrict` | Verarbeitung einschraenken | Auth | Art. 18 |
| `GET` | `/api/data-subject/{id}/portability` | Datenuebertragbarkeit | Auth + 2FA | Art. 20 |
| `POST` | `/api/data-subject/{id}/objection` | Widerspruch einlegen | Auth | Art. 21 |

---

## 3. Informationspflichten (Art. 13-14 DSGVO)

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| IP-001 | Informationen bei Direkterhebung | Art. 13 | Bei jeder Datenerhebung: Zweck, Rechtsgrundlage, Empfaenger, Speicherdauer, Betroffenenrechte, DSB-Kontakt. | HOCH |
| IP-002 | Informationen bei Dritterhebung | Art. 14 | Bei Datenimport von Drittquellen: Herkunft, Zweck, Rechtsgrundlage. Betroffene innerhalb 1 Monat informieren. | MITTEL |

### Technische Umsetzung

- `GET /api/privacy-notice/{context}` – Kontextbezogene Datenschutzhinweise (booking, account)
- Versionierung mit Timestamp
- Metadaten-Feld `data_source` bei Drittimport

---

## 4. Technische und Organisatorische Massnahmen (Art. 25, 32 DSGVO)

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| TOM-001 | Privacy by Design | Art. 25(1) | Datenschutz in Systemarchitektur eingebaut. Privacy-Review im PR-Prozess. | HOCH |
| TOM-002 | Privacy by Default | Art. 25(2) | Maximaler Datenschutz als Voreinstellung. Opt-out fuer Marketing. Kuerzeste Speicherdauer. | HOCH |
| TOM-003 | Verschluesselung | Art. 32(1)(a) | TLS 1.3 in Transit. AES-256 at Rest (besonders Art.-9-Daten). Schluesselrotation. | HOCH |
| TOM-004 | Pseudonymisierung | Art. 32(1)(a) | Tokenisierte IDs in Analytics, Logs und Test-Umgebungen. | HOCH |
| TOM-005 | Vertraulichkeit und Integritaet | Art. 32(1)(b) | RBAC mit Least-Privilege. API-Key-Management. Rate Limiting. | HOCH |
| TOM-006 | Verfuegbarkeit und Belastbarkeit | Art. 32(1)(b) | Redundanz, Failover, Backup-Strategie. SLA-Definition. Monitoring. | MITTEL |
| TOM-007 | Wiederherstellbarkeit | Art. 32(1)(c) | Disaster Recovery Plan. Verschluesselte Backups. Restore-Tests. RTO/RPO definiert. | MITTEL |
| TOM-008 | Regelmaessige Ueberpruefung | Art. 32(1)(d) | Penetration-Tests (jaehrlich). Security-Scans (CI/CD). Dependency-Audits. | MITTEL |

### Projektspezifischer IST-Stand

| TOM | Status | Referenz |
|-----|--------|----------|
| TOM-001 | Teilweise – kein formaler Privacy-Review-Prozess | CLAUDE.md Regel 2, 8, 10 |
| TOM-002 | Teilweise – Consent-Checkbox implementiert, keine Default-Retention | `ConsentCheckbox.tsx` |
| TOM-003 | Luecke – `rejectUnauthorized: false`, kein Encryption at Rest fuer Art.-9-Daten | `config/db.js:42` |
| TOM-005 | Aktiv – RBAC, Rate Limiting, parametrisierte Queries | `security-baseline.md` |
| TOM-006 | Teilweise – Docker Health Checks, kein formales SLA | `docker-compose.yml` |
| TOM-007 | Luecke – nur manuelles pg_dump-Skript | `security-baseline.md` Abschnitt 13 |
| TOM-008 | Luecke – kein automatisierter Security-Scan in CI/CD | – |

---

## 5. Auftragsverarbeitung (Art. 28 DSGVO)

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| AV-001 | AV-Vertrag (DPA) | Art. 28(3) | Vertragliche Regelung mit Kunden (als AV) und Sub-Prozessoren. | HOCH |
| AV-002 | Weisungsgebundenheit | Art. 28(3)(a) | Verarbeitung nur auf dokumentierte Weisung. Konfigurierbar pro Mandant. | HOCH |
| AV-003 | Sub-Auftragsverarbeiter | Art. 28(2) | Transparente, oeffentliche Liste aller Unterauftragsverarbeiter. | HOCH |
| AV-004 | Unterstuetzung bei Betroffenenrechten | Art. 28(3)(e) | Webhooks bei Data Subject Requests. Delegierte API-Aufrufe. | HOCH |

### Technische Umsetzung

| Methode | Endpoint | Zweck | Auth |
|---------|----------|-------|------|
| `GET` | `/api/dpa/templates` | AV-Vertrags-Vorlagen | Admin |
| `POST` | `/api/dpa/sign` | AV-Vertrag digital signieren | Admin |
| `GET` | `/api/sub-processors` | Unterauftragsverarbeiter-Liste | Public |

---

## 6. Datenschutz-Folgenabschaetzung (Art. 35 DSGVO)

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| DSFA-001 | DSFA-Pflicht pruefen | Art. 35(1) | Bei hohem Risiko (Profiling, besondere Kategorien) ist DSFA durchzufuehren. | HOCH |
| DSFA-002 | Systematische Beschreibung | Art. 35(7)(a) | Verarbeitungsvorgaenge, Zwecke, berechtigte Interessen beschreiben. | HOCH |

### Projektspezifische Bewertung

**DSFA ist PFLICHT** fuer dieses Projekt wegen:
- `ssw_appointments.concern` / `bl_appointments.concern` – Psychosoziale Beratungsanliegen (Art. 9 analog)
- `ssw_appointments.notes` / `bl_appointments.notes` – Interne Beraternotizen
- Verarbeitung von Daten Minderjaehriger (`student_name`, `student_class`)

---

## 7. Verzeichnis von Verarbeitungstaetigkeiten (Art. 30 DSGVO)

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| VVT-001 | Verarbeitungsverzeichnis (Verantwortlicher) | Art. 30(1) | Name/Kontakt, Zwecke, Kategorien, Empfaenger, Drittlandtransfers, Loeschfristen, TOM. | HOCH |
| VVT-002 | Verzeichnis (Auftragsverarbeiter) | Art. 30(2) | Eigenes AV-Verzeichnis mit Kategorien, Drittlandtransfers, TOM. | HOCH |

### Technische Umsetzung

- `GET /api/ropa` – Exportierbares Verzeichnis (JSON, PDF)
- `GET /api/ropa/processor` – Separates AV-Verzeichnis
- Automatische Befuellung aus API-Metadaten

### Projektspezifisch

**Status:** Fehlt komplett. Siehe [Dateninventar](dsgvo-dateninventar.md) als Ausgangsbasis.

---

## 8. Meldepflichten bei Datenpannen (Art. 33-34 DSGVO)

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| MP-001 | Meldung an Aufsichtsbehoerde | Art. 33 | Binnen 72 Stunden nach Bekanntwerden. 72h-Timer mit Eskalation. | HOCH |
| MP-002 | Benachrichtigung Betroffener | Art. 34 | Bei hohem Risiko: unverzuegliche Information in klarer Sprache. | HOCH |
| MP-003 | Dokumentation aller Verletzungen | Art. 33(5) | Alle Verletzungen dokumentieren – auch nicht meldepflichtige. | HOCH |

### Technische Umsetzung

| Methode | Endpoint | Zweck | Auth |
|---------|----------|-------|------|
| `POST` | `/api/incidents` | Datenpanne melden | Admin |
| `POST` | `/api/incidents/{id}/notify` | Betroffene benachrichtigen | Admin |
| `GET` | `/api/incidents/log` | Incident-Dokumentation (append-only) | Admin |

### Projektspezifisch

**Status:** Teilweise – Incident-Response-Plan existiert in `security-baseline.md` Abschnitt 13. Kein digitaler Workflow.

---

## 9. Internationaler Datentransfer (Art. 44-49 DSGVO)

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| DT-001 | Angemessenheitsbeschluss / Garantien | Art. 45-46 | Datenuebermittlung in Drittlaender nur mit Angemessenheitsbeschluss oder SCC/BCR. | HOCH |
| DT-002 | Standardvertragsklauseln (SCC) | Art. 46(2)(c) | SCCs bei Drittlandtransfer ohne Angemessenheitsbeschluss. | HOCH |
| DT-003 | Transfer Impact Assessment | Art. 46 | Bewertung Schutzniveau im Empfaengerland (Schrems II). | MITTEL |

### Projektspezifisch

**Status:** Kein Drittlandtransfer aktuell geplant. Hosting auf IONOS (DE/EU). E-Mail via Nodemailer (selbstgehostet oder Ethereal-Dev). Bei SaaS-Betrieb mit Kunden ausserhalb EU relevant.

---

## 10. Logging, Audit und Nachweispflichten (Art. 5 Abs. 2 DSGVO)

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| AU-001 | Rechenschaftspflicht | Art. 5(2) | Umfassendes Audit-Log: Wer, Was, Wann, Warum. Append-only. Mind. 3 Jahre. | HOCH |
| AU-002 | Zugriffsprotokolle | Art. 5(2), Art. 32 | Alle Zugriffe auf PII protokollieren (lesend + schreibend). SIEM-Integration. | HOCH |
| AU-003 | Einwilligungsnachweis | Art. 7(1) | Consent-Receipt: Timestamp, IP, User-Agent, Version, Zweck. Unveraenderbar. | HOCH |

### Projektspezifisch

**Status:** Pino-Logging aktiv (JSON in Prod). Kein PII-spezifisches Audit-Log. Kein Consent-Receipt.

---

## 11. Grundsaetze der Verarbeitung (Art. 5 DSGVO)

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| GS-001 | Datenminimierung | Art. 5(1)(c) | Nur zweckerforderliche Daten erheben. Feld-Level-Validierung. | HOCH |
| GS-002 | Speicherbegrenzung | Art. 5(1)(e) | Automatische Loeschung/Anonymisierung nach Retention-Period. | HOCH |
| GS-003 | Zweckbindung | Art. 5(1)(b) | Purpose-Binding pro Datenfeld. Pruefung bei jedem API-Aufruf. | HOCH |
| GS-004 | Richtigkeit | Art. 5(1)(d) | Validierungsregeln. Self-Service-Update fuer Betroffene. | MITTEL |
| GS-005 | Rechtmaessigkeit und Transparenz | Art. 5(1)(a) | Rechtsgrundlage pro Verarbeitungsschritt dokumentiert und abrufbar. | HOCH |

---

## 12. Booking-Tool-spezifische Anforderungen

| ID | Anforderung | Artikel | Details | Prioritaet |
|----|-------------|---------|---------|------------|
| BK-001 | Schuelerdaten-Verarbeitung | Art. 6, Art. 9 | Besondere Kategorien (concern/notes bei SSW/BL) erfordern explizite Einwilligung und besonderen Schutz. | HOCH |
| BK-002 | Multi-Tenancy und Mandantentrennung | Art. 28, Art. 32 | Strikte Datentrennung. Kein mandantenuebergreifender Zugriff. Tenant-ID in jedem Request. | HOCH |
| BK-003 | Buchungsbestaetigungen und E-Mails | Art. 6, Art. 13 | Transaktionale E-Mails mit Datenschutz-Footer. Marketing nur mit Double Opt-in. | MITTEL |
| BK-004 | Cookie und Tracking (ePrivacy) | Art. 6, ePrivacy-RL | Cookies nur mit vorheriger Einwilligung (ausser technisch notwendige). Granulare Wahl. | HOCH |

### Projektspezifisch

| BK | Status | Referenz |
|----|--------|----------|
| BK-001 | Teilweise – Consent-Checkbox vorhanden, kein erhoehter Schutz fuer Art.-9-Felder | `ConsentCheckbox.tsx`, `dsgvo-consent-checkbox.md` |
| BK-002 | Geloest – VPS + separate DB pro Schule (physische Isolation). Siehe `docs/architecture/multi-tenancy.md` | Entscheidung 2026-03-18 |
| BK-003 | Teilweise – E-Mail-Escaping vorhanden, kein Datenschutz-Footer in allen Templates | `email-flows.md` |
| BK-004 | Nicht implementiert – nur httpOnly Session-Cookie (technisch notwendig) | `security-baseline.md` |

---

## Referenzen

| Dokument | Pfad |
|----------|------|
| Dateninventar | `docs/compliance/dsgvo-dateninventar.md` |
| SaaS-ToDo | `docs/compliance/dsgvo-saas-todo.md` |
| DB-Audit | `docs/security/db-audit-2026-03-17.md` |
| Security Baseline | `docs/security/security-baseline.md` |
| Consent-Checkbox Planung | `docs/planning/dsgvo-consent-checkbox.md` |
| Architektur | `docs/architecture/system-design.md` |
