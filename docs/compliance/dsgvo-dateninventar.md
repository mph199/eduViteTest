# DSGVO-Dateninventar – Personenbezogene Daten

> **Zweck:** Vollstaendiges Verzeichnis aller personenbezogenen Daten im System.
> Ausgangsbasis fuer Verarbeitungsverzeichnis (Art. 30 DSGVO) und Loeschkonzept.
>
> **Stand:** 2026-03-19 (aktualisiert, gegengeprueft gegen laufende DB)
> **Quelle:** DB-Audit 2026-03-17 + Gegenpruefung 2026-03-19
> **Bezug:** [DSGVO-Anforderungen](dsgvo-anforderungen.md) | [DB-Audit 19.03.](../security/db-audit-2026-03-19.md)

---

## 1. Uebersicht: Personenbezogene Daten nach Modul

### 1.1 Elternsprechtag-Modul

#### Tabelle: `booking_requests`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| parent_name | Vollstaendiger Name | Direkt – Elternteil | Nein | **JA** | Bis Anonymisierung |
| student_name | Name Schueler/in | Direkt – Minderjaehrige/r | Nein | **JA** | Bis Anonymisierung |
| trainee_name | Name Auszubildende/r | Direkt | Nein | **JA** | Bis Anonymisierung |
| representative_name | Name Firmenvertreter/in | Direkt | Nein | **JA** | Bis Anonymisierung |
| company_name | Firmenname | Indirekt | Nein | **JA** | Bis Anonymisierung |
| class_name | Klasse | Indirekt | Nein | **JA** | Bis Anonymisierung |
| email | E-Mail-Adresse | Direkt | Nein | **JA** | Bis Anonymisierung |
| message | Freitext-Nachricht | Direkt / potentiell sensitiv | Potentiell | **JA** | Bis Anonymisierung |
| verification_token_hash | Token-Hash | Technisch | Nein | Ja (wird genullt nach Verify) | Bis Verify |

**Anonymisierung implementiert:**
- DB-Funktion `anonymize_booking_request(id)` setzt alle PII auf NULL
- DB-Funktion `anonymize_booking_requests(email)` anonymisiert alle Requests fuer eine E-Mail
- `POST /api/consent/withdraw` (Endpunkt) anonymisiert via E-Mail + Modul
- `restricted`-Flag verhindert oeffentliche Anzeige nach Anonymisierung

#### Tabelle: `slots`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| parent_name | Vollstaendiger Name | Direkt – Elternteil | Nein | Ja | cancelBookingAdmin nullt |
| student_name | Name Schueler/in | Direkt – Minderjaehrige/r | Nein | Ja | cancelBookingAdmin nullt |
| trainee_name | Name Auszubildende/r | Direkt | Nein | Ja | cancelBookingAdmin nullt |
| representative_name | Name Firmenvertreter/in | Direkt | Nein | Ja | cancelBookingAdmin nullt |
| company_name | Firmenname | Indirekt | Nein | Ja | cancelBookingAdmin nullt |
| class_name | Klasse | Indirekt | Nein | Ja | cancelBookingAdmin nullt |
| email | E-Mail-Adresse | Direkt | Nein | Ja | cancelBookingAdmin nullt |
| message | Freitext-Nachricht | Direkt | Potentiell | Ja | cancelBookingAdmin nullt |
| verification_token_hash | Token-Hash (nur Hash!) | Technisch | Nein | Ja (genullt nach Verify) | Bis Verify |

**Hinweis:** Klartext-Spalte `verification_token` existiert nicht mehr (entfernt).

**Datenfluss:** `booking_requests` -> Lehrkraft weist zu -> `slots` (PII kopiert)

---

### 1.2 Schulsozialarbeit-Modul (SSW)

