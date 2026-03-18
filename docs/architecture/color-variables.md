# Farbvariablen-Referenz

> Zentrale Dokumentation aller CSS Custom Properties fuer Farben.
> Definiert in `src/index.css` `:root`.

## Regeln

1. **Keine hardcodierten Farben** ausserhalb von `:root` (Regel 5 in CLAUDE.md).
2. Neue Farben immer als Variable in `src/index.css` `:root` anlegen.
3. Fuer `rgba()`-Nutzung ein `-rgb`-Pendant definieren: `--color-foo-rgb: R, G, B;`
4. Syntax: `rgba(var(--color-foo-rgb), 0.5)` — nicht `rgba(R, G, B, 0.5)`.
5. `SuperadminPage.css` ist vom Variablen-Zwang ausgenommen (eigenes Dark Theme).
6. `var()`-Fallbacks sind erlaubt: `var(--brand-primary, #123C73)`.

---

## Brand / Theme Tokens

| Variable | Wert | Verwendung |
|----------|------|------------|
| `--brand-primary` | `#123C73` | Primaere Markenfarbe (Navy) |
| `--brand-primary-dark` | `#0B2545` | Dunklere Variante |
| `--brand-primary-darker` | `#081D38` | Dunkelste Variante |
| `--brand-secondary` | `#5B8DEF` | Sekundaerfarbe |
| `--brand-ink` | `#0B2545` | Standard-Textfarbe |
| `--brand-surface-1` | `#F8FAFC` | Heller Hintergrund |
| `--brand-surface-2` | `#D9E4F2` | Mittlerer Hintergrund |
| `--brand-login` | `var(--brand-ink)` | Login-Seite Primaerfarbe |
| `--brand-login-hover` | `var(--brand-primary)` | Login-Seite Hover |
| `--brand-gradient-end` | `#c3cfe2` | Login-Gradient Endfarbe |

### Brand RGB-Pendants

| Variable | Wert |
|----------|------|
| `--brand-primary-rgb` | `18, 60, 115` |
| `--brand-primary-dark-rgb` | `11, 37, 69` |
| `--brand-primary-darker-rgb` | `8, 29, 56` |
| `--brand-ink-rgb` | `11, 37, 69` |

---

## Neutral / UI Palette (Gray)

| Variable | Wert | Verwendung |
|----------|------|------------|
| `--color-white` | `#ffffff` | Weiss |
| `--color-black` | `#000000` | Schwarz |
| `--color-gray-50` | `#f9fafb` | Hellster Grauton |
| `--color-gray-100` | `#f3f4f6` | — |
| `--color-gray-200` | `#e5e7eb` | Borders, Dividers |
| `--color-gray-300` | `#d1d5db` | — |
| `--color-gray-400` | `#9ca3af` | Disabled States |
| `--color-gray-500` | `#6b7280` | Sekundaerer Text |
| `--color-gray-600` | `#4b5563` | — |
| `--color-gray-700` | `#374151` | — |
| `--color-gray-800` | `#1f2937` | — |
| `--color-gray-900` | `#111827` | Dunkelster Text |

### Gray RGB-Pendants

| Variable | Wert |
|----------|------|
| `--color-white-rgb` | `255, 255, 255` |
| `--color-black-rgb` | `0, 0, 0` |
| `--color-gray-50-rgb` | `249, 250, 251` |
| `--color-gray-100-rgb` | `243, 244, 246` |
| `--color-gray-200-rgb` | `229, 231, 235` |
| `--color-gray-500-rgb` | `107, 114, 128` |
| `--color-gray-800-rgb` | `31, 41, 55` |
| `--color-gray-900-rgb` | `17, 24, 39` |

---

## Slate Palette (Admin UI)

| Variable | Wert |
|----------|------|
| `--color-slate-300` | `#cbd5e1` |
| `--color-slate-400` | `#94a3b8` |
| `--color-slate-500` | `#64748b` |
| `--color-slate-600` | `#475569` |
| `--color-slate-700` | `#334155` |
| `--color-slate-800` | `#1e293b` |
| `--color-slate-900` | `#0f172a` |

### Slate RGB-Pendants

| Variable | Wert |
|----------|------|
| `--color-slate-200-rgb` | `226, 232, 240` |
| `--color-slate-900-rgb` | `15, 23, 42` |

---

## Semantische Statusfarben

### Error (Rot)

