# Responsive-Plan: Adminbereich

> Erstellt: 2026-03-16 | Agent: ux-responsive

## Befunde

| # | Datei:Zeile | Problem | Viewport | Schweregrad |
|---|-------------|---------|----------|-------------|
| 1 | `AdminDashboard.css:655-669` | Events Desktop/Mobile Toggle-Regeln fehlen komplett – Mobile-Cards nie sichtbar | Mobile | KRITISCH |
| 2 | `AdminDashboard.css` (gesamt) | `admin-resp-table` hat keinen generischen Mobile-Card-Fallback fuer BL/SSW-Tabellen | Mobile < 768px | KRITISCH |
| 3 | `AdminDashboard.tsx:389-407` | Inline `style={{ width: '18%' }}` auf `<th>` blockiert CSS-Overrides | Mobile | KRITISCH |
| 4 | `BLAdmin.tsx:464-519` | Anfragen-Tabelle (8 Spalten) ohne Mobile-Card-Fallback | Mobile | KRITISCH |
| 5 | `SSWAdmin.tsx:457-493` | Counselors-Tabelle (5 Spalten) ohne Mobile-Card-Fallback | Mobile | KRITISCH |
| 6 | `AdminDashboard.css:554-558` | `.admin-grid-2` feste 2 Spalten ohne Mobile-Breakpoint | Mobile < 640px | HOCH |
| 7 | `BLAdmin.tsx:360-403` | Wochenplan-Zeilen umbrechen nicht auf Mobile | Mobile | HOCH |
| 8 | `BLAdmin.tsx:431-434` | Datum-Range-Inputs nebeneinander, zu schmal auf Mobile | Mobile | HOCH |
| 9 | `BLAdmin.tsx:331` | Tab-Buttons passen nicht auf 320px Phone | Mobile < 480px | HOCH |
| 10 | `SSWAdmin.tsx:323` | Tab-Reihe ohne `flexWrap: 'wrap'` | Mobile < 480px | HOCH |
| 11 | `SSWAdmin.tsx:388-430` | Wochenplan als Tabelle, time-Inputs zu schmal | Mobile | HOCH |
| 12 | `SSWAdmin.tsx:707-740` | Tag-Detail-Tabelle ohne Mobile-Fallback | Mobile | HOCH |
| 13 | `AdminEvents/index.tsx:220-222` | Lange Datumsstrings ueberlaufen auf Tablet | Tablet | MITTEL |
| 14 | `AdminDashboard.css:496-502` | `.teacher-form-container` Padding zu gross auf Mobile | Mobile | MITTEL |
| 15 | `AdminDashboard.tsx:334` | Inline-Styles verhindern CSS-Override | Alle | MITTEL |
| 16 | `SuperadminPage.css:516-518` | `.superadmin__bg-card` kein column-Fallback auf 375px | Mobile < 420px | MITTEL |

## Phase 1: Kritisch (sofort)

### 1.1 AdminDashboard.css – Events Desktop/Mobile Toggle

```css
.events-table-desktop { display: block; }
.events-cards-mobile  { display: none; }

@media (max-width: 900px) {
  .events-table-desktop { display: none; }
  .events-cards-mobile  { display: block; }
}
```

### 1.2 AdminDashboard.css – Generischer admin-resp-table Mobile-Fallback

```css
@media (max-width: 768px) {
  .admin-resp-table-container { overflow: visible; border: none; border-radius: 0; }
  .admin-resp-table thead { display: none; }
  .admin-resp-table tbody { display: block; }
  .admin-resp-table tbody tr {
    display: block;
    background: var(--color-white);
    border: 1px solid var(--color-gray-200);
    border-left: 4px solid var(--brand-primary);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .admin-resp-table tbody td {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 0.5rem;
    align-items: start;
    border: 0;
    border-bottom: 1px dashed var(--color-gray-100);
    padding: 0.4rem 0;
    font-size: 0.9rem;
  }
  .admin-resp-table tbody td::before {
    content: attr(data-label);
    font-weight: 700;
    color: var(--color-gray-500);
    font-size: 0.78rem;
    text-transform: uppercase;
  }
  .admin-resp-table tbody td:last-child { border-bottom: 0; }
}
```

**WICHTIG:** Alle `<td>` in `BLAdmin.tsx` und `SSWAdmin.tsx` brauchen `data-label="..."` Attribute.

### 1.3 AdminDashboard.tsx – Inline-width von `<th>` entfernen

Zeile 389-407: `style={{ width: '...' }}` auf `<th>` entfernen. Breiten per CSS-Klasse steuern.

### 1.4 BLAdmin.tsx – Datum-Range + Wochenplan

- Zeile 431-434: `flexWrap: 'wrap'` zum Datum-Range-Container
- Zeile 360-403: Wochenplan-Zeilen durch CSS-Klasse `bl-schedule-row` ersetzen:
  ```css
  @media (max-width: 600px) {
    .bl-schedule-row { flex-wrap: wrap; }
    .bl-schedule-row label { min-width: 100%; }
  }
  ```

### 1.5 SSWAdmin.tsx – Tab-Reihe + Counselor-Tabelle

- Zeile 323: `flexWrap: 'wrap'` ergaenzen
- Alle Tabellen-`<td>` mit `data-label` versehen

## Phase 2: Hoch (naechster Sprint)

### 2.1 admin-grid-2 auf Mobile einspaltieren

```css
@media (max-width: 640px) {
  .admin-grid-2 { grid-template-columns: 1fr; }
}
```

### 2.2 Touch-Targets fuer Tab-Buttons

```css
@media (max-width: 480px) {
  .btn-primary, .btn-secondary { min-height: 44px; }
}
```

### 2.3 SSWAdmin Wochenplan-Tabelle

`overflow-x: auto` Wrapper oder CSS-Card-Ansicht auf Mobile.

### 2.4 Events Datumsstrings

```css
.ev-cell-date { display: block; word-break: break-word; }
```

## Phase 3: Mittel/Niedrig (Backlog)

### 3.1 teacher-form-container Padding

```css
@media (max-width: 640px) {
  .teacher-form-container { padding: 1rem; }
}
```

### 3.2 Superadmin Background-Cards

```css
@media (max-width: 420px) {
  .superadmin__bg-card { flex-direction: column; }
  .superadmin__bg-preview { width: 100%; height: 120px; }
}
```

### 3.3 Inline-Styles durch CSS-Klassen ersetzen

`AdminDashboard.tsx` Zeile 334ff: Style-Props durch CSS-Klassen ersetzen.