#### Tabelle: `ssw_appointments`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| student_name | Name Schueler/in | Direkt – Minderjaehrige/r | Nein | Ja (Consent-Withdraw + DELETE) | Bis Anonymisierung |
| student_class | Klasse | Indirekt | Nein | Ja | Bis Anonymisierung |
| email | E-Mail-Adresse | Direkt | Nein | Ja | Bis Anonymisierung |
| phone | Telefonnummer | Direkt | Nein | Ja | Bis Anonymisierung |
| is_urgent | Dringlichkeit | Indirekt | Nein | Ja (DELETE) | Unbegrenzt |

**Keine Art.-9-Daten:** `concern` und `notes` wurden durch Migration 035 entfernt.

**Anonymisierung:** `POST /api/consent/withdraw` (module=schulsozialarbeit) setzt student_name, student_class, email, phone auf NULL. `restricted`-Flag vorhanden.

#### Tabelle: `ssw_counselors`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| first_name, last_name | Vollstaendiger Name | Direkt – Beratungsperson | Nein | Ja (CASCADE) | Unbegrenzt |
| email | E-Mail-Adresse | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| phone | Telefonnummer | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| salutation | Anrede | Indirekt (Geschlecht) | Grenzwertig | Ja (CASCADE) | Unbegrenzt |

---

### 1.3 Beratungslehrer-Modul (BL)

#### Tabelle: `bl_appointments`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| student_name | Name Schueler/in | Direkt – Minderjaehrige/r | Nein | Ja (Consent-Withdraw + DELETE) | Bis Anonymisierung |
| student_class | Klasse | Indirekt | Nein | Ja | Bis Anonymisierung |
| email | E-Mail-Adresse | Direkt | Nein | Ja | Bis Anonymisierung |
| phone | Telefonnummer | Direkt | Nein | Ja | Bis Anonymisierung |
| is_urgent | Dringlichkeit | Indirekt | Nein | Ja (DELETE) | Unbegrenzt |

**Keine Art.-9-Daten:** `concern` und `notes` wurden durch Migration 035 entfernt.

**Anonymisierung:** `POST /api/consent/withdraw` (module=beratungslehrer) setzt student_name, student_class, email, phone auf NULL. `restricted`-Flag vorhanden.

#### Tabelle: `bl_counselors`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| first_name, last_name | Vollstaendiger Name | Direkt – Beratungsperson | Nein | Ja (CASCADE) | Unbegrenzt |
| email | E-Mail-Adresse | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| phone | Telefonnummer | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| salutation | Anrede | Indirekt (Geschlecht) | Grenzwertig | Ja (CASCADE) | Unbegrenzt |

---

### 1.4 Kernmodul (Auth und Verwaltung)

#### Tabelle: `users`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| username | Login-Name (oft echter Name) | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| email | E-Mail-Adresse | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| password_hash | Passwort-Hash (bcrypt) | Technisch | Nein | Ja (CASCADE) | Unbegrenzt |
| failed_login_attempts | Fehlversuche | Technisch | Nein | Ja | Automatisch (bei erfolgreichem Login) |
| locked_until | Sperrzeitpunkt | Technisch | Nein | Ja | Automatisch |
| last_failed_login | Letzter Fehlversuch | Technisch | Nein | Ja | Automatisch |

#### Tabelle: `teachers`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| first_name, last_name | Vollstaendiger Name | Direkt – Lehrkraft | Nein | Ja (CASCADE) | Unbegrenzt |
| email | E-Mail-Adresse | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| salutation | Anrede | Indirekt (Geschlecht) | Grenzwertig | Ja (CASCADE) | Unbegrenzt |

---

### 1.5 Compliance und Audit

#### Tabelle: `consent_receipts` (NEU – fehlte im Audit 17.03.)

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| ip_address | IP-Adresse | Direkt (personenbezogen nach EuGH) | Nein | **NEIN (append-only)** | Unbegrenzt (Nachweispflicht Art. 7 Abs. 1) |
| user_agent | Browser-Kennung | Indirekt | Nein | **NEIN (append-only)** | Unbegrenzt |
| consent_version | Einwilligungs-Version | Technisch | Nein | NEIN | Unbegrenzt |
| consent_purpose | Zweck | Technisch | Nein | NEIN | Unbegrenzt |

