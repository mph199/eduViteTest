# DSGVO-Einwilligungs-Checkbox fuer Buchungsmodule

> Status: Phase 2-4 implementiert, Phase 1 (DB-Audit) ausstehend | Erstellt: 2026-03-17 | Teilumsetzung: 2026-03-17

## Problem

Keines der drei Buchungsmodule hat eine Datenverarbeitungs-Einwilligung. Personenbezogene Daten werden ohne explizite Zustimmung gespeichert. Die Datenschutzseite (`/datenschutz`) existiert, ist aber im Footer deaktiviert und nicht aus den Buchungsformularen verlinkt.

## Betroffene Module und erfasste Daten

### elternsprechtag

| Feld | Personenbezug | Tabelle |
|------|---------------|---------|
| `parent_name` | Ja | `booking_requests` |
| `student_name` | Ja (Minderjaehrig) | `booking_requests` |
| `class_name` | Indirekt | `booking_requests` |
| `email` | Ja | `booking_requests` |
| `message` | Moeglich | `booking_requests` |
| `company_name` | Ja (jur. Person) | `booking_requests` |
| `trainee_name` | Ja | `booking_requests` |
| `representative_name` | Ja | `booking_requests` |
| `verification_token_hash` | Technisch | `booking_requests` |

### schulsozialarbeit

| Feld | Personenbezug | Tabelle |
|------|---------------|---------|
| `student_name` | Ja (Minderjaehrig) | `ssw_appointments` |
| `student_class` | Indirekt | `ssw_appointments` |
| `email` | Ja | `ssw_appointments` |
| `phone` | Ja | `ssw_appointments` |
| `concern` | Ja (besondere Kategorie: Gesundheit/Soziales) | `ssw_appointments` |
| `is_urgent` | Indirekt | `ssw_appointments` |
| `notes` | Ja (intern) | `ssw_appointments` |

### beratungslehrer

| Feld | Personenbezug | Tabelle |
|------|---------------|---------|
| `student_name` | Ja (Minderjaehrig) | `bl_appointments` |
| `student_class` | Indirekt | `bl_appointments` |
| `email` | Ja | `bl_appointments` |
| `phone` | Ja | `bl_appointments` |
| `concern` | Ja (besondere Kategorie) | `bl_appointments` |
| `is_urgent` | Indirekt | `bl_appointments` |
| `notes` | Ja (intern) | `bl_appointments` |

## Umsetzungsplan

### Phase 1: DB-Hygiene-Check (Voraussetzung)

Bevor die Checkbox implementiert wird, muss ein vollstaendiges Dateninventar erstellt werden:

1. **DB-Analyst Agent** spawnen (siehe `.claude/agents/db-analyst.md`)
2. Schema aus 33 Migrationen extrahieren
3. Personenbezogene Felder katalogisieren
4. Aufbewahrungsfristen definieren
5. Loeschkonzept entwerfen

### Phase 2: Shared Consent-Komponente – IMPLEMENTIERT

`src/components/ConsentCheckbox.tsx` wurde als globale Shared Component angelegt.

**Implementierte Props:**
- `moduleId: 'elternsprechtag' | 'schulsozialarbeit' | 'beratungslehrer'`
- `checked: boolean`
- `onChange: (checked: boolean) => void`

Modulspezifische Texte sind in `MODULE_TEXTS` innerhalb der Komponente definiert. Der Datenschutz-Link zeigt auf `/datenschutz` (`target="_blank"`, `rel="noopener noreferrer"`).

Submit-Button wird `disabled` solange Checkbox nicht angehakt ist.

**Offene Entscheidung:** Einwilligungs-Protokollierung in DB (Art. 7 Abs. 1 DSGVO) ist noch nicht umgesetzt. Rechtsberatung ausstehend.

### Phase 3: Integration in Buchungsformulare – IMPLEMENTIERT

| Modul | Formular-Komponente | Status |
|-------|-------------------|--------|
| elternsprechtag | `src/modules/elternsprechtag/components/BookingForm.tsx` | ConsentCheckbox integriert, Submit disabled ohne Consent |
| schulsozialarbeit + beratungslehrer | `src/shared/components/CounselorBookingApp.tsx` | ConsentCheckbox integriert via `config.moduleId`, Submit disabled ohne Consent |

`moduleId` wurde als Pflichtfeld in `CounselorBookingConfig` (src/types/index.ts) ergaenzt.

### Phase 4: Datenschutzseite aktivieren – TEILWEISE IMPLEMENTIERT

- Footer-Link `/datenschutz` aktiviert (von `<span>` zu `<a href="/datenschutz">`)
- **Ausstehend:** Datenschutzerklaerung mit modulspezifischen Abschnitten fuer SSW und BL erweitern
- **Ausstehend:** Aufbewahrungsfristen und Loeschrechte dokumentieren

## Abhaengigkeiten

- DB-Analyst Agent muss zuerst das Dateninventar liefern
- Datenschutzerklaerung muss vor Checkbox-Implementierung aktualisiert sein
- Rechtsberatung empfohlen fuer Formulierungen (besondere Kategorien bei SSW/BL)

## Risikobewertung

| Risiko | Schwere | Massnahme |
|--------|---------|-----------|
| `concern`-Feld bei SSW/BL ist besondere Kategorie (Art. 9 DSGVO) | Hoch | Ausdrueckliche Einwilligung erforderlich, nicht nur Checkbox |
| Keine Loeschfunktion fuer abgelaufene Termine | Mittel | Aufbewahrungsfrist + automatische Bereinigung |
| Email-Verifizierung speichert Hash dauerhaft | Niedrig | TTL oder Cleanup-Job |
