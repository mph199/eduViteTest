# Verarbeitungsverzeichnis (Art. 30 Abs. 1 DSGVO)

> **Stand:** 2026-03-18 | **Version:** 1.1
> **System:** eduViteTest – Modulares Schulverwaltungssystem

---

## 1. Angaben zum Verantwortlichen

| Feld | Wert |
|------|------|
| Verantwortlicher | [Schulname – wird aus `site_branding.responsible_name` geladen] |
| Anschrift | [wird aus `site_branding.responsible_address` geladen] |
| Datenschutzbeauftragter (DSB) | [wird aus `site_branding.dsb_name` geladen] |
| DSB-E-Mail | [wird aus `site_branding.dsb_email` geladen] |

> **Hinweis:** Konkrete Kontaktdaten werden pro Instanz in der Datenbank (`site_branding`-Tabelle) konfiguriert.

---

## 2. Verarbeitungstaetigkeiten

### 2.1 Elternsprechtag – Terminbuchung

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Organisation und Durchfuehrung von Elternsprechtagen; Terminvergabe zwischen Erziehungsberechtigten/Ausbildern und Lehrkraeften |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertragserfuellung – Schulverhaeltnis) |
| **Betroffene Personen** | Erziehungsberechtigte, Schueler/innen (Minderjaehrige), Ausbilder/Firmenvertreter, Lehrkraefte |
| **Datenkategorien** | Name, Klasse, E-Mail-Adresse, Firmenname, Nachricht (Freitext), Terminzeit |
| **Tabellen** | `booking_requests`, `slots`, `teachers` |
| **Empfaenger** | Lehrkraefte (zugewiesene Termine), Schuladministration |
| **Drittlandtransfer** | Nein (Self-Hosting) |
| **Loeschfrist** | Buchungsdaten: automatische Anonymisierung nach Event-Abschluss (konfigurierbar, Default 180 Tage). Stornierte Buchungen: 30 Tage. |
| **TOM** | HTTPS/TLS, Parametrisierte SQL-Queries, JWT httpOnly Cookies, Rollenbasierte Zugriffskontrolle, Rate-Limiting |

### 2.2 Schulsozialarbeit (SSW) – Beratungstermine

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Terminvergabe fuer schulpsychologische/sozialpädagogische Beratung |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) |
| **Betroffene Personen** | Schueler/innen (Minderjaehrige), Beratungskraefte |
| **Datenkategorien** | Name, Klasse, E-Mail, Telefon, Dringlichkeit, Beratungskategorie |
| **Tabellen** | `ssw_appointments`, `ssw_counselors` |
| **Empfaenger** | Zugewiesene Beratungsperson, Schuladministration |
| **Drittlandtransfer** | Nein (Self-Hosting) |
| **Loeschfrist** | Automatische Anonymisierung nach konfigurierter Frist (Default 365 Tage). Stornierte Termine: 30 Tage. Consent-Widerruf: sofortige Anonymisierung. |
| **TOM** | Wie 2.1, zusaetzlich: Einwilligungsnachweis via `consent_receipts` |

> **Hinweis:** Psychosoziale Freitextdaten (`concern`, `notes`) werden seit Migration 035 (2026-03-17) nicht mehr erhoben. Keine Art.-9-Daten in der Anwendung.

### 2.3 Beratungslehrer (BL) – Beratungstermine

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Terminvergabe fuer Beratungslehrkraefte |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) |
| **Betroffene Personen** | Schueler/innen (Minderjaehrige), Beratungslehrkraefte |
| **Datenkategorien** | Name, Klasse, E-Mail, Telefon, Dringlichkeit, Beratungsthema |
| **Tabellen** | `bl_appointments`, `bl_counselors` |
| **Empfaenger** | Zugewiesene Beratungslehrkraft, Schuladministration |
| **Drittlandtransfer** | Nein (Self-Hosting) |
| **Loeschfrist** | Automatische Anonymisierung nach konfigurierter Frist (Default 365 Tage). Stornierte Termine: 30 Tage. Consent-Widerruf: sofortige Anonymisierung. |
| **TOM** | Wie 2.2 |

### 2.4 Benutzerverwaltung

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Authentifizierung und Autorisierung von Lehrkraeften, Beratungskraeften und Administratoren |
| **Rechtsgrundlage** | Art. 6 Abs. 1 lit. b DSGVO (Vertragserfuellung – Arbeitsverhaeltnis) |
| **Betroffene Personen** | Lehrkraefte, Beratungskraefte, Administratoren |
| **Datenkategorien** | Benutzername, E-Mail, Passwort-Hash (bcrypt) |
| **Tabellen** | `users` |
| **Empfaenger** | Nur das System selbst (Authentifizierung) |
| **Drittlandtransfer** | Nein |
| **Loeschfrist** | Bei Entfernung aus dem System (CASCADE-Loeschung) |
| **TOM** | Bcrypt-Hashing, JWT httpOnly Cookies, Session-Timeouts |

### 2.5 Einwilligungsnachweis

| Feld | Beschreibung |
|------|-------------|
| **Zweck** | Nachweis erteilter Einwilligungen gemaess Art. 7 Abs. 1 DSGVO |
| **Rechtsgrundlage** | Art. 7 Abs. 1 DSGVO (Nachweispflicht) |
| **Betroffene Personen** | Alle Personen, die eine Buchung vornehmen |
| **Datenkategorien** | Modul, Termin-ID, Consent-Version, Verarbeitungszweck, IP-Adresse, User-Agent, Zeitstempel |
| **Tabellen** | `consent_receipts` |
| **Empfaenger** | Datenschutzbeauftragter, Aufsichtsbehoerde (auf Anfrage) |
| **Drittlandtransfer** | Nein |
| **Loeschfrist** | Keine Loeschung (append-only, Nachweispflicht) |
| **TOM** | Append-only (kein UPDATE/DELETE), parametrisierte Queries |

### 2.6 Feedback – Eingestellt (Migration 057)

> **Hinweis:** Die Feedback-Funktion wurde mit Migration 057 entfernt. Die Tabelle `feedback` existiert nicht mehr. Dieser Abschnitt bleibt aus Dokumentationsgruenden erhalten.

---

## 3. Technische und organisatorische Massnahmen (TOM)

| Massnahme | Umsetzung |
|-----------|-----------|
| Verschluesselung (Transport) | HTTPS/TLS (nginx Reverse Proxy) |
| Verschluesselung (Speicher) | Passwort-Hashing (bcrypt), Verification-Tokens (SHA-256) |
| Zugriffskontrolle | Rollenbasiert (admin, superadmin, teacher, ssw, bl), JWT httpOnly Cookies |
| Eingabekontrolle | Parametrisierte SQL-Queries, Input-Validierung |
| Verfuegbarkeit | Docker Compose, PostgreSQL mit Backup-Moeglichkeit |
| Trennungsgebot | Physische Mandantentrennung: Jede Schule auf eigenem VPS mit separater Datenbank (keine Shared Databases). Siehe `docs/architecture/multi-tenancy.md` |
| Belastbarkeit | Rate-Limiting auf oeffentlichen und authentifizierten Endpunkten |
| Datenschutz by Design | Automatische Anonymisierung (Retention-Cron), Consent-Receipts, Widerruf-Endpunkt |

---

## 4. Aenderungshistorie

| Datum | Version | Aenderung |
|-------|---------|-----------|
| 2026-03-17 | 1.0 | Erstversion basierend auf DSGVO-Dateninventar und Anforderungsanalyse |
| 2026-03-18 | 1.1 | Trennungsgebot aktualisiert: VPS + separate DB pro Schule (keine Shared DBs) |