**Rechtsgrundlage:** Art. 7 Abs. 1 DSGVO – Nachweis der Einwilligung. Diese Tabelle DARF NICHT geloescht werden, auch nicht bei Consent-Withdraw.

#### Tabelle: `audit_log` (NEU – fehlte im Audit 17.03.)

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| user_id | Benutzer-Referenz (FK) | Indirekt (via users-Tabelle) | Nein | SET NULL bei User-Loeschung | Empfehlung: 24 Monate |
| ip_address | IP-Adresse | Direkt | Nein | Nicht vorgesehen | Empfehlung: 24 Monate |
| details | JSON mit Aenderungsdetails | Potentiell (abhaengig vom Inhalt) | Nein | Nicht vorgesehen | Empfehlung: 24 Monate |

**Empfehlung:** Automatische Rotation nach 24 Monaten implementieren.

#### Tabelle: `feedback`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| message | Anonymer Freitext | Pseudonym / potentiell direkt | Nein | Ja (DELETE) | Manuell |

---

## 2. Datenfluss-Diagramm

```
                    ┌─────────────────────────────┐
                    │   Oeffentliches Formular     │
                    │   (kein Auth erforderlich)    │
                    │   + Consent-Checkbox          │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              v                v                v
    ┌─────────────────┐ ┌───────────┐ ┌───────────────┐
    │booking_requests │ │ssw_appts  │ │bl_appts       │
    │(parent_name,    │ │(student,  │ │(student,      │
    │ student_name,   │ │ email,    │ │ email,        │
    │ email, message) │ │ phone)    │ │ phone)        │
    └────────┬────────┘ └─────┬─────┘ └──────┬────────┘
             │                │               │
             │                │               │
    Consent-Withdraw    Consent-Withdraw   Consent-Withdraw
    anonymisiert PII    anonymisiert PII   anonymisiert PII
             │                │               │
             v                v               v
    ┌────────────────┐  ┌──────────────────────────────┐
    │  slots         │  │     consent_receipts          │
    │  (PII kopiert) │  │  (append-only, IP, UA)       │
    │  Cancel nullt  │  │  NICHT loeschbar              │
    └────────────────┘  └──────────────────────────────┘
                        ┌──────────────────────────────┐
                        │     audit_log                 │
                        │  (append-only, user_id, IP)  │
                        │  Rotation: 24 Monate (TODO)  │
                        └──────────────────────────────┘
```

---

## 3. Kategorien betroffener Personen

| Kategorie | Tabellen | Besonderheiten |
|-----------|----------|---------------|
| Schueler/innen (Minderjaehrige) | slots, booking_requests, ssw_appointments, bl_appointments | Erhoehter Schutz, Einwilligung der Erziehungsberechtigten |
| Erziehungsberechtigte | slots, booking_requests | Direkte Erhebung |
| Lehrkraefte | teachers, users | Mitarbeiterdaten, Rechtsgrundlage: Arbeitsvertrag |
| Beratungskraefte (SSW/BL) | ssw_counselors, bl_counselors, users | Mitarbeiterdaten |
| Ausbilder/Firmenvertreter | slots, booking_requests | Vertragserfuellung |
| Website-Besucher (bei Buchung) | consent_receipts | IP-Adresse, User-Agent |

---

## 4. Empfaenger und Zugriff

