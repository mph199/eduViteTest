# Verzeichnis der Auftragsverarbeitungstaetigkeiten (Art. 30 Abs. 2 DSGVO)

> **Stand:** 2026-03-18 | **Version:** 1.1
> **System:** eduViteTest – Modulares Schulverwaltungssystem

---

## 1. Angaben zum Auftragsverarbeiter

| Feld | Wert |
|------|------|
| Auftragsverarbeiter | [Betreiber/Hoster der Instanz – wird pro Deployment konfiguriert] |
| Anschrift | [wird pro Deployment konfiguriert] |
| Kontakt DSB | [wird aus `site_branding.dsb_name` / `site_branding.dsb_email` geladen] |

> **Hinweis:** eduViteTest wird als SaaS betrieben. Jede Schule laeuft auf einem eigenen VPS
> mit separater Datenbank (keine Shared Databases). Der Auftragsverarbeiter ist der
> SaaS-Betreiber. Pro Schule/VPS-Instanz ist ein eigener AV-Vertrag abzuschliessen.
> Dieses Verzeichnis ist eine Vorlage, die pro Instanz zu vervollstaendigen ist.
> Siehe: `docs/architecture/multi-tenancy.md`

---

## 2. Kategorien von Verarbeitungen

### 2.1 Hosting und Betrieb der Schulverwaltungsanwendung

| Feld | Beschreibung |
|------|-------------|
| **Auftraggeber** | Schule / Schultraeger (Verantwortlicher) |
| **Gegenstand der Verarbeitung** | Betrieb der Terminbuchungsplattform (Elternsprechtag, Schulsozialarbeit, Beratungslehrer) |
| **Kategorien betroffener Personen** | Schueler/innen (Minderjaehrige), Erziehungsberechtigte, Lehrkraefte, Beratungskraefte, Ausbilder |
| **Kategorien personenbezogener Daten** | Namen, Kontaktdaten (E-Mail, Telefon), Klasse, Termindaten, Einwilligungsnachweise |
| **Drittlandtransfer** | Nein (Self-Hosting in der EU) |
| **Unterauftragsverarbeiter** | Keine (sofern Self-Hosting; bei Cloud-Hosting: Hosting-Provider eintragen) |
| **TOM** | Siehe Verarbeitungsverzeichnis (Art. 30 Abs. 1), Abschnitt 3 |
| **Loeschung nach Auftragsende** | Vollstaendige Loeschung der Datenbank und aller Backups innerhalb von 30 Tagen nach Vertragsende |

### 2.2 E-Mail-Versand (transaktional)

| Feld | Beschreibung |
|------|-------------|
| **Auftraggeber** | Schule / Schultraeger |
| **Gegenstand der Verarbeitung** | Versand von Bestaetigungs-, Verifikations- und Stornierungsmails |
| **Kategorien betroffener Personen** | Erziehungsberechtigte, Ausbilder, Schueler/innen |
| **Kategorien personenbezogener Daten** | E-Mail-Adresse, Name, Termin-Details |
| **Drittlandtransfer** | Abhaengig vom SMTP-Provider (zu dokumentieren) |
| **Unterauftragsverarbeiter** | SMTP-Provider (zu dokumentieren, z.B. Schulserver, externer Mailserver) |
| **TOM** | TLS-Verschluesselung (SMTP), keine Speicherung von E-Mail-Inhalten in der Anwendung |

---

## 3. Technische und organisatorische Massnahmen

Verweis auf das Verarbeitungsverzeichnis (`verarbeitungsverzeichnis.md`), Abschnitt 3.

Zusaetzlich fuer den Auftragsverarbeiter:

| Massnahme | Umsetzung |
|-----------|-----------|
| Zutrittskontrolle | [Serverstandort dokumentieren] |
| Zugangskontrolle | SSH-Key-Authentifizierung, keine Passwoerter |
| Zugriffskontrolle | Principle of Least Privilege, getrennte DB-User |
| Weitergabekontrolle | TLS fuer alle Verbindungen (HTTPS, PostgreSQL SSL, SMTP TLS) |
| Verfuegbarkeitskontrolle | Regelmaessige Backups, Monitoring |
| Trennungsgebot | Physische Isolation: VPS + separate DB pro Schule. Separate Docker-Container pro Service. |

---

## 4. Unterauftragsverarbeiter

| # | Name | Gegenstand | Sitz | AV-Vertrag |
|---|------|-----------|------|-----------|
| 1 | [SMTP-Provider eintragen] | E-Mail-Versand | [Land] | [ja/nein] |
| 2 | [Hosting-Provider, falls zutreffend] | Infrastruktur | [Land] | [ja/nein] |

> Bei reinem Self-Hosting auf schuleigenem Server: Keine Unterauftragsverarbeiter.

---

## 5. Aenderungshistorie

| Datum | Version | Aenderung |
|-------|---------|-----------|
| 2026-03-17 | 1.0 | Erstversion als Vorlage fuer Self-Hosted-Deployments |
| 2026-03-18 | 1.1 | Aktualisiert fuer SaaS-Betrieb: VPS + separate DB pro Schule |
