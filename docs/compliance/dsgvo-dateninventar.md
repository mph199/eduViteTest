# DSGVO-Dateninventar – Personenbezogene Daten

> **Zweck:** Vollstaendiges Verzeichnis aller personenbezogenen Daten im System.
> Ausgangsbasis fuer Verarbeitungsverzeichnis (Art. 30 DSGVO) und Loeschkonzept.
>
> **Stand:** 2026-03-17
> **Quelle:** DB-Audit durch DB-Analyst Agent
> **Bezug:** [DSGVO-Anforderungen](dsgvo-anforderungen.md) | [DB-Audit](../security/db-audit-2026-03-17.md)

---

## 1. Uebersicht: Personenbezogene Daten nach Modul

### 1.1 Elternsprechtag-Modul

#### Tabelle: `booking_requests`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| parent_name | Vollstaendiger Name | Direkt – Elternteil | Nein | **NEIN** | Unbegrenzt |
| student_name | Name Schueler/in | Direkt – Minderjaehrige/r | Nein | **NEIN** | Unbegrenzt |
| trainee_name | Name Auszubildende/r | Direkt | Nein | **NEIN** | Unbegrenzt |
| representative_name | Name Firmenvertreter/in | Direkt | Nein | **NEIN** | Unbegrenzt |
| company_name | Firmenname | Indirekt | Nein | **NEIN** | Unbegrenzt |
| class_name | Klasse | Indirekt | Nein | **NEIN** | Unbegrenzt |
| email | E-Mail-Adresse | Direkt | Nein | **NEIN** | Unbegrenzt |
| message | Freitext-Nachricht | Direkt / potentiell sensitiv | Potentiell | **NEIN** | Unbegrenzt |
| verification_token_hash | Token-Hash | Technisch | Nein | Ja (wird genullt) | Bis Verify |

**KRITISCH:** Kein DELETE-Endpunkt, keine Anonymisierung implementiert.

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
| verification_token | Token (Klartext!) | Technisch | Nein | Ja | Legacy – sollte entfernt werden |

**Datenfluss:** `booking_requests` -> Lehrkraft weist zu -> `slots` (PII kopiert)

---

### 1.2 Schulsozialarbeit-Modul (SSW)

#### Tabelle: `ssw_appointments`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| student_name | Name Schueler/in | Direkt – Minderjaehrige/r | Nein | Nur DELETE | Unbegrenzt |
| student_class | Klasse | Indirekt | Nein | Nur DELETE | Unbegrenzt |
| email | E-Mail-Adresse | Direkt | Nein | Nur DELETE | Unbegrenzt |
| phone | Telefonnummer | Direkt | Nein | Nur DELETE | Unbegrenzt |
| ~~concern~~ | ~~Entfernt (Migration 035)~~ | -- | -- | -- | -- |
| ~~notes~~ | ~~Entfernt (Migration 035)~~ | -- | -- | -- | -- |
| is_urgent | Dringlichkeit | Indirekt | Nein | Nur DELETE | Unbegrenzt |

**Entscheidung (2026-03-17):** `concern` und `notes` wurden entfernt. Keine Art.-9-Daten mehr in der Anwendung. Cancel nullt verbleibende PII (Sprint 1).

#### Tabelle: `ssw_counselors`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| first_name, last_name | Vollstaendiger Name | Direkt – Beratungsperson | Nein | Ja (CASCADE) | Unbegrenzt |
| email | E-Mail-Adresse | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| phone | Telefonnummer | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| salutation | Anrede | Indirekt (Geschlecht) | Grenzwertig | Ja (CASCADE) | Unbegrenzt |
| requires_confirmation | Konfiguration (Boolean) | Nein | Nein | Ja (CASCADE) | Unbegrenzt |

---

### 1.3 Beratungslehrer-Modul (BL)

#### Tabelle: `bl_appointments`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| student_name | Name Schueler/in | Direkt – Minderjaehrige/r | Nein | Nur DELETE | Unbegrenzt |
| student_class | Klasse | Indirekt | Nein | Nur DELETE | Unbegrenzt |
| email | E-Mail-Adresse | Direkt | Nein | Nur DELETE | Unbegrenzt |
| phone | Telefonnummer | Direkt | Nein | Nur DELETE | Unbegrenzt |
| ~~concern~~ | ~~Entfernt (Migration 035)~~ | -- | -- | -- | -- |
| ~~notes~~ | ~~Entfernt (Migration 035)~~ | -- | -- | -- | -- |
| is_urgent | Dringlichkeit | Indirekt | Nein | Nur DELETE | Unbegrenzt |

**Entscheidung (2026-03-17):** `concern` und `notes` wurden entfernt. Keine Art.-9-Daten mehr. Cancel nullt verbleibende PII (Sprint 1).

#### Tabelle: `bl_counselors`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| first_name, last_name | Vollstaendiger Name | Direkt – Beratungsperson | Nein | Ja (CASCADE) | Unbegrenzt |
| email | E-Mail-Adresse | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| phone | Telefonnummer | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| salutation | Anrede | Indirekt (Geschlecht) | Grenzwertig | Ja (CASCADE) | Unbegrenzt |
| requires_confirmation | Konfiguration (Boolean) | Nein | Nein | Ja (CASCADE) | Unbegrenzt |

