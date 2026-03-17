# DSGVO-Anforderungen – SaaS Booking Tool API-Schnittstelle

> **Zweck:** Diese Datei definiert alle datenschutzrechtlichen Anforderungen an die DSGVO-Schnittstelle des SaaS Booking Tools. Sie dient als Single Source of Truth für Entwicklung, Code-Reviews und KI-gestützte Agents.
>
> **Letzte Aktualisierung:** 2026-03-17
> **Geltungsbereich:** Alle API-Endpoints, die personenbezogene Daten verarbeiten
> **Regulatorischer Rahmen:** DSGVO (EU) 2016/679, ePrivacy-Richtlinie 2002/58/EG

---

## Legende

| Kürzel | Bedeutung |
|--------|-----------|
| `HOCH` | Muss vor Go-Live implementiert sein |
| `MITTEL` | Sollte zeitnah nach Go-Live umgesetzt werden |
| `PFLICHT` | Gesetzlich zwingend erforderlich |
| `EMPFOHLEN` | Best Practice / Stand der Technik |

---

## 1. Rechtsgrundlagen der Verarbeitung (Art. 6 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| RG-001 | Einwilligung (Consent Management) | Art. 6(1)(a), Art. 7 | API muss Einwilligungen einholen, speichern, nachweisen und widerrufen können. Einwilligung muss freiwillig, informiert, unmissverständlich und für bestimmten Zweck erteilt sein. | `POST /consent` – Einwilligung erteilen; `GET /consent/{userId}` – Einwilligungen abrufen; `DELETE /consent/{userId}/{purpose}` – Widerruf. Versionierung, Timestamp, IP-Adresse speichern. | HOCH |
| RG-002 | Vertragserfüllung | Art. 6(1)(b) | Verarbeitung personenbezogener Daten, die zur Buchungsabwicklung zwingend notwendig sind (Name, E-Mail, Buchungszeitraum). Keine Übererhebung. | Datenminimierung: Nur buchungsrelevante Pflichtfelder in `POST /bookings`. Klare Trennung zwischen Pflicht- und optionalen Feldern. | HOCH |
| RG-003 | Rechtliche Verpflichtung | Art. 6(1)(c) | Aufbewahrungsfristen z.B. steuerliche Pflichten (6–10 Jahre), handelsrechtliche Pflichten. Daten dürfen nach Ablauf nicht weiter gespeichert werden. | Retention-Policy-Engine mit konfigurierbaren Fristen je Datentyp. Automatische Anonymisierung/Löschung nach Fristablauf. | HOCH |
| RG-004 | Berechtigtes Interesse | Art. 6(1)(f) | Dokumentierte Interessenabwägung bei Analytics, Fraud Detection, Systemsicherheit. Betroffene müssen widersprechen können. | Logging der Rechtsgrundlage pro Verarbeitungszweck im Audit-Trail. Widerspruchsmöglichkeit via `POST /data-subject/{id}/objection`. | MITTEL |

---

