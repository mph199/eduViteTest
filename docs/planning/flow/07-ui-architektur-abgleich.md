# Flow Modul – Phase 7: UI-Architektur – Abgleich Pitch vs. eduVite

> Eingabe: UI-Architektur-Pitch (Maerz 2026)
> Abgleich gegen: bestehende eduVite-Architektur (Stand 2026-03-20)

## Zusammenfassung

Der Pitch beschreibt ein **eigenstaendiges Design-System**. eduVite hat bereits ein
funktionierendes CSS-System mit eigenen Konventionen. Dieser Abgleich klaert, was
uebernommen wird, was angepasst werden muss und was nicht passt.

**Grundsatzentscheidung:** Das Design-System des Pitches wird fuer Flow **adaptiert**,
nicht 1:1 umgesetzt. Flow nutzt die bestehende eduVite-Infrastruktur (CSS Custom Properties,
Plain CSS, globales Layout) und erweitert sie wo noetig.

---

## 1. CSS-Framework: TailwindCSS vs. Plain CSS

### Pitch: TailwindCSS (utility classes, tailwind.config.ts)
### eduVite: Plain CSS mit Custom Properties + BEM-nahe Klassen

| Aspekt | Pitch | eduVite Ist-Zustand |
|---|---|---|
| Framework | TailwindCSS | Kein Framework, Plain CSS |
| Token-System | `tailwind.config.ts → theme.extend.colors` | CSS Custom Properties in `src/index.css` `:root` |
| Klassen | Utility (`className="p-7 px-8"`) | BEM-nah (`.admin-dashboard__card`) |
| Responsive | Tailwind Breakpoints | Media Queries in Plain CSS |
| Theming | Tailwind Config | `var(--brand-primary)` etc. |

### Entscheidung: **Kein TailwindCSS einfuehren.**

Gruende:
1. eduVite hat 30+ CSS-Dateien mit konsistenten Patterns -- Tailwind parallel einzufuehren wuerde zwei Systeme erzwingen
2. Bestehende RGB-Helfer (`rgba(var(--brand-primary-rgb), 0.12)`) sind tief verankert
3. Glassmorphism-Pattern, dynamische CSS-Variablen (`--globalTopHeaderHeight`) und Mobile-Card-Tabellen sind mit Tailwind nicht direkt abbildbar
4. Kein technischer Schulden-Grund fuer den Wechsel

### Konsequenz: Design-Tokens aus dem Pitch werden als CSS Custom Properties umgesetzt

```css
/* src/modules/flow/flow.css – oder in src/index.css ergaenzen */

:root {
    /* Flow Design Tokens – abgeleitet aus UI-Pitch, angepasst an eduVite */
    --flow-bg: #f7f8fa;
    --flow-surface: #ffffff;
    --flow-surface-hover: #f9fafb;
    --flow-text: var(--brand-ink);           /* Mapping auf eduVite-Token */
    --flow-text-secondary: #4a5568;
    --flow-text-muted: #94a0b4;
    --flow-border: #e5e7ec;
    --flow-border-strong: #d1d5de;

    /* Akzente */
    --flow-brand: #3b6de0;
    --flow-brand-light: #edf2fc;
    --flow-green: #2f855a;
    --flow-green-light: #f0faf4;
    --flow-green-muted: #5a8a6e;
    --flow-amber: #b7791f;
    --flow-amber-light: #fefcf3;
    --flow-red: #c53030;
    --flow-red-light: #fdf2f2;

    /* Ist/Soll Labels */
    --flow-ist-label: #9b6b6b;
    --flow-soll-label: #5a8a6e;

    /* Sidebar (falls Flow eigene Sidebar bekommt) */
    --flow-sidebar: #1a1f36;
    --flow-sidebar-hover: #252b45;
    --flow-sidebar-active: var(--flow-brand);
    --flow-sidebar-text: #94a0b4;

    /* Radien */
    --flow-radius: 6px;
    --flow-radius-sm: 4px;

    /* Shadows */
    --flow-shadow-sm: 0 1px 2px rgba(0,0,0,0.03);
    --flow-shadow-md: 0 2px 8px rgba(0,0,0,0.05);

    /* Module Accent (fuer Registry) */
    --module-accent-flow: #3b6de0;
}
```

---

## 2. Layout: Eigene AppShell vs. eduVite-Layout

### Pitch: Eigene AppShell (272px fixed Sidebar + Topbar + Content)
### eduVite: GlobalTopHeader (sticky) + Off-Canvas-Drawer + Content Area