---

### 1.4 Kernmodul (Auth und Verwaltung)

#### Tabelle: `users`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| username | Login-Name (oft echter Name) | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| email | E-Mail-Adresse | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| password_hash | Passwort-Hash (bcrypt) | Technisch | Nein | Ja (CASCADE) | Unbegrenzt |

#### Tabelle: `teachers`

| Spalte | Datenart | Personenbezug | Art. 9 | Loeschbar | Aufbewahrung |
|--------|----------|---------------|--------|-----------|--------------|
| first_name, last_name | Vollstaendiger Name | Direkt – Lehrkraft | Nein | Ja (CASCADE) | Unbegrenzt |
| email | E-Mail-Adresse | Direkt | Nein | Ja (CASCADE) | Unbegrenzt |
| salutation | Anrede | Indirekt (Geschlecht) | Grenzwertig | Ja (CASCADE) | Unbegrenzt |

---

### 1.5 Sonstige

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
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              v                v                v
    ┌─────────────────┐ ┌───────────┐ ┌───────────────┐
    │booking_requests │ │ssw_appts  │ │bl_appts       │
    │(parent_name,    │ │(student,  │ │(student,      │
    │ student_name,   │ │ email,    │ │ email,        │
    │ email, message) │ │ concern)  │ │ concern)      │
    └────────┬────────┘ └───────────┘ └───────────────┘
             │                │               │
             v                v               v
    ┌────────────────┐  Cancel setzt    Cancel setzt
    │  slots         │  nur Status      nur Status
    │  (PII kopiert) │  PII BLEIBT      PII BLEIBT
    └────────────────┘
             │
             v
    cancelBookingAdmin()
    NULLT alle PII ✓
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

---

## 4. Empfaenger und Zugriff

| Daten | Zugriff durch | Rechtsgrundlage |
|-------|---------------|-----------------|
| Buchungsdaten (Elternsprechtag) | Lehrkraft (zugewiesen), Admin, Superadmin | Vertragserfuellung Art. 6(1)(b) |
| Beratungstermine (SSW) | Berater/in (zugewiesen), SSW-Rolle, Admin, Superadmin | Einwilligung Art. 6(1)(a) + Art. 9(2)(a) |
| Beratungstermine (BL) | Berater/in (zugewiesen), Admin, Superadmin | Einwilligung Art. 6(1)(a) + Art. 9(2)(a) |
| Benutzerdaten | Superadmin | Vertragserfuellung |

**Luecke:** SSW/BL-Termine sind nicht auf zugewiesenen Berater beschraenkt – alle mit SSW/Admin-Rolle koennen alle Termine sehen.

---

## 5. Aufbewahrungsfristen (SOLL – noch nicht implementiert)

| Datenart | Vorgeschlagene Frist | Rechtsgrundlage | Aktion nach Ablauf |
|----------|---------------------|-----------------|-------------------|
| Buchungsdaten (Elternsprechtag) | 6 Monate nach Event-Ende | Vertragserfuellung | Anonymisierung (PII auf NULL) |
| Beratungstermine (SSW/BL) | 12 Monate nach Termin | Dokumentationspflicht Schule | Anonymisierung (PII + concern auf NULL) |
| Stornierte Termine | 30 Tage nach Stornierung | Kein Zweck mehr | Anonymisierung oder physisches DELETE |
| Benutzerkonten | Bis Deaktivierung/Austritt | Arbeitsvertrag | DELETE mit CASCADE |
| Feedback | 12 Monate | Berechtigtes Interesse | DELETE |
| Verification-Tokens | 24 Stunden nach Erstellung | Technisch | NULL setzen oder DELETE |

**KRITISCH:** Keine dieser Fristen ist aktuell implementiert. Kein Cron-Job, kein Cleanup.

---

## 6. Loeschkonzept-Status

| Tabelle | Loeschung moeglich | Mechanismus | Luecken |
|---------|-------------------|-------------|---------|
| `slots` (PII) | Teilweise | `cancelBookingAdmin()` nullt PII-Felder | Kein Auto-Cleanup nach Event |
| `booking_requests` | **NEIN** | Kein Endpunkt implementiert | Komplette Luecke |
| `ssw_appointments` | Teilweise | Admin-DELETE (physisch) | Cancel loescht PII nicht |
| `bl_appointments` | Teilweise | Admin-DELETE (physisch) | Cancel loescht PII nicht |
| `teachers` | Ja | DELETE CASCADE | Vollstaendig |
| `users` | Ja | DELETE CASCADE | Vollstaendig |
| `ssw_counselors` | Ja | DELETE CASCADE | Vollstaendig |
| `bl_counselors` | Ja | DELETE CASCADE | Vollstaendig |
| `feedback` | Ja | DELETE-Endpunkt | Vollstaendig |

---

## Referenzen

| Dokument | Pfad |
|----------|------|
| DSGVO-Anforderungen | `docs/compliance/dsgvo-anforderungen.md` |
| SaaS-ToDo | `docs/compliance/dsgvo-saas-todo.md` |
| DB-Audit (vollstaendiges Schema) | `docs/security/db-audit-2026-03-17.md` |
| Consent-Checkbox Planung | `docs/planning/dsgvo-consent-checkbox.md` |
