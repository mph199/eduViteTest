# Flow Modul – Phase 5: Frontend-Komponenten und Modul-Registrierung

> **Implementierungsstand (2026-03-21):**
> - Alle Kern-Seiten implementiert: FlowDashboard, BildungsgangPage (mit Mitglieder-Anzeige), ArbeitspaketPage (Tab-basiert: Aufgaben-CRUD, Tagungen, Mitglieder, Dateien, Aktivitaeten, Status-Workflow, Abschluss-Dialog), TagungDetailPage (Agenda-Editor, Dokumentation, Aufgabenerstellung aus Agenda), MeineAufgabenPage (mit Links zu Arbeitspaketen), AbteilungPage (klickbare Navigation), ArbeitspaketErstellenPage, AdminBGLVerwaltung
> - Layout: FlowLayout (teacherLayout, QueryClientProvider zentral), FlowSidebar (rollenabhaengige Admin-Sektion), DeadlineAnzeige, FortschrittsBalken, StatusBadge
> - Admin-Seiten laufen als `teacherRoutes` unter `/teacher/flow/admin/*` innerhalb FlowLayout – keine separaten `adminRoutes`
> - Neue Route: `/teacher/flow/tagung/:id` (TagungDetailPage) – flache Route, nicht nested unter `arbeitspaket/:id`
> - Sidebar: ein einzelner Einstiegslink "Hier geht's zu Flow" (`path: '/teacher/flow'`)
> - `hooks/`- und `utils/`-Verzeichnis nicht angelegt – Logik direkt in Seiten-Komponenten
> - `pages/`-Unterordner fuer Seiten, `components/` fuer wiederverwendbare UI-Teile
> - **Refactoring (2026-03-21):** ArbeitspaketPage.tsx (755 → 321 Zeilen) in 5 Tab-Komponenten aufgeteilt: AufgabenTab, TagungenTab, MitgliederTab, DateienTab, AktivitaetenTab (alle in `components/`). Neue shared Komponente ErrorBanner.tsx in `components/`; genutzt von ArbeitspaketPage, TagungDetailPage, ArbeitspaketErstellenPage.

> Abhaengigkeiten: Phase 4 (Types + API Client)
> Neue Dateien:
> - `src/modules/flow/index.ts`
> - `src/modules/flow/components/*.tsx`
> - `src/modules/flow/hooks/*.ts`
> - `src/modules/flow/utils/*.ts`
> Aenderungen in:
> - `src/modules/registry.ts` (Interface + Import)
> - `src/App.tsx` (Guard fuer Module ohne PublicPage)
> - `src/pages/LandingPage.tsx` (Filter fuer interne Module)
> - CSS: `--module-accent-flow` definieren

## Entscheidung (2026-03-20): Rein internes Modul

Flow ist **kein oeffentliches Buchungstool**. Es gibt:
- Keine Kachel auf der Landing Page
- Keine oeffentliche Seite (`PublicPage`)
- Keinen oeffentlichen `basePath`

Zugang nur ueber den eingeloggten Bereich (Lehrer-/Admin-Layout).

### Konsequenz: Anpassung am Modulsystem

Flow ist das erste Modul ohne oeffentlichen Einstiegspunkt. Das erfordert drei Aenderungen am bestehenden Code:

#### 1. `src/modules/registry.ts` -- PublicPage optional machen

```ts
// VORHER:
PublicPage: LazyExoticComponent<ComponentType>;

// NACHHER:
PublicPage?: LazyExoticComponent<ComponentType>;
```

Die bestehenden Module (Elternsprechtag, SSW, BL) sind davon nicht betroffen -- sie setzen `PublicPage` weiterhin.

#### 2. `src/App.tsx` -- Guard fuer Module ohne PublicPage

In der Route-Generierung (ca. Zeile 53-59) muss geprueft werden, ob `mod.PublicPage` existiert:

```tsx
// VORHER:
{activeModules.map((mod) => (
    <Route key={mod.id} path={`${mod.basePath}/*`}
        element={<mod.PublicPage />} />
))}

// NACHHER:
{activeModules.filter((mod) => mod.PublicPage).map((mod) => (
    <Route key={mod.id} path={`${mod.basePath}/*`}
        element={<mod.PublicPage />} />
))}
```

#### 3. `src/pages/LandingPage.tsx` -- Interne Module ausfiltern

Die Landing Page rendert Kacheln fuer alle `activeModules`. Module ohne `PublicPage` muessen herausgefiltert werden:

```tsx
// VORHER:
{activeModules.map((mod) => (
    <Link to={mod.basePath}>...</Link>
))}

// NACHHER:
{activeModules.filter((mod) => mod.PublicPage).map((mod) => (
    <Link to={mod.basePath}>...</Link>
))}
```

## Modul-Registrierung

### Frontend-Manifest (src/modules/flow/index.ts)

```ts
import { lazy } from 'react';
import type { ModuleDefinition } from '../registry';

const FlowDashboard = lazy(() =>
    import('./components/FlowDashboard').then((m) => ({ default: m.FlowDashboard }))
);

const FlowRouter = lazy(() =>
    import('./components/FlowRouter').then((m) => ({ default: m.FlowRouter }))
);

const AbteilungsDashboard = lazy(() =>
    import('./components/AbteilungsDashboard').then((m) => ({ default: m.AbteilungsDashboard }))
);

const flowModule: ModuleDefinition = {
    id: 'flow',
    title: 'Flow',
    description: 'Kollaborationsformat fuer Bildungsgaenge',
    icon: '',
    basePath: '/flow',
    accent: 'var(--module-accent-flow)',
    accentRgb: '59, 130, 246',
    requiredModule: 'flow',
    // KEIN PublicPage -- rein internes Modul
    adminRoutes: [
        {
            path: '/admin/flow/abteilung',
            label: 'Flow Abteilungssicht',
            Component: AbteilungsDashboard,
        },
    ],
    teacherLayout: FlowRouter,
    teacherRoutes: [
        { index: true, Component: FlowDashboard },
    ],
    sidebarNav: {
        label: 'Flow',
        items: [
            { path: '/flow', label: 'Dashboard' },
            { path: '/flow/aufgaben', label: 'Meine Aufgaben' },
        ],
    },
};

export default flowModule;
```

### Entscheidung (2026-03-20): Routing unter `/teacher/flow/*`

Flow laeuft unter `/teacher/flow/*` (konsistent mit bestehendem Pattern), bleibt aber ein **eigenstaendiges, anschaltbares Modul**:

| Steuerung | Mechanismus | Wert |
|---|---|---|
| Backend-Laden | `ENABLED_MODULES` (env) | `...,flow` |
| Frontend-Laden | `VITE_ENABLED_MODULES` (env, Build-time) | `...,flow` |
| Superadmin-Aktivierung | `module_config`-Tabelle | `module_id = 'flow'` |
| User-Zugang | `user_module_access`-Tabelle | `module_key = 'flow'` |
| Frontend-Sichtbarkeit | `requiredModule: 'flow'` im Manifest | Sidebar/Routen nur bei Zugang |

Flow kann unabhaengig von anderen Modulen aktiviert/deaktiviert werden. Das Routing unter `/teacher/` ist nur der URL-Pfad -- die Modul-Logik (Laden, Auth, Sichtbarkeit) laeuft komplett eigenstaendig.

### Registry-Eintrag (src/modules/registry.ts)

```ts
import flowModule from './flow/index';

const allModules: ModuleDefinition[] = [
    elternsprechtagModule,
    schulsozialarbeitModule,
    beratungslehrerModule,
    flowModule,              // NEU – kein PublicPage
];
```

## Komponentenstruktur (angepasst an eduVite-Patterns)

Das Fachkonzept definiert eine umfangreiche Komponentenhierarchie. Fuer die Integration in eduVite wird diese angepasst:

### Verzeichnisstruktur

```
src/modules/flow/
├── index.ts                              # ModuleDefinition (kein PublicPage, teacherBasePath)
├── flow.css                              # Design-Tokens, Layout, Komponenten-Styles
├── components/
│   ├── FlowLayout.tsx                    # teacherLayout mit QueryClientProvider + FlowSidebar
│   ├── FlowSidebar.tsx                   # Sidebar mit rollenabhaengiger Admin-Sektion
│   ├── StatusBadge.tsx                   # Entwurf/Geplant/Aktiv/Abgeschlossen
│   ├── FortschrittsBalken.tsx            # x von y Aufgaben
│   ├── DeadlineAnzeige.tsx               # ok/bald/ueberfaellig
│   ├── ErrorBanner.tsx                   # Fehleranzeige (genutzt von ArbeitspaketPage, TagungDetailPage, ArbeitspaketErstellenPage)
│   ├── AufgabenTab.tsx                   # Tab-Inhalt: Aufgaben-CRUD
│   ├── TagungenTab.tsx                   # Tab-Inhalt: Tagungen
│   ├── MitgliederTab.tsx                 # Tab-Inhalt: Mitglieder verwalten
│   ├── DateienTab.tsx                    # Tab-Inhalt: Datei-Upload und -Liste
│   └── AktivitaetenTab.tsx               # Tab-Inhalt: Aktivitaeten-Feed
└── pages/
    ├── FlowDashboard.tsx                 # Persoenliches Dashboard (klickbare Tagungen)
    ├── BildungsgangPage.tsx              # Bildungsgang-Detail mit Mitglieder-Anzeige
    ├── ArbeitspaketErstellenPage.tsx     # Neues Paket anlegen
    ├── ArbeitspaketPage.tsx              # Tab-Shell (321 Zeilen): bindet Tab-Komponenten ein
    ├── TagungDetailPage.tsx              # Agenda-Editor, Dokumentation, Aufgabenerstellung
    ├── MeineAufgabenPage.tsx             # Paketuebergreifend mit Links zu Arbeitspaketen
    ├── AbteilungPage.tsx                 # Aggregierte Abteilungssicht (klickbar)
    └── AdminBGLVerwaltung.tsx            # BGL-Verwaltung (admin/superadmin)
```

Hinweis: `hooks/`- und `utils/`-Verzeichnis nicht angelegt. Logik liegt direkt in den Seiten- und Tab-Komponenten. Die Tab-Inhalte von ArbeitspaketPage sind als eigene Dateien in `components/` ausgelagert (AufgabenTab, TagungenTab, MitgliederTab, DateienTab, AktivitaetenTab).

### Abweichungen vom Fachkonzept

| Fachkonzept | Implementierung | Grund |
|---|---|---|
| `components/layout/` (Sidebar, Topbar, AppShell) | Nicht im Modul | eduVite hat ein globales Layout |
| `components/shared/RollenGuard.tsx` | `components/RollenGuard.tsx` oder inline | Kein shared-Ordner noetig, nur Flow nutzt es |
| `components/shared/AvatarGruppe.tsx` | Pruefen ob global vorhanden | Koennte in `src/components/` existieren |
| `components/shared/LeerZustand.tsx` | Inline oder globale Komponente | Kein eigener shared-Ordner |
| `context/AuthContext.tsx` | Bestehender `AuthContext` nutzen | eduVite hat bereits Auth-Context |
| `context/BerechtigungsContext.tsx` | `hooks/useFlowBerechtigungen.ts` | Hook statt Context, einfacher |
| `hooks/useKalenderAbo.ts` | Phase 3, nicht MVP | Priorisierung |
| `utils/kalender.ts` | Phase 3, Backend-seitig | iCal-Generierung gehoert ins Backend |
| `utils/statistiken.ts` | Backend liefert aggregiert | Keine Client-seitige Berechnung |

## Routing innerhalb des Moduls

Flow nutzt `FlowLayout.tsx` als `teacherLayout`. Die Routen werden als `teacherRoutes` im Modul-Manifest definiert:

```ts
// src/modules/flow/index.ts – teacherRoutes (Stand 2026-03-21)
teacherRoutes: [
    { index: true, Component: FlowDashboard },
    { path: 'aufgaben', Component: MeineAufgabenPage },
    { path: 'bildungsgang/:id', Component: BildungsgangPage },
    { path: 'arbeitspaket/neu/:bildungsgangId', Component: ArbeitspaketErstellenPage },
    { path: 'arbeitspaket/:id', Component: ArbeitspaketPage },
    { path: 'tagung/:id', Component: TagungDetailPage },
    { path: 'admin/bgl', Component: AdminBGLVerwaltung },
    { path: 'admin/abteilung', Component: AbteilungPage },
],
```

Alle Pfade relativ zum Mount-Point `/teacher/flow/`. Die Tagung-Route ist **flach** (`tagung/:id`), nicht nested unter `arbeitspaket/:id`.

Admin-Seiten (BGL-Verwaltung, Abteilungssicht) laufen als `teacherRoutes` unter `/teacher/flow/admin/*` – keine separaten `adminRoutes`.

## State Management

**Entscheidung (2026-03-20): TanStack Query wird als neue Dependency eingefuehrt.**

Gruende:
- Flow hat ~20 API-Methoden mit komplexen Invalidierungs-Abhaengigkeiten (Paket-Detail invalidiert Aufgaben, Mitglieder, Aktivitaeten)
- Optimistic Updates bei Aufgaben-Status-Wechsel (Checkbox → sofort visuell erledigt) sind mit TanStack Query trivial
- Manuelles `useState`/`useEffect` wuerde zu massivem Boilerplate und Race Conditions fuehren
- Die Dependency nuetzt auch kuenftigen Modulen

### Setup

```bash
npm install @tanstack/react-query
```

`QueryClientProvider` wird in `FlowApp.tsx` oder global in `App.tsx` eingebunden (pruefen ob andere Module profitieren).

### Query-Key-Konvention

```ts
// Alle Flow-Keys beginnen mit ['flow', ...]
queryKey: ['flow', 'arbeitspakete', paketId]
queryKey: ['flow', 'aufgaben', paketId]
queryKey: ['flow', 'aufgaben', 'meine']
queryKey: ['flow', 'tagungen', paketId]
queryKey: ['flow', 'dashboard']
queryKey: ['flow', 'abteilung']
```

### Invalidierung

```ts
// Nach Aufgabe erstellen/aendern:
queryClient.invalidateQueries({ queryKey: ['flow', 'aufgaben', paketId] });
queryClient.invalidateQueries({ queryKey: ['flow', 'aufgaben', 'meine'] });
queryClient.invalidateQueries({ queryKey: ['flow', 'dashboard'] });

// Nach Mitglied hinzufuegen/entfernen:
queryClient.invalidateQueries({ queryKey: ['flow', 'arbeitspakete', paketId] });
```

## CSS Custom Property

In der globalen CSS-Datei (pruefen wo `--module-accent-schulsozialarbeit` definiert ist):

```css
--module-accent-flow: #3B82F6;  /* Blau, abzustimmen */
```

## Hinweissystem-Darstellung

Die Hinweis-Stufen muessen auf bestehende CSS-Klassen oder -Variablen gemappt werden:

| Stufe | CSS-Klasse | Farbe |
|---|---|---|
| `info` | Dezent, `var(--brand-muted)` | Grau/Blau |
| `warnung` | Hervorgehoben, `var(--brand-warning)` | Gelb/Orange |
| `ueberfaellig` | Dringend, `var(--brand-danger)` | Rot |

Pruefen welche `--brand-*` Variablen existieren und die Hinweis-Darstellung daran anpassen.

## MVP-Scope fuer Komponenten

### MVP (Phase 1)

- FlowApp, FlowDashboard
- BildungsgangUebersicht
- ArbeitspaketErstellen, ArbeitspaketDetail, ArbeitspaketHeader
- ProblemBeschreibung
- AufgabenListe, AufgabeItem, AufgabeErstellen
- MeineAufgaben
- TagungErstellen, TagungDetail (Basis)
- MitgliederVerwalten
- DateiBereich (Upload + Liste)
- AbschlussDialog
- AbteilungsDashboard
- HinweisLeiste, StatusBadge, FortschrittsBalken, DeadlineAnzeige
- Alle Hooks und Utils

### Phase 2

- AgendaPunktEditor (erweitert)
- AbschlussZusammenfassung (automatisch generiert)
- AktivitaetsFeed
- TagungenUebersicht (mit Zaehler)

### Phase 3 (Kalender)

- Kalender-Abo-Einstellungen
- KollisionsHinweis