| Aspekt | Pitch | eduVite |
|---|---|---|
| Sidebar | 272px fixed, immer sichtbar, dark | Off-Canvas-Drawer, 220ms Animation |
| Topbar | 52px, kontextabhaengig, im Content-Bereich | GlobalTopHeader, sticky, glassmorphic, global |
| Content | `ml-[272px]`, `p-7 px-8` | Max-width 1280px, `page-bg-overlay` |
| Responsive | Sidebar hidden < 800px | Drawer standardmaessig geschlossen |

### Entscheidung: **Hybrid-Ansatz**

Flow laeuft innerhalb des bestehenden eduVite-Layouts (`GlobalTopHeader` + `ProtectedRoute`).
Innerhalb des Flow-Content-Bereichs wird eine **Flow-spezifische Sidebar** als
Sekundaernavigation gerendert -- kein Ersatz fuer die globale Navigation, sondern eine
Ergaenzung.

```
┌──────────────────────────────────────────────────────────────┐
│  GlobalTopHeader (eduVite, sticky, glassmorphic)              │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│  Flow        │  Flow Content Area                            │
│  Sidebar     │  (Topbar-Element als Komponente, nicht global) │
│  (optional,  │                                               │
│  innerhalb   │  → Dashboard, Bildungsgang, Arbeitspaket      │
│  Content)    │                                               │
│              │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

### Option A: Flow-Sidebar als Sekundaernavigation (empfohlen)

```tsx
// src/modules/flow/components/FlowLayout.tsx
export function FlowLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flow-layout">
            <FlowSidebar />
            <div className="flow-content">
                <FlowTopbar />
                {children}
            </div>
        </div>
    );
}
```

CSS:
```css
.flow-layout {
    display: flex;
    min-height: calc(100vh - var(--globalTopHeaderHeight, 52px));
}
.flow-sidebar {
    width: 260px;
    flex-shrink: 0;
    background: var(--flow-sidebar);
    color: var(--flow-sidebar-text);
    overflow-y: auto;
}
.flow-content {
    flex: 1;
    padding: 28px 32px;
    min-width: 0;
}

/* Responsive: Sidebar ausblenden */
@media (max-width: 800px) {
    .flow-sidebar { display: none; }
    .flow-content { padding: 20px; }
}
```

### Option B: Ohne eigene Sidebar (minimaler Ansatz)

Flow nutzt nur die bestehende `sidebarNav`-Konfiguration im Modul-Manifest
und rendert Bildungsgaenge als Navigation innerhalb des Content-Bereichs
(z.B. als Tab-Leiste oder Card-Grid auf dem Dashboard).

### Offener Punkt

Die Entscheidung zwischen Option A und B haengt davon ab, wie viel visuelle
Eigenstaendigkeit Flow haben soll. Option A ist naeher am Pitch, Option B
ist konsistenter mit dem restlichen eduVite.

---

## 3. Typografie

### Pitch: Outfit (Body + Headings) + JetBrains Mono (Badges, Dates, Stats)
### eduVite: Manrope (alles) + kein Mono-Font

| Aspekt | Pitch | eduVite |
|---|---|---|
| Body-Font | Outfit | Manrope |
| Mono-Font | JetBrains Mono | Nicht vorhanden |
| Gewichte | 400, 500, 600, 700 (nie 800) | 400, 500, 600, 700, 800 |

### Entscheidung: **Manrope beibehalten, JetBrains Mono ergaenzen**

Outfit durch Manrope ersetzen geht problemlos (aehnliche Charakteristik).
JetBrains Mono fuer Badges, Daten und Stats ist ein sinnvolles neues Element,
das den Pitch-Charakter traegt und bestehende Seiten nicht beeinflusst.

```html
<!-- index.html – zusaetzlicher Google Fonts Link -->
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

```css
:root {
    --flow-font-mono: 'JetBrains Mono', monospace;
}
```

Verwendung: Nur in Flow-Komponenten fuer Badges, Datum/Uhrzeit, Statistik-Werte,
Deadline-Anzeigen. Nicht global.

---

## 4. Farben: Pitch-Palette vs. eduVite-Palette

### Kritische Abweichung

| Token | Pitch | eduVite | Konflikt? |
|---|---|---|---|
| Brand/Primary | `#3b6de0` (helles Blau) | `#123C73` (Navy) | **Ja** |
| Text | `#1e2330` | `var(--brand-ink)` | Gering |
| Success/Green | `#2f855a` | `var(--brand-success)` | Pruefen |
| Error/Red | `#c53030` | `var(--brand-error)` | Pruefen |

