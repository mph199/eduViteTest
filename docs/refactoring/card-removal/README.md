# Container-Card-Entfernung: Übersicht

## Prinzip
Wenn alles in einer Box ist, ist nichts hervorgehoben. Container-Cards werden entfernt wenn sie nur als visueller Wrapper dienen.

## Zusammenfassung der Befunde

| # | Seite | Klasse | Aktion | Prio |
|---|-------|--------|--------|------|
| 1 | AdminDashboard | `teacher-form-container` (2x) | ENTFERNEN | Hoch |
| 2 | AdminDashboard | `stat-card` (Filter-Wrapper) | ENTFERNEN | Hoch |
| 3 | AdminSlots | `teacher-form-container` (Page-Wrapper) | ENTFERNEN | Hoch |
| 4 | TeacherBookings | `stat-card teacher-bookings-section` | ENTFERNEN | Hoch |
| 5 | SSWCounselorsTab | `teacher-form-container` (Edit-Form) | ENTFERNEN | Mittel |
| 6 | BLSprechzeitenTab | `teacher-form-container` (Wochenplan) | ENTFERNEN | Mittel |
| 7 | TeacherHome | `teacher-home__next-card` | PRÜFEN | Niedrig |

## Hauptursache
`teacher-form-container` wird als universeller Page-Wrapper missbraucht (white BG + padding + border-radius + box-shadow). Der Name suggeriert ein Formular, aber die Klasse umschließt ganze Seiten.

## Ersatz-Pattern
- Sektionsüberschrift + Abstand + Inhalt + optionale Trennlinie
- CSS-Klasse `.content-section` mit `margin-bottom: 32px`
- Tabellen behalten ihren `admin-resp-table-container`

## Dateien
- [AdminDashboard](./admin-dashboard.md)
- [AdminSlots](./admin-slots.md)
- [TeacherBookings](./teacher-bookings.md)
- [SSWCounselorsTab](./ssw-counselors.md)
- [BLSprechzeitenTab](./bl-sprechzeiten.md)
- [TeacherHome](./teacher-home.md)
- [Beibehaltene Cards](./cards-behalten.md)