## 2. Betroffenenrechte (Art. 12–23 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| BR-001 | Recht auf Auskunft | Art. 15 | Betroffene müssen alle über sie gespeicherten Daten vollständig und in maschinenlesbarem Format erhalten können. Frist: 1 Monat. | `GET /data-subject/{id}/export` – JSON/CSV-Export aller personenbezogenen Daten inkl. Verarbeitungszwecke, Empfänger, Speicherdauer. | HOCH |
| BR-002 | Recht auf Berichtigung | Art. 16 | Betroffene können fehlerhafte oder unvollständige Daten korrigieren lassen. Änderungen müssen nachvollziehbar sein. | `PATCH /data-subject/{id}` – Änderungshistorie mit Timestamp, altem und neuem Wert. Benachrichtigung an Empfänger der Daten. | HOCH |
| BR-003 | Recht auf Löschung | Art. 17 | Daten müssen auf Anfrage gelöscht werden, sofern keine Aufbewahrungspflicht besteht. Betrifft auch Backups und Logs. | `DELETE /data-subject/{id}` – Kaskadierte Löschung inkl. Backups, Logs, Cache. Sperrliste für gesetzliche Retention. Löschbestätigung an Betroffenen. | HOCH |
| BR-004 | Recht auf Einschränkung | Art. 18 | Verarbeitung muss temporär gesperrt werden können (z.B. bei Prüfung der Richtigkeit). Daten bleiben gespeichert, werden aber nicht verarbeitet. | `PUT /data-subject/{id}/restrict` – Markierung `restricted=true`. Verarbeitungssperre in allen Services. Nur Speicherung erlaubt. | HOCH |
| BR-005 | Recht auf Datenübertragbarkeit | Art. 20 | Export aller bereitgestellten Daten in strukturiertem, maschinenlesbarem Format. | `GET /data-subject/{id}/portability` – Export als JSON, CSV oder XML. Standardisiertes Schema. Direkte Übertragung an anderen Anbieter optional. | HOCH |
| BR-006 | Widerspruchsrecht | Art. 21 | Widerspruch gegen Verarbeitung auf Basis berechtigter Interessen oder Direktwerbung. Verarbeitung muss sofort eingestellt werden. | `POST /data-subject/{id}/objection` – Sofortiger Verarbeitungsstopp. Webhook-Benachrichtigung an alle verbundenen Systeme/Services. | HOCH |
| BR-007 | Automatisierte Einzelentscheidungen | Art. 22 | Recht, nicht einer ausschließlich automatisierten Entscheidung mit rechtlicher Wirkung unterworfen zu werden. | Flag `automated_decision=true` in API-Responses. Endpoint `POST /data-subject/{id}/human-review` für manuelle Überprüfung. Erklärung der Logik bereitstellen. | MITTEL |

---

## 3. Informationspflichten (Art. 13–14 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| IP-001 | Informationen bei Direkterhebung | Art. 13 | Bei jeder Datenerhebung (Buchung, Account-Erstellung): Zweck, Rechtsgrundlage, Empfänger, Speicherdauer, Betroffenenrechte, DSB-Kontakt mitteilen. | `GET /privacy-notice/{context}` – Kontextbezogene Datenschutzhinweise (booking, account, newsletter). Versioniert mit Timestamp. | HOCH |
| IP-002 | Informationen bei Dritterhebung | Art. 14 | Bei Datenimport von Drittquellen (z.B. Channel-Manager, OTAs): Herkunft, Zweck und Rechtsgrundlage dokumentieren. Betroffene innerhalb 1 Monat informieren. | Metadaten-Feld `data_source` in jedem Datensatz. `GET /data-sources/{recordId}` für Herkunftsnachweis. Automatische Benachrichtigung bei Drittimport. | MITTEL |

---

## 4. Technische & Organisatorische Maßnahmen (Art. 25, 32 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| TOM-001 | Privacy by Design | Art. 25(1) | Datenschutz muss von Beginn an in die Systemarchitektur eingebaut sein. Jede neue Funktion muss auf Datenschutz-Konformität geprüft werden. | Minimale Datenerhebung als Default. Pseudonymisierung in allen nicht-primären Systemen (Analytics, Logs). Privacy-Review im PR-Prozess. | HOCH |
| TOM-002 | Privacy by Default | Art. 25(2) | Voreinstellungen müssen den maximalen Datenschutz gewährleisten. Nutzer müssen aktiv mehr Datenverarbeitung erlauben. | Default: Opt-out für Marketing. Minimale Datenfelder. Kürzeste Speicherdauer. Keine vorausgewählten Checkboxen. | HOCH |
| TOM-003 | Verschlüsselung | Art. 32(1)(a) | Verschlüsselung personenbezogener Daten sowohl bei der Übertragung (in Transit) als auch bei der Speicherung (at Rest). | TLS 1.3 für alle API-Endpunkte. AES-256 für Datenbank-Verschlüsselung. Regelmäßige Schlüsselrotation. Certificate Pinning. | HOCH |
| TOM-004 | Pseudonymisierung | Art. 32(1)(a) | Personenbezogene Daten pseudonymisieren wo immer möglich, insbesondere in Sekundärsystemen. | Pseudonymisierungs-Mapping-Tabelle (separater Speicher). Tokenisierte IDs in Analytics, Logs und Test-Umgebungen. | HOCH |
| TOM-005 | Vertraulichkeit & Integrität | Art. 32(1)(b) | Zugangskontrollen, starke Authentifizierung, rollenbasierte Autorisierung. Schutz vor unbefugtem Zugriff. | OAuth 2.0 / OpenID Connect. RBAC mit Least-Privilege-Prinzip. API-Key-Management mit Rotation. Rate Limiting. IP-Whitelisting optional. | HOCH |
| TOM-006 | Verfügbarkeit & Belastbarkeit | Art. 32(1)(b) | System muss verfügbar und belastbar sein. Ausfälle dürfen nicht zum Datenverlust führen. | Redundanz, Failover, Backup-Strategie. SLA-Definition (99.9%+). `GET /health` und `GET /ready` Endpoints. Monitoring & Alerting. | MITTEL |
| TOM-007 | Wiederherstellbarkeit | Art. 32(1)(c) | Rasche Wiederherstellung der Verfügbarkeit und des Zugangs zu personenbezogenen Daten bei technischem Zwischenfall. | Disaster Recovery Plan. Automatisierte Backups (verschlüsselt). Regelmäßige Restore-Tests. RTO/RPO definiert. | MITTEL |
| TOM-008 | Regelmäßige Überprüfung | Art. 32(1)(d) | Verfahren zur regelmäßigen Überprüfung, Bewertung und Evaluierung der Wirksamkeit der TOM. | Penetration-Tests (jährlich). Automatisierte Security-Scans (CI/CD). Dependency-Audits. OWASP Top 10 Compliance. | MITTEL |

