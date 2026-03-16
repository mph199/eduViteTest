# Responsive-Plan: Buchungstool (oeffentliche Seiten)

> Erstellt: 2026-03-16 | Agent: ux-responsive

## Befunde

| # | Datei:Zeile | Problem | Viewport | Schweregrad |
|---|-------------|---------|----------|-------------|
| 1 | `CounselorBookingApp.css` (gesamt) | Keine einzige `@media`-Query – keinerlei Responsive-Anpassungen | Alle mobilen | KRITISCH |
| 2 | `CounselorBookingApp.css:145-163` | `.cb-slots` Touch-Target nur ~34px (unter 44px Minimum) | Mobile/Tablet | HOCH |
| 3 | `CounselorBookingApp.css:130-135` | `.cb-date-input` keine `width: 100%` auf Mobile | Mobile | HOCH |
| 4 | `CounselorBookingApp.tsx:339-346` | `.cb-actions` Buttons nicht full-width auf Mobile | Mobile | HOCH |
| 5 | `BookingApp.css:636-641` | Sidebar `top: 0` statt `top: var(--globalTopHeaderHeight)` – unter Header verborgen | Tablet | HOCH |
| 6 | `LandingPage.css:15` | `background-attachment: fixed` flackert auf iOS Safari | Mobile < 768px | HOCH |
| 7 | `CounselorBookingApp.css:185-192` | Formular-Inputs nur ~36px Hoehe (unter 44px Touch-Target) | Mobile | MITTEL |
| 8 | `LandingPage.css:140-168` | Steps stauen sich auf 360px-Phones statt umbrechen | Mobile < 480px | MITTEL |
| 9 | `CounselorBookingApp.css:65-70` | Kein Padding-Breakpoint fuer `.cb-app` | Mobile < 480px | MITTEL |
| 10 | `CounselorBookingApp.tsx:149` | `<h1>` ohne responsive Schriftgroesse | Mobile | MITTEL |
| 11 | `BookingApp.css:600-607` | Tote CSS-Klassen `.header-filters`, `.filter-actions` | – | NIEDRIG |
| 12 | `LandingPage.css:38` | `.landing__subtitle` keine responsive `font-size` | Mobile < 375px | NIEDRIG |

## Phase 1: Kritisch (sofort)

### 1.1 CounselorBookingApp.css – Media Queries ergaenzen

Datei: `src/shared/components/CounselorBookingApp.css`

```css
/* Tablet */
@media (max-width: 768px) {
  .cb-date-input { width: 100%; }
  .cb-slot {
    padding: 0.7rem 1rem;
    min-height: 44px;
  }
  .cb-form__group input,
  .cb-form__group select,
  .cb-form__group textarea {
    padding: 0.7rem 0.75rem;
    min-height: 44px;
  }
}

/* Mobile */
@media (max-width: 640px) {
  .cb-actions { flex-direction: column; }
  .cb-actions .btn-primary,
  .cb-actions .btn-secondary { width: 100%; min-height: 48px; }
  .cb-form__urgent { padding: 0.4rem 0; gap: 0.75rem; min-height: 44px; }
  .cb-app h1 { font-size: clamp(1.3rem, 5vw, 1.7rem); }
}

/* Kleine Phones */
@media (max-width: 480px) {
  .cb-app { padding: 1rem 0.85rem; }
  .cb-counselors { gap: 0.75rem; }
}
```

### 1.2 BookingApp.css – Sidebar top-Offset

Datei: `src/modules/elternsprechtag/components/BookingApp.css` Zeile 636-641

```css
.booking-app .sidebar {
  position: sticky;
  top: calc(var(--globalTopHeaderHeight, 72px) + 0.75rem);  /* war: top: 0 */
}
```

## Phase 2: Hoch (naechster Sprint)

### 2.1 LandingPage.css – iOS background-attachment Fix

Datei: `src/pages/LandingPage.css`

```css
@media (max-width: 768px) {
  .landing::before {
    background-attachment: scroll;  /* iOS Safari Workaround */
  }
}
```

Gleiches Fix in:
- `src/modules/elternsprechtag/components/BookingApp.css`
- `src/shared/components/CounselorBookingLayout.css`

### 2.2 LandingPage.css – Steps auf Mobile umbrechen

Datei: `src/pages/LandingPage.css`

```css
@media (max-width: 480px) {
  .landing__steps {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
}
```

## Phase 3: Mittel/Niedrig (Backlog)

### 3.1 Tote CSS-Klassen entfernen

Datei: `src/modules/elternsprechtag/components/BookingApp.css` Zeile 600-607
- `.header-filters` und `.filter-actions` entfernen

### 3.2 CounselorBookingApp.css – overflow-wrap

```css
.cb-confidential-notice { overflow-wrap: break-word; }
```