| Daten | Zugriff durch | Rechtsgrundlage |
|-------|---------------|-----------------|
| Buchungsdaten (Elternsprechtag) | Lehrkraft (zugewiesen), Admin, Superadmin | Vertragserfuellung Art. 6(1)(b) |
| Beratungstermine (SSW) | Berater/in (zugewiesen), SSW-Rolle, Admin, Superadmin | Einwilligung Art. 6(1)(a) |
| Beratungstermine (BL) | Berater/in (zugewiesen), Admin, Superadmin | Einwilligung Art. 6(1)(a) |
| Benutzerdaten | Superadmin | Vertragserfuellung |
| Consent-Receipts | Superadmin (Nachweispflicht) | Art. 7 Abs. 1 DSGVO |
| Audit-Log | Superadmin | Berechtigtes Interesse Art. 6(1)(f) |

---

## 5. Aufbewahrungsfristen

| Datenart | Frist | Rechtsgrundlage | Aktion nach Ablauf | Status |
|----------|-------|-----------------|-------------------|--------|
| Buchungsdaten (Elternsprechtag) | 6 Monate nach Event-Ende | Vertragserfuellung | Anonymisierung (PII auf NULL) | **Funktion vorhanden, Cron fehlt** |
| Beratungstermine (SSW/BL) | 12 Monate nach Termin | Dokumentationspflicht Schule | Anonymisierung (PII auf NULL) | **Consent-Withdraw vorhanden, Auto-Cleanup fehlt** |
| Stornierte Termine | 30 Tage nach Stornierung | Kein Zweck mehr | Anonymisierung oder DELETE | **Nicht implementiert** |
| Benutzerkonten | Bis Deaktivierung/Austritt | Arbeitsvertrag | DELETE mit CASCADE | Manuell moeglich |
| Feedback | 12 Monate | Berechtigtes Interesse | DELETE | Manuell moeglich |
| Consent-Receipts | Unbegrenzt | Art. 7 Abs. 1 DSGVO | NICHT loeschen | Korrekt |
| Audit-Log | 730 Tage (~24 Monate, konfigurierbar via `RETENTION_AUDIT_LOG_DAYS`) | Berechtigtes Interesse | DELETE via retention-cleanup.js | **Implementiert** |
| Verification-Tokens | Sofort nach Verify | Technisch | Wird auf NULL gesetzt | **Implementiert** |

---

## 6. Loeschkonzept-Status

| Tabelle | Loeschung moeglich | Mechanismus | Status |
|---------|-------------------|-------------|--------|
| `booking_requests` (PII) | **JA** | `anonymize_booking_request()`, `consent/withdraw`, `restricted`-Flag | Implementiert |
| `slots` (PII) | Ja | `cancelBookingAdmin()` nullt PII-Felder | Implementiert |
| `ssw_appointments` (PII) | **JA** | `consent/withdraw` anonymisiert, Admin-DELETE | Implementiert |
| `bl_appointments` (PII) | **JA** | `consent/withdraw` anonymisiert, Admin-DELETE | Implementiert |
| `teachers` | Ja | DELETE CASCADE | Implementiert |
| `users` | Ja | DELETE CASCADE | Implementiert |
| `ssw_counselors` | Ja | DELETE CASCADE | Implementiert |
| `bl_counselors` | Ja | DELETE CASCADE | Implementiert |
| `feedback` | Ja | DELETE-Endpunkt | Implementiert |
| `consent_receipts` | **NEIN (gewollt)** | Append-only, Nachweispflicht | Korrekt |
| `audit_log` | **JA** | DELETE via retention-cleanup.js (730 Tage Default) | **Implementiert** |

---

## Referenzen

| Dokument | Pfad |
|----------|------|
| DSGVO-Anforderungen | `docs/compliance/dsgvo-anforderungen.md` |
| SaaS-ToDo | `docs/compliance/dsgvo-saas-todo.md` |
| DB-Audit (17.03., Erstaudit) | `docs/security/db-audit-2026-03-17.md` |
| DB-Audit (19.03., Gegenpruefung) | `docs/security/db-audit-2026-03-19.md` |
| Consent-Checkbox Planung | `docs/planning/dsgvo-consent-checkbox.md` |
