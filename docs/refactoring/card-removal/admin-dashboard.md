# AdminDashboard — Card-Entfernung

## Befunde

### 1. `teacher-form-container` um "Aktive Events" (Zeile 207)
- **Vorher**: Tabelle in `teacher-form-container` (white + shadow + border-radius)
- **Nachher**: `content-section` mit Überschrift + Tabelle direkt

### 2. `teacher-form-container` um "Buchungen des Kollegiums" (Zeile 273)
- **Vorher**: Dreifache Verschachtelung (teacher-form-container → stat-card → table)
- **Nachher**: `content-section` mit Überschrift + Filter direkt + Tabelle

### 3. `stat-card` als Filter-Wrapper (Zeile 280)
- **Vorher**: Filterleiste in `stat-card` (semantisch falsch)
- **Nachher**: Filter-Elemente direkt über der Tabelle

## Beibehaltene Elemente
- `admin-resp-table-container` (Tabellen-Rahmen)
- `admin-resp-table` (Tabelle selbst)