---

## 5. Auftragsverarbeitung (Art. 28 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| AV-001 | AV-Vertrag (DPA) | Art. 28(3) | Vertragliche Regelung mit allen Kunden (als Auftragsverarbeiter) und mit eigenen Sub-Prozessoren. Mindestinhalte gemäß Art. 28(3). | `GET /dpa/templates` – Vorlagen. `POST /dpa/sign` – Digitale AV-Vertrags-Verwaltung mit Versionierung. | HOCH |
| AV-002 | Weisungsgebundenheit | Art. 28(3)(a) | Verarbeitung ausschließlich auf dokumentierte Weisung des Verantwortlichen. Abweichungen müssen gemeldet werden. | Processing-Instructions als konfigurierbare Parameter pro Mandant. Warnmechanismus bei Weisungsabweichung. | HOCH |
| AV-003 | Sub-Auftragsverarbeiter | Art. 28(2) | Einsatz von Unterauftragsverarbeitern nur mit vorheriger Genehmigung. Transparente Liste erforderlich. | `GET /sub-processors` – Öffentlich zugängliche, aktuelle Liste aller Unterauftragsverarbeiter. Benachrichtigung bei Änderungen. | HOCH |
| AV-004 | Unterstützung bei Betroffenenrechten | Art. 28(3)(e) | Auftragsverarbeiter muss den Verantwortlichen bei der Erfüllung von Betroffenenrechten unterstützen. | Webhooks bei Data Subject Requests. Delegierte API-Aufrufe an Mandanten. Automatische Weiterleitung. | HOCH |

---

## 6. Datenschutz-Folgenabschätzung (Art. 35 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| DSFA-001 | DSFA-Pflicht prüfen | Art. 35(1) | Bei hohem Risiko für Rechte und Freiheiten natürlicher Personen ist eine DSFA durchzuführen. Insbesondere bei Profiling, umfangreicher Verarbeitung besonderer Kategorien. | Risk-Assessment-Modul: `GET /dpia/risk-assessment/{processingActivity}`. Automatische Risikobewertung basierend auf Datentypen und Verarbeitungsumfang. | HOCH |
| DSFA-002 | Systematische Beschreibung | Art. 35(7)(a) | Systematische Beschreibung der Verarbeitungsvorgänge, Zwecke, berechtigten Interessen. | `GET /processing-activities` – Maschinenlesbare Verarbeitungsübersicht. Automatisch generiert aus API-Metadaten und Endpoint-Registrierung. | HOCH |

---