| Variable | Wert | Verwendung |
|----------|------|------------|
| `--color-error` | `#991b1b` | Fehlertext |
| `--color-error-light` | `#fee2e2` | Fehler-Hintergrund |
| `--color-error-border` | `#fca5a5` | Fehler-Rahmen |
| `--color-error-accent` | `#ef4444` | Fehler-Akzent |
| `--color-error-dark` | `#b91c1c` | Dunkler Fehler-Akzent |

| RGB-Pendant | Wert |
|-------------|------|
| `--color-error-light-rgb` | `254, 226, 226` |
| `--color-error-border-rgb` | `252, 165, 165` |
| `--color-error-dark-rgb` | `185, 28, 28` |

### Success (Gruen)

| Variable | Wert | Verwendung |
|----------|------|------------|
| `--color-success-light` | `#d1fae5` | Erfolg-Hintergrund |
| `--color-success-accent` | `#22c55e` | Erfolg-Akzent |

| RGB-Pendant | Wert |
|-------------|------|
| `--color-success-accent-rgb` | `34, 197, 94` |

### Warning (Gelb/Orange)

| Variable | Wert | Verwendung |
|----------|------|------------|
| `--color-warning-light` | `#fef3c7` | Warnung-Hintergrund |
| `--color-warning` | `#92400e` | Warnung-Text |
| `--color-warning-accent` | `#eab308` | Warnung-Akzent |

| RGB-Pendant | Wert |
|-------------|------|
| `--color-warning-accent-rgb` | `245, 158, 11` |

### Info (Blau)

| Variable | Wert | Verwendung |
|----------|------|------------|
| `--color-info-light` | `#dbeafe` | Info-Hintergrund |
| `--color-info` | `#1e40af` | Info-Text |
| `--color-info-accent` | `#3b82f6` | Info-Akzent |
| `--color-info-dark` | `#1d4ed8` | Dunkler Info-Akzent |
| `--color-info-50` | `#e0f2fe` | Selection Hover |
| `--color-info-100` | `#dbeafe` | Selection Aktiv |
| `--color-info-200` | `#bfdbfe` | Selection Aktiv+Hover |

| RGB-Pendant | Wert |
|-------------|------|
| `--color-info-accent-rgb` | `59, 130, 246` |
| `--color-info-dark-rgb` | `29, 78, 216` |

---

## Akzentfarben (Request-Karten)

| Variable | Wert | Verwendung |
|----------|------|------------|
| `--color-accent-purple` | `#c4b5fd` | Violetter Akzent |
| `--color-accent-green` | `#a7f3d0` | Gruener Akzent |
| `--color-accent-pink` | `#fbcfe8` | Rosa Akzent |
| `--color-accent-blue` | `#bfdbfe` | Blauer Akzent |

---

## Utility RGB-Werte

| Variable | Wert | Verwendung |
|----------|------|------------|
| `--color-orange-400-rgb` | `251, 146, 60` | Orange-Akzent in Admin |

---

## Modul-Akzentfarben

| Variable | Wert | Modul |
|----------|------|-------|
| `--module-accent-elternsprechtag` | `#1a7f7a` | Elternsprechtag |
| `--module-accent-beratungslehrer` | `#b8860b` | Beratungslehrer |
| `--module-accent-schulsozialarbeit` | `#cd5c5c` | Schulsozialarbeit |

### Modul RGB-Pendants

| Variable | Wert |
|----------|------|
| `--module-accent-elternsprechtag-rgb` | `26, 127, 122` |
| `--module-accent-beratungslehrer-rgb` | `184, 134, 11` |
| `--module-accent-schulsozialarbeit-rgb` | `205, 92, 92` |

---

## Verwendungsbeispiele

### Einfache Farbzuweisung

```css
.element {
  color: var(--brand-primary);
  background: var(--color-white);
  border-color: var(--color-gray-200);
}
```

### RGBA mit Transparenz

```css
.overlay {
  background: rgba(var(--color-black-rgb), 0.5);
  border: 1px solid rgba(var(--brand-primary-rgb), 0.3);
}
```

### Fallback-Werte

```css
.themed {
  /* Fallback falls Variable nicht definiert */
  color: var(--brand-primary, #123C73);

  /* Verschachtelt: Gruppen-Akzent mit Brand-Fallback */
  background: rgba(var(--group-accent-rgb, var(--brand-primary-rgb)), 0.1);
}
```

### Neue Farbe hinzufuegen

1. Variable in `src/index.css` `:root` definieren
2. Falls RGBA-Nutzung noetig: `-rgb`-Pendant hinzufuegen
3. Diese Dokumentation aktualisieren
4. `npm run build` ausfuehren
