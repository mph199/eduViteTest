# Responsive-Plan: Lehrerbereich

> Erstellt: 2026-03-16 | Agent: ux-responsive

## Befunde

| # | Datei:Zeile | Problem | Viewport | Schweregrad |
|---|-------------|---------|----------|-------------|
| 1 | `TeacherHome.css:262` | CSS-Syntaxfehler: ueberfluessige `}` invalidiert nachfolgende Styles | Alle | KRITISCH |
| 2 | `TeacherRequestsTableSandbox.tsx:374-376` | Modal-Pfeile nur 28px auf < 520px (unter 44px Touch-Target) | Mobile | HOCH |
| 3 | `TeacherRequestsTableSandbox.tsx:206` | Slot-Picker `.sandbox-multi-select__item` nur ~34px (unter 44px) | Mobile | HOCH |
| 4 | `TeacherBookings.tsx:246` | stat-card `flex: 0 0 220px` blockiert umbrechen auf Mobile | Mobile | MITTEL |
| 5 | `AdminDashboard.css:1397-1405` | Fehlt Padding-Reduktion fuer Teacher-Bookings-Cards auf < 480px | Mobile < 480px | MITTEL |
| 6 | `TeacherRequestsTableSandbox.css:186-188` | Tote `.sandbox-grid { min-width: 1160px }` | – | NIEDRIG |
| 7 | `TeacherBookings.tsx:279-281` | `.teacher-my-bookings-table-container` ohne eigene CSS-Regel | – | NIEDRIG |

Positiv: TeacherHome, TeacherRequests und TeacherLayout haben bereits gute Responsive-Patterns (Desktop/Mobile-Toggle, Card-Layouts, Media Queries).

## Phase 1: Kritisch (sofort)

### 1.1 TeacherHome.css – Syntaxfehler beheben

Datei: `src/modules/elternsprechtag/pages/teacher/TeacherHome.css` Zeile 262

Ueberfluessige `}` nach dem `@media (max-width: 640px)` Block entfernen:

```css
/* Zeile 256-260: korrekt */
@media (max-width: 640px) {
  .teacher-home__stats {
    grid-template-columns: 1fr;
  }
}
/* Zeile 262: diese } entfernen */
```

## Phase 2: Hoch (naechster Sprint)

### 2.1 Modal-Navigationspfeile vergroessern

Datei: `src/components/TeacherRequestsTableSandbox.css`

```css
@media (max-width: 520px) {
  .sandbox-modal__nav > .sandbox-nav-arrow {
    width: 44px;     /* war 28px */
    height: 44px;    /* war 28px */
    min-width: 44px;
  }
}
```

### 2.2 Slot-Picker Touch-Targets

Datei: `src/components/TeacherRequestsTableSandbox.css`

```css
.sandbox-multi-select__item {
  padding: 0.6rem 14px;   /* war 6px */
  min-height: 44px;
  align-items: center;
}
```

## Phase 3: Mittel/Niedrig (Backlog)

### 3.1 TeacherBookings stat-card

Datei: `src/pages/TeacherBookings.tsx` Zeile 246

```tsx
style={{ flex: '1 1 220px', minWidth: 0, ... }}
```

### 3.2 Teacher-Bookings-Table Padding auf kleinen Phones

Datei: `src/pages/AdminDashboard.css`

```css
@media (max-width: 480px) {
  .admin-dashboard--teacher .teacher-bookings-table tbody tr {
    padding: 0.6rem 0.7rem;
  }
  .admin-dashboard--teacher .teacher-bookings-table tbody td {
    grid-template-columns: 100px 1fr;
    font-size: 0.88rem;
  }
}
```

### 3.3 Toten Code entfernen

Datei: `src/components/TeacherRequestsTableSandbox.css`
- `.sandbox-grid { min-width: 1160px; ... }` entfernen
- Veraltete `.sandbox-table__desktop` und `.sandbox-grid`-Regeln pruefen