## 7. Verzeichnis von Verarbeitungstätigkeiten (Art. 30 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| VVT-001 | Verarbeitungsverzeichnis (Verantwortlicher) | Art. 30(1) | Vollständiges Verzeichnis mit: Name/Kontakt, Zwecke, Kategorien betroffener Personen, Datenkategorien, Empfänger, Drittlandtransfers, Löschfristen, TOM-Beschreibung. | `GET /ropa` – Exportierbares Verzeichnis (JSON, PDF). Automatische Befüllung aus API-Metadaten und Endpoint-Konfiguration. | HOCH |
| VVT-002 | Verzeichnis (Auftragsverarbeiter) | Art. 30(2) | Als SaaS-Anbieter: Eigenes AV-Verzeichnis mit Kategorien der Verarbeitung, Drittlandtransfers und TOM. | Mandanten-spezifische Verarbeitungsübersicht. `GET /ropa/processor` – Separates AV-Verzeichnis. | HOCH |

---

## 8. Meldepflichten bei Datenpannen (Art. 33–34 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| MP-001 | Meldung an Aufsichtsbehörde | Art. 33 | Datenschutzverletzungen müssen binnen 72 Stunden nach Bekanntwerden an die zuständige Aufsichtsbehörde gemeldet werden. | `POST /incidents` – Incident-Management-Workflow. Automatische Fristberechnung (72h-Timer). Eskalation bei Fristablauf. Pflichtfelder gemäß Art. 33(3). | HOCH |
| MP-002 | Benachrichtigung Betroffener | Art. 34 | Bei hohem Risiko für Rechte und Freiheiten müssen Betroffene unverzüglich in klarer Sprache informiert werden. | `POST /incidents/{id}/notify` – Massenbenachrichtigung via E-Mail/Push. Mehrsprachige Templates. Dokumentation der Benachrichtigung. | HOCH |
| MP-003 | Dokumentation aller Verletzungen | Art. 33(5) | Alle Datenschutzverletzungen dokumentieren – auch solche, die nicht meldepflichtig sind. Inkl. Fakten, Auswirkungen, Abhilfemaßnahmen. | `GET /incidents/log` – Vollständige, unveränderbare Dokumentation inkl. Maßnahmen, Bewertung und Ergebnis. | HOCH |

---

## 9. Internationaler Datentransfer (Art. 44–49 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| DT-001 | Angemessenheitsbeschluss / Garantien | Art. 45–46 | Datenübermittlung in Drittländer nur bei Angemessenheitsbeschluss der EU-Kommission oder geeigneten Garantien (SCC, BCR). | Konfiguration pro Mandant: Erlaubte Regionen / Datenresidenz-Einstellungen. Geo-Routing der API-Requests. | HOCH |
| DT-002 | Standardvertragsklauseln (SCC) | Art. 46(2)(c) | Bei Drittlandtransfer ohne Angemessenheitsbeschluss: SCCs nach EU-Kommissions-Beschluss abschließen. | `GET /scc/status` – Übersicht aller SCC-Status. Digitale Signatur-Integration. Fälligkeits-Erinnerungen. | HOCH |
| DT-003 | Transfer Impact Assessment | Art. 46 | Bewertung des Schutzniveaus im Empfängerland. Berücksichtigung lokaler Gesetze (Schrems II). | `GET /tia/{countryCode}` – TIA-Dokumentation pro Drittland-Verbindung. Regelmäßige Neubewertung. | MITTEL |

---

## 10. Logging, Audit & Nachweispflichten (Art. 5 Abs. 2 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| AU-001 | Rechenschaftspflicht | Art. 5(2) | Nachweis der Einhaltung aller DSGVO-Grundsätze. Verantwortlicher muss Compliance jederzeit belegen können. | Umfassendes Audit-Log: `GET /audit-log` – Wer, Was, Wann, Warum. Append-only / unveränderbar. Aufbewahrung mind. 3 Jahre. | HOCH |
| AU-002 | Zugriffsprotokolle | Art. 5(2), Art. 32 | Alle Zugriffe auf personenbezogene Daten müssen protokolliert werden – lesend und schreibend. | Access-Logging für alle `/data-subject/*` Endpoints. SIEM-Integration. Anomalie-Erkennung bei ungewöhnlichen Zugriffsmustern. | HOCH |
| AU-003 | Einwilligungsnachweis | Art. 7(1) | Nachweispflicht, dass und wann eine wirksame Einwilligung erteilt wurde. Beweislast liegt beim Verantwortlichen. | Consent-Receipt: Timestamp, IP-Adresse, User-Agent, Version der Einwilligungserklärung, Scope/Zweck. Unveränderbar gespeichert. | HOCH |

