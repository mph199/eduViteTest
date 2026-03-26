# Superadmin-Optimierungen: Dokumentation

## Umgesetzte Änderungen

### 1. Tab-Umbenennung
- **"Sprechtagsmodul"** → **"Buchungsseiten-Texte"**
- Begründung: Der alte Name suggerierte fälschlich, es ginge nur um das Elternsprechtag-Modul

### 2. Verständliche Farb-Labels

| Vorher | Nachher |
|--------|---------|
| Primärfarbe | Buttons & Hervorhebungen |
| Primär dunkel | Überschriften & Navigation |
| Primär dunkler | Navigation aktiv / Hover |
| Sekundärfarbe | Akzentfarbe (Links, Slots) |
| Akzentfarbe (Ink) | Textfarbe & Ränder |
| Hintergrund hell | Seitenhintergrund |
| Hintergrund mittel | Abschnittshintergrund |

### 3. Logo-Upload und Header-Anzeige

- **Neues Upload-Feld** im Branding-Tab (Abschnitt "Schulname & Header")
- Empfohlene Maße: max. 200 x 60 px, PNG oder WebP mit Transparenz
- Max. Dateigröße: 2 MB
- Upload synct automatisch `site_branding.logo_url` und `email_branding.logo_url`
- **Logo im GlobalTopHeader** neben dem Schulnamen angezeigt (32px Höhe)
- `onError`-Handler versteckt Bild bei Ladefehler (graceful degradation)
- Logo-Entfernen-Button im Branding-Tab

### 4. Button-Text-Kontrast

- **Automatische Luminanz-Berechnung** (WCAG 2.1) in `BrandingContext.tsx`
- Neue CSS-Variable `--brand-button-text`:
  - Helle Primärfarbe (Luminanz > 0.35) → dunkler Text (`#1a1a1a`)
  - Dunkle Primärfarbe → weißer Text (`#ffffff`)
- Angewendet in: Booking-Steps (`.cb-step--active`), Slot-Auswahl (`.cb-slot--selected`)

### 5. Backend-Fixes

- **Hex-Validierung** für `email-branding.primary_color` nachgerüstet (gleiche Logik wie `site-branding`)
- **Logo-Upload** synct jetzt beide Tabellen (`site_branding` + `email_branding`)

## Nicht umgesetzt (Backlog)

| # | Optimierung | Priorität | Begründung |
|---|-------------|-----------|-----------|
| 1 | Auflösungs-/Dimensionslimits für Logo-Uploads | Mittel | Erfordert serverseitige Bildverarbeitung (sharp) |
| 2 | Fehler-/Erfolgsfarben konfigurierbar | Mittel | Erfordert DB-Migration + UI-Erweiterung |
| 3 | WCAG-Kontrastwarnung im Branding-Tab | Mittel | Zusätzliche UI-Komponente |
| 4 | Alte Logos beim Überschreiben löschen | Niedrig | Speicherplatz-Optimierung |
| 5 | Längenbegrenzung für Textfelder | Niedrig | Kein kritisches Risiko |

## Geänderte Dateien

| Datei | Änderung |
|-------|---------|
| `backend/routes/superadmin.js` | Logo-Sync + Hex-Validierung |
| `src/pages/SuperadminPage/index.tsx` | Tab-Label |
| `src/pages/SuperadminPage/BrandingTab.tsx` | Farb-Labels + Logo-Upload |
| `src/components/GlobalTopHeader.tsx` | Logo-Bild im Header |
| `src/components/GlobalTopHeader.css` | Logo-Styling |
| `src/contexts/BrandingContext.tsx` | Luminanz + --brand-button-text |
| `src/shared/components/CounselorBookingApp.css` | --brand-button-text Nutzung |