### Entscheidung: **Flow-Brand als eigener Token, nicht globales brand ersetzen**

`--flow-brand: #3b6de0` ist der Flow-Akzent. Das globale `--brand-primary: #123C73`
bleibt unangetastet. Flow-Komponenten verwenden `var(--flow-brand)` statt
`var(--brand-primary)`. Das ist konsistent mit dem bestehenden Modul-Akzent-System
(`--module-accent-flow`).

Semantische Farben (Error, Success, Warning) sollten die eduVite-Tokens nutzen,
falls sie in der gleichen Farbfamilie liegen. Falls nicht, werden Flow-spezifische
Varianten definiert.

---

## 5. Komponenten-Struktur

### Pitch: `src/components/`, `src/pages/`, `src/hooks/`, `src/utils/`
### eduVite-Konvention: Alles unter `src/modules/flow/`

| Pitch-Pfad | eduVite-Pfad | Grund |
|---|---|---|
| `src/components/layout/AppShell.tsx` | `src/modules/flow/components/FlowLayout.tsx` | Modul-gekapselt |
| `src/components/layout/Sidebar.tsx` | `src/modules/flow/components/FlowSidebar.tsx` | Modul-gekapselt |
| `src/components/layout/Topbar.tsx` | `src/modules/flow/components/FlowTopbar.tsx` | Modul-gekapselt |
| `src/components/shared/Panel.tsx` | `src/modules/flow/components/Panel.tsx` | Flow-spezifisch |
| `src/components/shared/StatusBadge.tsx` | `src/modules/flow/components/StatusBadge.tsx` | Flow-spezifisch |
| `src/components/shared/AvatarGruppe.tsx` | `src/modules/flow/components/AvatarGruppe.tsx` | Flow-spezifisch |
| `src/components/shared/FortschrittsBalken.tsx` | `src/modules/flow/components/FortschrittsBalken.tsx` | Flow-spezifisch |
| `src/components/shared/DeadlineAnzeige.tsx` | `src/modules/flow/components/DeadlineAnzeige.tsx` | Flow-spezifisch |
| `src/components/shared/HinweisChip.tsx` | `src/modules/flow/components/HinweisChip.tsx` | Flow-spezifisch |
| `src/components/shared/LeerZustand.tsx` | `src/modules/flow/components/LeerZustand.tsx` | Flow-spezifisch |
| `src/components/shared/Breadcrumb.tsx` | `src/modules/flow/components/Breadcrumb.tsx` | Flow-spezifisch |
| `src/components/shared/RollenGuard.tsx` | `src/modules/flow/components/RollenGuard.tsx` | Flow-spezifisch |
| `src/pages/DashboardPage.tsx` | `src/modules/flow/pages/FlowDashboard.tsx` | Modul-Page |
| `src/pages/BildungsgangPage.tsx` | `src/modules/flow/pages/BildungsgangPage.tsx` | Modul-Page |
| `src/pages/ArbeitspaketPage.tsx` | `src/modules/flow/pages/ArbeitspaketPage.tsx` | Modul-Page |
| `src/pages/MeineAufgabenPage.tsx` | `src/modules/flow/pages/MeineAufgabenPage.tsx` | Modul-Page |
| `src/pages/AbteilungPage.tsx` | `src/modules/flow/pages/AbteilungPage.tsx` | Modul-Page |
| `src/hooks/use*.ts` | `src/modules/flow/hooks/use*.ts` | Modul-Hooks |
| `src/utils/*.ts` | `src/modules/flow/utils/*.ts` | Modul-Utils |
| `src/types/index.ts` | `src/types/index.ts` | **Bleibt global** (Hard Rule #7) |

### Konsequenz: Alle Pitch-Dateien wandern unter `src/modules/flow/`

Ausnahmen:
- **Types** bleiben in `src/types/index.ts` (Projektkonvention)
- **API-Client** bleibt in `src/services/api.ts` (Hard Rule #8)
- **CSS Custom Properties** in `src/index.css` oder als eigene `flow.css` die dort importiert wird

---

## 6. Detailvergleich: Shared Components

### Panel

Pitch definiert Panel als Container mit Header + Action + Body. eduVite hat kein
aequivalentes Shared Component. **Uebernehmen wie im Pitch**, aber mit CSS Custom
Properties statt Tailwind.

### StatusBadge

Pitch: JetBrains Mono, 10px, 3px radius, farbiger Hintergrund + 1px Border.
eduVite hat `.status-pill` (pill-form, groesser). **Flow-StatusBadge ist ein
neues Component**, kein Replacement fuer das bestehende.

### AvatarGruppe

Pitch: Ueberlappende farbige Kreise mit Initialen. eduVite hat Inline-Avatar
in `SidebarProfile.tsx`, aber kein shared Component.
**Uebernehmen wie im Pitch.**

### Breadcrumb

eduVite hat keins. **Uebernehmen wie im Pitch.**

### RollenGuard

Pitch: Rendert children nur bei passender Rolle. eduVite hat `ProtectedRoute`
(Route-Level), aber kein Component-Level Guard.
**Uebernehmen, aber serverseitige Pruefung bleibt Pflicht.**

---

## 7. CSS-Implementierungsstrategie

Alle Flow-Styles in einer eigenen CSS-Datei:

```
src/modules/flow/flow.css
```

Importiert in `src/modules/flow/components/FlowLayout.tsx`:
```tsx
import '../flow.css';
```

**Namespacing:** Alle CSS-Klassen beginnen mit `flow-` um Kollisionen zu vermeiden:
```css
.flow-layout { ... }
.flow-sidebar { ... }
.flow-topbar { ... }
.flow-panel { ... }
.flow-panel__header { ... }
.flow-panel__body { ... }
.flow-stat-card { ... }
.flow-stat-card__value { ... }
.flow-status-badge { ... }
.flow-status-badge--aktiv { ... }
.flow-task-row { ... }
.flow-task-row:hover { ... }
.flow-hinweis-chip { ... }
.flow-hinweis-chip--warn { ... }
.flow-hinweis-chip--alert { ... }
.flow-breadcrumb { ... }
.flow-progress-bar { ... }
.flow-avatar { ... }
.flow-avatar-group { ... }
```

---

## 8. Elemente die 1:1 uebernommen werden

Diese Design-Spezifikationen aus dem Pitch sind direkt umsetzbar:

- [x] Radien (6px / 4px / 3px)
- [x] Schatten (shadow-sm / shadow-md)
- [x] Hover-Verhalten (border-color + shadow, kein translateY)
- [x] Transition: 0.12-0.15s
- [x] Stat-Strip mit Accent-Bar (2px oben)
- [x] Hinweis-Chips (Dot + Text + farbiger Border)
- [x] Aufgaben-Checkboxen (3 States: leer, dashed, filled)
- [x] Deadline-Badge-Logik (ok/soon/overdue/done)
- [x] Ist/Soll-Labels mit gemuteten Toenen
- [x] Arbeitspaket-Card mit Left-Border
- [x] Uebersicht-Panel mit Progress Bar
- [x] Beteiligte-Panel mit Avatar + Rolle
- [x] Abteilungssicht als reine Tabelle ohne Details
- [x] Responsive Breakpoints (1100px, 800px)
- [x] Interaktionsverhalten (Hover, Checkbox-Optimistic-Update)

## 9. Elemente die angepasst werden muessen

| Pitch-Element | Anpassung | Grund |
|---|---|---|
| TailwindCSS-Klassen | CSS Custom Properties + BEM-nahe Klassen | Kein Tailwind im Projekt |
| `className="p-7 px-8"` | `.flow-content { padding: 28px 32px; }` | Plain CSS |
| `bg: '#f7f8fa'` | `--flow-bg: #f7f8fa` oder `var(--brand-surface-1)` falls identisch | Token-System |
| Outfit-Font | Manrope (bereits geladen) | Projektstandard |
| Eigene AppShell | FlowLayout innerhalb des eduVite-Layouts | Globales Layout bleibt |
| `src/components/shared/` | `src/modules/flow/components/` | Modul-Kapselung |
| `src/types/` im Modul | `src/types/index.ts` global | Hard Rule #7 |
| Sidebar als Top-Level | Sekundaernavigation im Content-Bereich | eduVite hat Off-Canvas-Drawer |

## 10. Offene Entscheidungen

1. **Flow-Sidebar (Option A) vs. ohne Sidebar (Option B):** Soll Flow eine eigene
   dunkle Seitenleiste innerhalb des Content-Bereichs haben, oder reicht die
   Navigation ueber Dashboard-Cards und Breadcrumbs?

2. **Brand-Farbe:** Pitch definiert `#3b6de0` als Flow-Brand. Das ist ein helleres
   Blau als eduVites `#123C73` (Navy). Soll Flow visuell eigenstaendig wirken oder
   sich farblich an die bestehende Palette anpassen?

3. **Zustand (Zustand.js):** Pitch erwaehnt Zustand fuer Client State. eduVite nutzt
   aktuell keins. Ist das noetig oder reicht TanStack Query + React Context?