---

## 11. Grundsätze der Verarbeitung (Art. 5 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| GS-001 | Datenminimierung | Art. 5(1)(c) | Nur die für den jeweiligen Zweck erforderlichen Daten erheben. Keine „auf Vorrat"-Speicherung. | Feld-Level-Validierung: Pflichtfelder vs. optionale Felder pro Buchungstyp. Schema-Validierung in der API. Reject bei Übererhebung. | HOCH |
| GS-002 | Speicherbegrenzung | Art. 5(1)(e) | Daten nur so lange speichern wie für den Zweck erforderlich. Danach löschen oder anonymisieren. | Automatische Löschung/Anonymisierung nach Ablauf der Retention-Period. Cron-Jobs mit Logging. Konfigurierbar pro Datentyp. | HOCH |
| GS-003 | Zweckbindung | Art. 5(1)(b) | Daten dürfen nur für den festgelegten, eindeutigen und legitimen Zweck verarbeitet werden. Zweckänderung erfordert neue Rechtsgrundlage. | Purpose-Binding pro Datenfeld. Prüfung bei jedem API-Aufruf gegen erlaubte Zwecke. Logging bei Zweckänderung. | HOCH |
| GS-004 | Richtigkeit | Art. 5(1)(d) | Personenbezogene Daten müssen sachlich richtig und auf dem neuesten Stand sein. Unrichtige Daten unverzüglich berichtigen oder löschen. | Validierungsregeln (E-Mail, Telefon, Adresse). Self-Service-Update via `PATCH /data-subject/{id}`. Datenqualitäts-Checks. | MITTEL |
| GS-005 | Rechtmäßigkeit & Transparenz | Art. 5(1)(a) | Jede Verarbeitung muss rechtmäßig, transparent und für Betroffene nachvollziehbar sein. | Rechtsgrundlage pro Verarbeitungsschritt dokumentiert und abrufbar. Transparente, öffentliche API-Dokumentation. | HOCH |

---

## 12. Datenschutzbeauftragter & Zusammenarbeit (Art. 37–39 DSGVO)

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| DSB-001 | DSB-Kontakt bereitstellen | Art. 37–39 | Kontaktdaten des Datenschutzbeauftragten müssen veröffentlicht und für Betroffene leicht erreichbar sein. | `GET /dpo/contact` – DSB-Kontaktdaten. Konfigurierbar pro Mandant. In Datenschutzhinweisen verlinkt. | MITTEL |
| DSB-002 | Zusammenarbeit mit Aufsichtsbehörde | Art. 31 | Auf Anfrage mit der Aufsichtsbehörde zusammenarbeiten. Alle relevanten Informationen bereitstellen. | Export-Funktionen für behördliche Anfragen: `GET /authority-request/{id}`. Strukturierter Daten-Export. | MITTEL |

---

## 13. Booking-Tool-spezifische Anforderungen

