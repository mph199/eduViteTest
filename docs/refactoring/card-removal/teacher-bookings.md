# TeacherBookings — Card-Entfernung

## Befund
`stat-card teacher-table-section teacher-bookings-section` (Zeile 298) — halbe Seite als stat-card.
Die Toolbar + Karten/Tabelle brauchen keine äußere Box.

## Vorher
```tsx
<section className="stat-card teacher-table-section teacher-bookings-section">
  <div className="teacher-bookings-toolbar">...</div>
  <div className="date-groups">...</div>
</section>
```

## Nachher
```tsx
<section className="content-section">
  <div className="teacher-bookings-toolbar">...</div>
  <div className="date-groups">...</div>
</section>
```