| ID | Anforderung | Artikel | Details | Technische Umsetzung | Priorität |
|----|-------------|---------|---------|----------------------|-----------|
| BK-001 | Gästedaten-Verarbeitung | Art. 6, Art. 9 | Besondere Kategorien personenbezogener Daten (z.B. Gesundheitsdaten bei Allergien, Barrierefreiheit) erfordern explizite Einwilligung und besonderen Schutz. | Separate Consent-Flows für sensible Daten (Art. 9). Verschlüsselte Speicherung. Zugriffsbeschränkung auf Need-to-know-Basis. | HOCH |
| BK-002 | Zahlungsdaten (PCI DSS + DSGVO) | Art. 5, Art. 32 | Zahlungsdaten unterliegen zusätzlich PCI DSS. Kartendaten dürfen nicht im eigenen System gespeichert werden. | Keine Speicherung von Kartendaten. Payment-Token via PSP (Stripe, Adyen). PCI-konforme Schnittstelle. Tokenisierung. | HOCH |
| BK-003 | Buchungsbestätigungen & E-Mails | Art. 6, Art. 13 | Transaktionale E-Mails müssen Datenschutzhinweise enthalten. Marketing-E-Mails nur mit expliziter Einwilligung. | E-Mail-Templates mit Datenschutz-Footer. Opt-in für Marketing-Mails (Double Opt-in). Abmeldelink in jeder E-Mail. | MITTEL |
| BK-004 | Multi-Tenancy & Mandantentrennung | Art. 28, Art. 32 | Strikte Datentrennung zwischen Mandanten. Kein mandantenübergreifender Zugriff möglich. | Tenant-Isolation: Separate Datenbanken oder Row-Level-Security. API-Key pro Mandant. Tenant-ID in jedem Request validiert. | HOCH |
| BK-005 | Kalender-Integration | Art. 44–49, Art. 28 | Integration mit Drittanbieter-Kalendern (Google, Outlook) erfordert AV-Vertrag und ggf. SCC. Minimale Datenübertragung. | OAuth-Scopes minimieren. Datenfluss-Dokumentation. Consent bei Erstverbindung. Transparente Info über Drittland-Transfer. | MITTEL |
| BK-006 | Cookie & Tracking (ePrivacy) | Art. 6, ePrivacy-RL | Cookies und Tracking nur mit vorheriger Einwilligung (außer technisch notwendige). Granulare Wahlmöglichkeit. | Cookie-Consent-API: `GET /cookie-consent`, `POST /cookie-consent`. Integration mit Consent-Management-Platform (CMP). | HOCH |

---

## API-Endpoint-Referenz

Zusammenfassung aller DSGVO-relevanten Endpoints, die die Schnittstelle bereitstellen muss:

### Consent Management

| Methode | Endpoint | Zweck | Auth | DSGVO |
|---------|----------|-------|------|-------|
| `POST` | `/consent` | Einwilligung erteilen | Bearer Token | Art. 6(1)(a) |
| `GET` | `/consent/{userId}` | Einwilligungen abrufen | Bearer Token | Art. 7(1) |
| `DELETE` | `/consent/{userId}/{purpose}` | Einwilligung widerrufen | Bearer Token | Art. 7(3) |

### Betroffenenrechte

| Methode | Endpoint | Zweck | Auth | DSGVO |
|---------|----------|-------|------|-------|
| `GET` | `/data-subject/{id}/export` | Vollständiger Datenexport | Bearer Token + 2FA | Art. 15 |
| `PATCH` | `/data-subject/{id}` | Daten berichtigen | Bearer Token | Art. 16 |
| `DELETE` | `/data-subject/{id}` | Daten löschen | Bearer Token + 2FA | Art. 17 |
| `PUT` | `/data-subject/{id}/restrict` | Verarbeitung einschränken | Bearer Token | Art. 18 |
| `GET` | `/data-subject/{id}/portability` | Datenübertragbarkeit | Bearer Token + 2FA | Art. 20 |
| `POST` | `/data-subject/{id}/objection` | Widerspruch einlegen | Bearer Token | Art. 21 |
| `POST` | `/data-subject/{id}/human-review` | Manuelle Überprüfung anfordern | Bearer Token | Art. 22 |

### Transparenz & Information

| Methode | Endpoint | Zweck | Auth | DSGVO |
|---------|----------|-------|------|-------|
| `GET` | `/privacy-notice/{context}` | Datenschutzhinweise | Public | Art. 13–14 |
| `GET` | `/data-sources/{recordId}` | Datenherkunft | Bearer Token | Art. 14 |
| `GET` | `/dpo/contact` | DSB-Kontaktdaten | Public | Art. 37–39 |
| `GET` | `/sub-processors` | Unterauftragsverarbeiter | Public | Art. 28(2) |

### Compliance & Dokumentation

| Methode | Endpoint | Zweck | Auth | DSGVO |
|---------|----------|-------|------|-------|
| `GET` | `/ropa` | Verarbeitungsverzeichnis | Admin Token | Art. 30 |
| `GET` | `/ropa/processor` | AV-Verzeichnis | Admin Token | Art. 30(2) |
| `GET` | `/processing-activities` | Verarbeitungstätigkeiten | Admin Token | Art. 30 |
| `GET` | `/audit-log` | Audit-Log | Admin Token | Art. 5(2) |
| `GET` | `/dpia/risk-assessment/{activity}` | DSFA-Risikobewertung | Admin Token | Art. 35 |

### Incident Management

| Methode | Endpoint | Zweck | Auth | DSGVO |
|---------|----------|-------|------|-------|
| `POST` | `/incidents` | Datenpanne melden | Admin Token | Art. 33 |
| `POST` | `/incidents/{id}/notify` | Betroffene benachrichtigen | Admin Token | Art. 34 |
| `GET` | `/incidents/log` | Incident-Dokumentation | Admin Token | Art. 33(5) |

### Verträge & Transfer

| Methode | Endpoint | Zweck | Auth | DSGVO |
|---------|----------|-------|------|-------|
| `GET` | `/dpa/templates` | AV-Vertrags-Vorlagen | Admin Token | Art. 28 |
| `POST` | `/dpa/sign` | AV-Vertrag signieren | Admin Token | Art. 28 |
| `GET` | `/scc/status` | SCC-Status | Admin Token | Art. 46 |
| `GET` | `/tia/{countryCode}` | Transfer Impact Assessment | Admin Token | Art. 46 |

### Cookie & Tracking

| Methode | Endpoint | Zweck | Auth | DSGVO |
|---------|----------|-------|------|-------|
| `GET` | `/cookie-consent` | Cookie-Einstellungen abrufen | Public | ePrivacy-RL |
| `POST` | `/cookie-consent` | Cookie-Einwilligung setzen | Public | ePrivacy-RL |

### System

| Methode | Endpoint | Zweck | Auth | DSGVO |
|---------|----------|-------|------|-------|
| `GET` | `/health` | System-Health-Check | Public | Art. 32 |
| `GET` | `/ready` | Readiness-Check | Public | Art. 32 |

---

## Empfohlene Verzeichnisstruktur

```
src/
├── compliance/
│   ├── DSGVO_REQUIREMENTS.md    ← diese Datei
│   ├── gdpr/
│   │   ├── consent.ts           ← Consent Management Logic
│   │   ├── data-subject.ts      ← Betroffenenrechte Handler
│   │   ├── retention.ts         ← Löschfristen & Automatisierung
│   │   ├── audit.ts             ← Audit-Logging
│   │   └── types.ts             ← Shared DSGVO Types
│   └── middleware/
│       ├── purpose-check.ts     ← Zweckbindungs-Middleware
│       ├── access-log.ts        ← Zugriffs-Logging
│       └── tenant-isolation.ts  ← Mandantentrennung
```

---

## Hinweise für KI-Agents

> **Wenn du als KI-Agent Code für dieses Projekt generierst, beachte:**
>
> 1. **Jeder Endpoint, der personenbezogene Daten verarbeitet, muss eine dokumentierte Rechtsgrundlage haben** (siehe Spalte „Artikel" in den Tabellen oben).
> 2. **Datenminimierung ist Pflicht** – erhebe nur die Felder, die für den jeweiligen Zweck zwingend erforderlich sind.
> 3. **Jeder Datenzugriff muss geloggt werden** – Wer, Was, Wann, Warum.
> 4. **Löschung muss kaskadiert sein** – Backups, Logs, Cache, verbundene Services.
> 5. **Consent ist granular** – pro Zweck, nicht pauschal.
> 6. **Mandantentrennung ist nicht optional** – Tenant-ID muss in jedem Request validiert werden.
> 7. **Keine Kartendaten speichern** – Tokenisierung via PSP.
> 8. **Fristen beachten** – Auskunft: 1 Monat, Datenpanne: 72 Stunden.
> 9. **Privacy by Default** – Alle Voreinstellungen müssen den maximalen Datenschutz gewährleisten.
> 10. **Bei Unsicherheit: Restriktiver handeln** – Im Zweifel weniger Daten erheben und stärkere Schutzmaßnahmen implementieren.
